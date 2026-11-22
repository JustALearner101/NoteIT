import { describe, expect, it } from 'vitest'
import { buildCleanCliEnv, parseCliStreamLine } from './cli-bridge.service'
import { startLoopbackMcpBridge } from './mcp-loopback'

describe('cli-bridge & loopback MCP server', () => {
  it('strips NoteIT-injected secret env vars and sets CLAUDE_CODE_DISABLE_CLAUDE_MDS=1', () => {
    const env = buildCleanCliEnv({
      PATH: '/usr/bin',
      NOTEIT_PROVIDER_API_KEY: 'secret-should-be-removed',
      NOTEIT_CUSTOM_API_KEY: 'another-secret',
      USER: 'dev'
    })
    expect(env.NOTEIT_PROVIDER_API_KEY).toBeUndefined()
    expect(env.NOTEIT_CUSTOM_API_KEY).toBeUndefined()
    expect(env.CLAUDE_CODE_DISABLE_CLAUDE_MDS).toBe('1')
    expect(env.USER).toBe('dev')
  })

  it('parses Claude Code stream-json text deltas, tool_use, and result events', () => {
    const delta = parseCliStreamLine(
      'cli-claude',
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello from CLI' }
        }
      })
    )
    expect(delta).toEqual({ textDelta: 'Hello from CLI' })

    const toolUse = parseCliStreamLine(
      'cli-claude',
      JSON.stringify({
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          content_block: { type: 'tool_use', name: 'mcp__noteit__read_page_spec' }
        }
      })
    )
    expect(toolUse?.toolCall?.toolName).toBe('read_page_spec')

    const done = parseCliStreamLine('cli-claude', JSON.stringify({ type: 'result', is_error: false }))
    expect(done).toEqual({ done: true })
  })

  it('enforces Bearer token auth on loopback MCP bridge and executes declared tools', async () => {
    const bridge = await startLoopbackMcpBridge([
      {
        name: 'echo_note',
        description: 'Echoes input text',
        inputSchema: { type: 'object', properties: { msg: { type: 'string' } } },
        execute: async ({ msg }) => ({ echoed: String(msg || '') })
      }
    ])

    try {
      // Unauthorized request must be rejected with 401
      const unauth = await fetch(bridge.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      })
      expect(unauth.status).toBe(401)

      // Authorized tools/list
      const listRes = await fetch(bridge.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bridge.token}`
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
      })
      expect(listRes.status).toBe(200)
      const listJson = (await listRes.json()) as any
      expect(listJson.result.tools).toHaveLength(1)
      expect(listJson.result.tools[0].name).toBe('echo_note')

      // Authorized tools/call
      const callRes = await fetch(bridge.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bridge.token}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'echo_note', arguments: { msg: 'NoteIT v2.3' } }
        })
      })
      const callJson = (await callRes.json()) as any
      expect(callJson.result.content[0].text).toContain('NoteIT v2.3')
    } finally {
      await bridge.close()
    }
  })
})
