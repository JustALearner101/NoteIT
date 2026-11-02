import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import type { DetectedCliPreset, TerminalSessionInfo } from '@shared/types/domain'

const execFileAsync = promisify(execFile)

type IPty = import('@lydell/node-pty').IPty

interface ActivePtySession {
  id: string
  title: string
  cwd: string
  cliPresetId?: string
  shellType: 'conpty' | 'subprocess'
  pty?: IPty
  subprocess?: ChildProcess
  createdAt: number
  recentOutputTail: string[]
  detectedState: TerminalSessionInfo['detectedState']
}

let nodePtyModule: typeof import('@lydell/node-pty') | null = null
let hasAttemptedLoadNodePty = false

function loadNodePty(): typeof import('@lydell/node-pty') | null {
  if (hasAttemptedLoadNodePty) return nodePtyModule
  hasAttemptedLoadNodePty = true
  try {
    // Dynamic require/import so any compilation or native binary failure does not crash the app
    nodePtyModule = require('@lydell/node-pty')
    return nodePtyModule
  } catch (error) {
    console.warn('[terminal.service] @lydell/node-pty tidak dapat dimuat, beralih ke child_process fallback:', error)
    nodePtyModule = null
    return null
  }
}

const activeSessions = new Map<string, ActivePtySession>()

/** Regex pembersih kode ANSI escape sequence untuk analisis teks murni */
const ANSI_REGEX =
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '')
}

/**
 * Menganalisis potongan output terminal untuk mendeteksi apakah agen CLI sedang
 * menunggu konfirmasi user [y/n] atau sedang menjalankan test suite.
 */
export function analyzeTerminalState(
  recentLines: string[]
): TerminalSessionInfo['detectedState'] {
  const combined = recentLines.join('\n')
  const clean = stripAnsi(combined).trim()
  if (!clean) return 'idle'

  // Pattern konfirmasi approval user (ala Claude Code, Codex, Aider, CLI)
  if (
    /(\[y\/n\]|\[Y\/n\]|\(y\/n\)|Allow\s+.*\?|Do you want to proceed|Approve\?|Accept this change\?|Confirm\s+action)/i.test(
      clean
    )
  ) {
    return 'waiting_approval'
  }

  // Pattern runner test suite
  if (
    /(vitest|jest|pytest|cargo test|go test|npm test|Running tests|test suites?|PASS\s+|FAIL\s+)/i.test(
      clean
    )
  ) {
    return 'running_tests'
  }

  return 'thinking'
}

/**
 * Deteksi CLI preset di Windows PATH menggunakan where.exe (atau which di Unix).
 */
export async function detectInstalledClis(): Promise<DetectedCliPreset[]> {
  const presets: { id: DetectedCliPreset['id']; name: string; command: string; description: string }[] = [
    {
      id: 'claude',
      name: 'Claude Code',
      command: 'claude',
      description: 'Anthropic Official Claude Code CLI'
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      command: 'codex',
      description: 'OpenAI Codex Command-line Agent'
    },
    {
      id: 'gemini',
      name: 'Gemini CLI',
      command: 'gemini',
      description: 'Google Gemini Developer CLI'
    },
    {
      id: 'aider',
      name: 'Aider Pair Programmer',
      command: 'aider',
      description: 'AI Pair Programming in your terminal'
    },
    {
      id: 'pwsh',
      name: 'PowerShell 7+',
      command: 'pwsh',
      description: 'Modern PowerShell Core'
    },
    {
      id: 'cmd',
      name: 'Command Prompt',
      command: 'cmd.exe',
      description: 'Windows Default Command Shell'
    },
    {
      id: 'bash',
      name: 'Git Bash',
      command: 'bash',
      description: 'GNU Bash / Git for Windows'
    }
  ]

  const lookupCmd = process.platform === 'win32' ? 'where.exe' : 'which'
  const results: DetectedCliPreset[] = []

  for (const preset of presets) {
    try {
      const { stdout } = await execFileAsync(lookupCmd, [preset.command], {
        windowsHide: true,
        timeout: 2500
      })
      const foundPath = stdout.split('\n')[0].trim()
      results.push({
        id: preset.id,
        name: preset.name,
        command: preset.command,
        available: Boolean(foundPath),
        path: foundPath || undefined,
        description: preset.description
      })
    } catch {
      results.push({
        id: preset.id,
        name: preset.name,
        command: preset.command,
        available: false,
        description: preset.description
      })
    }
  }

  return results
}

export type TerminalEventCallback = (
  event:
    | { type: 'data'; sessionId: string; data: string }
    | { type: 'exit'; sessionId: string; exitCode: number }
    | { type: 'state-change'; sessionId: string; state: TerminalSessionInfo['detectedState'] }
) => void

/**
 * Membuat sesi terminal baru (ConPTY atau subprocess fallback).
 */
export function createTerminalSession(
  input: {
    cwd: string
    command?: string
    args?: string[]
    title?: string
    cliPresetId?: string
    cols?: number
    rows?: number
  },
  onEvent: TerminalEventCallback
): { sessionId: string; shellType: 'conpty' | 'subprocess' } {
  const sessionId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const targetCwd = fs.existsSync(input.cwd) ? input.cwd : process.cwd()
  const cols = input.cols || 100
  const rows = input.rows || 30

  // Pilih shell default: jika command tidak diberikan, pilih pwsh -> powershell -> cmd
  let defaultShell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
  if (process.platform === 'win32' && !input.command) {
    // Coba pwsh.exe terlebih dahulu
    defaultShell = 'powershell.exe'
  }

  const execCommand = input.command || defaultShell
  const execArgs = input.args || []
  const title = input.title || input.command || (process.platform === 'win32' ? 'PowerShell' : 'Bash')

  const ptyLib = loadNodePty()

  if (ptyLib) {
    try {
      const ptyProcess = ptyLib.spawn(execCommand, execArgs, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: targetCwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        },
        useConpty: process.platform === 'win32'
      })

      const session: ActivePtySession = {
        id: sessionId,
        title,
        cwd: targetCwd,
        cliPresetId: input.cliPresetId,
        shellType: 'conpty',
        pty: ptyProcess,
        createdAt: Date.now(),
        recentOutputTail: [],
        detectedState: 'idle'
      }

      ptyProcess.onData((data: string) => {
        // Simpan tail untuk stream analyzer
        session.recentOutputTail.push(data)
        if (session.recentOutputTail.length > 20) {
          session.recentOutputTail.shift()
        }

        const newState = analyzeTerminalState(session.recentOutputTail)
        if (newState !== session.detectedState) {
          session.detectedState = newState
          onEvent({ type: 'state-change', sessionId, state: newState })
        }

        onEvent({ type: 'data', sessionId, data })
      })

      ptyProcess.onExit(({ exitCode }) => {
        activeSessions.delete(sessionId)
        onEvent({ type: 'exit', sessionId, exitCode })
      })

      activeSessions.set(sessionId, session)
      return { sessionId, shellType: 'conpty' }
    } catch (ptyError) {
      console.warn('[terminal.service] ConPTY spawn gagal, beralih ke fallback subprocess:', ptyError)
    }
  }

  // Graceful Fallback: subprocess spawn
  const child = spawn(execCommand, execArgs, {
    cwd: targetCwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color'
    },
    shell: true
  })

  const session: ActivePtySession = {
    id: sessionId,
    title,
    cwd: targetCwd,
    cliPresetId: input.cliPresetId,
    shellType: 'subprocess',
    subprocess: child,
    createdAt: Date.now(),
    recentOutputTail: [],
    detectedState: 'idle'
  }

  child.stdout?.on('data', (chunk: Buffer) => {
    const data = chunk.toString('utf-8')
    session.recentOutputTail.push(data)
    if (session.recentOutputTail.length > 20) session.recentOutputTail.shift()

    const newState = analyzeTerminalState(session.recentOutputTail)
    if (newState !== session.detectedState) {
      session.detectedState = newState
      onEvent({ type: 'state-change', sessionId, state: newState })
    }

    onEvent({ type: 'data', sessionId, data })
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    onEvent({ type: 'data', sessionId, data: chunk.toString('utf-8') })
  })

  child.on('exit', (code) => {
    activeSessions.delete(sessionId)
    onEvent({ type: 'exit', sessionId, exitCode: code ?? 0 })
  })

  activeSessions.set(sessionId, session)
  return { sessionId, shellType: 'subprocess' }
}

export function writeTerminal(sessionId: string, data: string): void {
  const session = activeSessions.get(sessionId)
  if (!session) return

  if (session.pty) {
    session.pty.write(data)
  } else if (session.subprocess?.stdin?.writable) {
    session.subprocess.stdin.write(data)
  }
}

export function resizeTerminal(sessionId: string, cols: number, rows: number): void {
  const session = activeSessions.get(sessionId)
  if (!session) return

  if (session.pty && cols > 0 && rows > 0) {
    try {
      session.pty.resize(cols, rows)
    } catch {
      // Best-effort resize
    }
  }
}

export function killTerminal(sessionId: string): { ok: boolean } {
  const session = activeSessions.get(sessionId)
  if (!session) return { ok: false }

  try {
    if (session.pty) {
      session.pty.kill()
    } else if (session.subprocess) {
      session.subprocess.kill()
    }
  } catch {
    // Best-effort kill
  }

  activeSessions.delete(sessionId)
  return { ok: true }
}

export function listTerminalSessions(): TerminalSessionInfo[] {
  const result: TerminalSessionInfo[] = []
  for (const s of activeSessions.values()) {
    result.push({
      id: s.id,
      title: s.title,
      cwd: s.cwd,
      cliPresetId: s.cliPresetId,
      shellType: s.shellType,
      isActive: true,
      detectedState: s.detectedState
    })
  }
  return result
}

export function killAllTerminalSessions(): void {
  for (const s of activeSessions.values()) {
    try {
      if (s.pty) s.pty.kill()
      else if (s.subprocess) s.subprocess.kill()
    } catch {
      // Ignored
    }
  }
  activeSessions.clear()
}
