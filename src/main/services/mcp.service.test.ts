import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, getDb, initDatabase } from '../db/client'
import {
  MASKED_MCP_ENV_VALUE,
  deleteMcpServer,
  disconnectAllMcpServers,
  getMcpServerWithSecrets,
  jsonSchemaToZod,
  listMcpServers,
  testMcpConnection,
  upsertMcpServer
} from './mcp.service'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

class MockMcpTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void
  closed = false

  async start(): Promise<void> {
    // Ready immediately
  }

  async send(message: JSONRPCMessage): Promise<void> {
    const req = message as { id?: number | string; method?: string }
    if (req.method === 'initialize' && req.id !== undefined) {
      queueMicrotask(() => {
        this.onmessage?.({
          jsonrpc: '2.0',
          id: req.id!,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mock-mcp-server', version: '1.2.3' }
          }
        })
      })
    } else if (req.method === 'tools/list' && req.id !== undefined) {
      queueMicrotask(() => {
        this.onmessage?.({
          jsonrpc: '2.0',
          id: req.id!,
          result: {
            tools: [
              {
                name: 'query_docs',
                description: 'Search external docs',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'Search query' },
                    limit: { type: 'number' }
                  },
                  required: ['query']
                }
              }
            ]
          }
        })
      })
    }
  }

  async close(): Promise<void> {
    this.closed = true
    this.onclose?.()
  }
}

describe('mcp.service', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-mcp-test-'))
    initDatabase(tempDir)
  })

  afterAll(async () => {
    await disconnectAllMcpServers()
    closeDb()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('performs CRUD on mcp_servers in SQLite', async () => {
    const created = await upsertMcpServer({
      name: 'Local Docs Server',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      envVars: { API_TOKEN: 'secret-123' },
      enabled: true,
      requireApproval: true
    })

    expect(created.id).toMatch(/^mcp-/)
    expect(created.name).toBe('Local Docs Server')
    expect(created.args).toEqual(['server.js'])
    // IPC-facing config masks secret values; raw secret is encrypted in secrets table
    expect(created.envVars).toEqual({ API_TOKEN: MASKED_MCP_ENV_VALUE })
    expect(getMcpServerWithSecrets(created.id)?.envVars).toEqual({ API_TOKEN: 'secret-123' })

    const rawRow = getDb()
      .prepare('SELECT env_keys_json FROM mcp_servers WHERE id = ?')
      .get(created.id) as { env_keys_json: string }
    expect(rawRow.env_keys_json).not.toContain('secret-123')
    expect(JSON.parse(rawRow.env_keys_json)).toEqual(['API_TOKEN'])

    const list = listMcpServers()
    expect(list.length).toBe(1)
    expect(list[0].envVars).toEqual({ API_TOKEN: MASKED_MCP_ENV_VALUE })

    const updated = await upsertMcpServer({
      id: created.id,
      name: 'HTTP Docs Server',
      transport: 'streamable-http',
      url: 'http://localhost:8080/mcp',
      envVars: { API_TOKEN: MASKED_MCP_ENV_VALUE },
      enabled: false,
      requireApproval: false
    })
    expect(updated.name).toBe('HTTP Docs Server')
    expect(updated.transport).toBe('streamable-http')
    expect(updated.enabled).toBe(false)
    expect(updated.requireApproval).toBe(false)
    // Preserves encrypted secret when masked placeholder is submitted unchanged
    expect(getMcpServerWithSecrets(created.id)?.envVars).toEqual({ API_TOKEN: 'secret-123' })

    await deleteMcpServer(created.id)
    expect(listMcpServers().length).toBe(0)
    expect(getMcpServerWithSecrets(created.id)).toBeNull()
  })

  it('connects via transport, discovers tools, and closes cleanly on testMcpConnection', async () => {
    let mockTransport: MockMcpTransport | null = null
    const server = await upsertMcpServer({
      name: 'Mock MCP',
      transport: 'stdio',
      command: 'mock-bin',
      args: []
    })

    const res = await testMcpConnection(server.id, () => {
      mockTransport = new MockMcpTransport()
      return mockTransport
    })

    expect(res.ok).toBe(true)
    expect(res.serverVersion).toBe('mock-mcp-server v1.2.3')
    expect(res.tools).toHaveLength(1)
    expect(res.tools[0].name).toBe('query_docs')
    expect(mockTransport!.closed).toBe(true)
  })

  it('converts JSON Schema tool inputs to Zod schemas', () => {
    const zodSchema = jsonSchemaToZod({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query text' },
        maxHits: { type: 'integer' },
        includeDrafts: { type: 'boolean' },
        mode: { type: 'string', enum: ['fast', 'deep'] }
      },
      required: ['query']
    })

    expect(zodSchema.safeParse({ query: 'sqlite wal', mode: 'fast' }).success).toBe(true)
    expect(zodSchema.safeParse({ maxHits: 5 }).success).toBe(false)
    expect(zodSchema.safeParse({ query: 'sqlite', mode: 'invalid' }).success).toBe(false)
  })
})
