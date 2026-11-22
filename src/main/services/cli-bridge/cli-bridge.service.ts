import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { promisify } from 'node:util'
import type { AIChatStreamEvent, AIChatStreamRequest } from '@shared/ipc-channels'
import type { AIProviderProfile, CliBridgeStatus } from '@shared/types/domain'
import { startLoopbackMcpBridge, type LoopbackMcpToolDefinition } from './mcp-loopback'

const execFileAsync = promisify(execFile)

const NOTEIT_INJECTED_ENV_KEYS = [
  'NOTEIT_PROVIDER_API_KEY',
  'NOTEIT_CUSTOM_API_KEY'
]

/**
 * Strips any NoteIT-injected secret env vars while preserving the user's native OS/CLI
 * authentication and subscription routing (inspired by LearnHarness externalCliEnv).
 */
export function buildCleanCliEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...baseEnv }
  for (const key of NOTEIT_INJECTED_ENV_KEYS) {
    delete next[key]
  }
  // Prevent Claude Code from loading unrelated project CLAUDE.md files into NoteIT prompts
  next.CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1'
  return next
}

async function probeBinary(command: string): Promise<{ available: boolean; path?: string; version?: string }> {
  const lookup = process.platform === 'win32' ? 'where.exe' : 'which'
  try {
    const { stdout } = await execFileAsync(lookup, [command], {
      windowsHide: true,
      timeout: 3000
    })
    const firstPath = stdout.split(/\r?\n/)[0]?.trim()
    if (!firstPath) return { available: false }

    let version: string | undefined
    try {
      const verRes = await execFileAsync(firstPath, ['--version'], {
        windowsHide: true,
        timeout: 4500
      })
      version = (verRes.stdout || verRes.stderr).split(/\r?\n/)[0]?.trim().slice(0, 80) || undefined
    } catch {
      // Binary exists even if --version is unsupported or slow
    }
    return { available: true, path: firstPath, version }
  } catch {
    return { available: false }
  }
}

export async function detectCliBridges(): Promise<CliBridgeStatus[]> {
  const targets: Array<{
    id: CliBridgeStatus['id']
    name: string
    command: string
    supportsMcpBridge: boolean
  }> = [
    { id: 'claude', name: 'Claude Code CLI', command: 'claude', supportsMcpBridge: true },
    { id: 'gemini', name: 'Gemini CLI', command: 'gemini', supportsMcpBridge: false },
    { id: 'codex', name: 'Codex CLI', command: 'codex', supportsMcpBridge: false },
    { id: 'agy', name: 'Antigravity CLI', command: 'agy', supportsMcpBridge: false }
  ]

  return Promise.all(
    targets.map(async (t) => {
      const probe = await probeBinary(t.command)
      return {
        id: t.id,
        name: t.name,
        command: t.command,
        available: probe.available,
        path: probe.path,
        version: probe.version,
        supportsMcpBridge: t.supportsMcpBridge
      }
    })
  )
}

export interface ParsedCliDelta {
  textDelta?: string
  toolCall?: { toolName: string; argsSummary: string }
  error?: string
  done?: boolean
}

/**
 * Parses a single NDJSON line from Claude Code `--output-format stream-json`,
 * Gemini CLI `--output-format stream-json`, or Codex CLI `--json`.
 */
export function parseCliStreamLine(kind: 'cli-claude' | 'cli-gemini' | 'cli-codex' | 'cli-custom', line: string): ParsedCliDelta | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  if (!trimmed.startsWith('{')) {
    return { textDelta: line + '\n' }
  }

  let parsed: Record<string, any>
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { textDelta: line + '\n' }
  }

  if (kind === 'cli-claude') {
    // Stream event partial delta (Anthropic Messages stream format wrapped by Claude CLI)
    if (parsed.type === 'stream_event' && parsed.event) {
      const ev = parsed.event
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && typeof ev.delta.text === 'string') {
        return { textDelta: ev.delta.text }
      }
      if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
        const rawName = String(ev.content_block.name || 'tool')
        const cleanName = rawName.replace(/^mcp__[^_]+__/, '')
        return { toolCall: { toolName: cleanName, argsSummary: 'invoked via CLI MCP bridge' } }
      }
      return null
    }
    // Non-partial fallback assistant message
    if (parsed.type === 'assistant' && Array.isArray(parsed.message?.content)) {
      const textParts = parsed.message.content
        .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
        .map((b: any) => b.text)
      if (textParts.length > 0) {
        return { textDelta: textParts.join('') }
      }
      return null
    }
    if (parsed.type === 'result') {
      if (parsed.is_error) {
        return { error: String(parsed.result || parsed.error || 'Claude CLI returned an error'), done: true }
      }
      return { done: true }
    }
    return null
  }

  if (kind === 'cli-gemini') {
    if (parsed.type === 'message' && parsed.role === 'assistant' && typeof parsed.content === 'string') {
      return { textDelta: parsed.content }
    }
    if (typeof parsed.delta === 'string') {
      return { textDelta: parsed.delta }
    }
    if (typeof parsed.text === 'string') {
      return { textDelta: parsed.text }
    }
    if (parsed.type === 'result') {
      return { done: true }
    }
    if (parsed.type === 'error') {
      return { error: String(parsed.message || parsed.error || 'Gemini CLI error'), done: true }
    }
    return null
  }

  if (kind === 'cli-codex') {
    if (parsed.type === 'item.completed' && parsed.item?.type === 'agent_message' && typeof parsed.item.text === 'string') {
      return { textDelta: parsed.item.text }
    }
    if (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
      return { textDelta: parsed.delta }
    }
    if (parsed.type === 'turn.completed') {
      return { done: true }
    }
    if (parsed.type === 'error' || parsed.type === 'turn.failed') {
      return { error: String(parsed.message || parsed.error?.message || 'Codex CLI error'), done: true }
    }
    return null
  }

  // Generic JSON line fallback
  if (typeof parsed.text === 'string') return { textDelta: parsed.text }
  if (typeof parsed.content === 'string') return { textDelta: parsed.content }
  return null
}

function buildCombinedPrompt(systemPrompt: string, messages: AIChatStreamRequest['messages']): string {
  const parts: string[] = []
  if (systemPrompt.trim()) {
    parts.push(`<system>\n${systemPrompt.trim()}\n</system>`)
  }
  for (const m of messages) {
    parts.push(`${m.role === 'user' ? 'User' : 'Assistant'}:\n${m.content}`)
  }
  return parts.join('\n\n')
}

export async function executeCliBridgeStream(params: {
  req: AIChatStreamRequest
  profile: Pick<AIProviderProfile, 'kind' | 'name' | 'defaultModel' | 'cliCommand' | 'cliArgsTemplate'>
  systemPrompt: string
  tools: LoopbackMcpToolDefinition[]
  emit: (event: AIChatStreamEvent) => void
  signal?: AbortSignal
}): Promise<void> {
  const { req, profile, systemPrompt, tools, emit, signal } = params
  const kind = profile.kind as 'cli-claude' | 'cli-gemini' | 'cli-codex' | 'cli-custom'
  const selectedModel = (req.modelId && !req.modelId.includes('Default') ? req.modelId : profile.defaultModel) || ''

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'noteit-cli-'))
  let bridge: Awaited<ReturnType<typeof startLoopbackMcpBridge>> | null = null

  try {
    let command = profile.cliCommand
    let args: string[] = []
    let stdinPayload: string | null = null

    if (kind === 'cli-claude') {
      command = command || 'claude'
      bridge = await startLoopbackMcpBridge(tools, 'noteit')
      const systemFile = path.join(tmpDir, 'system.txt')
      const mcpConfigFile = path.join(tmpDir, 'mcp.json')
      await fs.writeFile(systemFile, systemPrompt, { mode: 0o600 })
      await fs.writeFile(mcpConfigFile, JSON.stringify(bridge.toClaudeMcpConfig(), null, 2), { mode: 0o600 })

      const allowedTools = tools.map((t) => `mcp__noteit__${t.name}`)
      args = [
        '-p',
        '--input-format', 'stream-json',
        '--output-format', 'stream-json',
        '--verbose',
        '--include-partial-messages',
        '--system-prompt-file', systemFile,
        '--tools', '',
        '--strict-mcp-config',
        '--mcp-config', mcpConfigFile,
        '--disable-slash-commands',
        '--no-session-persistence',
        '--permission-prompts', 'none'
      ]
      if (selectedModel) {
        args.push('--model', selectedModel)
      }
      if (allowedTools.length > 0) {
        args.push('--allowedTools', allowedTools.join(','))
      }

      const conversationText = req.messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n')
      stdinPayload =
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: conversationText }
        }) + '\n'
    } else if (kind === 'cli-gemini') {
      command = command || 'gemini'
      const combined = buildCombinedPrompt(systemPrompt, req.messages)
      args = ['-p', combined, '--output-format', 'stream-json']
      if (selectedModel) {
        args.push('-m', selectedModel)
      }
    } else if (kind === 'cli-codex') {
      command = command || 'codex'
      const combined = buildCombinedPrompt(systemPrompt, req.messages)
      args = ['exec', '--json', combined]
      if (selectedModel) {
        args.push('-m', selectedModel)
      }
    } else {
      // cli-custom (e.g., agy or any user-supplied headless CLI)
      if (!command) {
        throw new Error('Custom CLI command is empty. Configure it in Settings -> AI providers.')
      }
      const combined = buildCombinedPrompt(systemPrompt, req.messages)
      const template = profile.cliArgsTemplate.length > 0 ? profile.cliArgsTemplate : ['-p', '{{prompt}}']
      let usedPromptPlaceholder = false
      args = template.map((arg) => {
        if (arg.includes('{{prompt}}')) {
          usedPromptPlaceholder = true
          return arg.replace(/\{\{prompt\}\}/g, combined)
        }
        if (arg.includes('{{model}}')) {
          return arg.replace(/\{\{model\}\}/g, selectedModel)
        }
        return arg
      })
      if (!usedPromptPlaceholder) {
        stdinPayload = combined
      }
    }

    const child = spawn(command, args, {
      cwd: tmpDir,
      env: buildCleanCliEnv(process.env),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    if (signal) {
      signal.addEventListener('abort', () => {
        child.kill('SIGTERM')
      })
    }

    if (stdinPayload !== null) {
      child.stdin.write(stdinPayload)
    }
    child.stdin.end()

    let stderrTail = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf-8')).slice(-2000)
    })

    let emittedAnyDelta = false
    let reportedError: string | null = null

    const rl = readline.createInterface({ input: child.stdout })
    for await (const line of rl) {
      const parsed = parseCliStreamLine(kind, line)
      if (!parsed) continue
      if (parsed.textDelta) {
        // Avoid duplicating full assistant message when partial stream_events already streamed
        if (kind === 'cli-claude' && emittedAnyDelta && line.includes('"type":"assistant"')) {
          continue
        }
        emittedAnyDelta = true
        emit({
          requestId: req.requestId,
          type: 'text-delta',
          textDelta: parsed.textDelta
        })
      }
      if (parsed.toolCall) {
        emit({
          requestId: req.requestId,
          type: 'tool-call',
          toolName: parsed.toolCall.toolName,
          argsSummary: parsed.toolCall.argsSummary
        })
      }
      if (parsed.error) {
        reportedError = parsed.error
      }
    }

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code) => resolve(code))
    })

    if (reportedError) {
      emit({ requestId: req.requestId, type: 'error', error: reportedError })
      return
    }

    if (exitCode !== 0 && !emittedAnyDelta) {
      emit({
        requestId: req.requestId,
        type: 'error',
        error: `CLI "${command}" exited with code ${exitCode}. ${stderrTail.trim() || 'Check CLI installation & login status.'}`
      })
      return
    }

    emit({
      requestId: req.requestId,
      type: 'done',
      usedLiveSdk: true,
      providerLabel: `CLI Bridge · ${profile.name}${selectedModel ? ` (${selectedModel})` : ''}`
    })
  } catch (err) {
    emit({
      requestId: req.requestId,
      type: 'error',
      error: err instanceof Error ? err.message : String(err)
    })
  } finally {
    if (bridge) {
      await bridge.close().catch(() => {})
    }
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
