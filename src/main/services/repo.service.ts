import { dialog, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitFileStatus, RepoEntry, RepoGitStatusSummary } from '@shared/types/domain'

const execFileAsync = promisify(execFile)

/** Direktori yang selalu disembunyikan dari Repo Explorer */
const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  '.noteit',
  '.turbo',
  '.next',
  '.nuxt',
  'build',
  'coverage',
  '.cache'
])

function mapExtensionToLanguage(ext: string): string {
  const normalized = ext.toLowerCase().replace(/^\./, '')
  switch (normalized) {
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
      return 'typescript'
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'json':
      return 'json'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'css':
      return 'css'
    case 'scss':
    case 'sass':
    case 'less':
      return 'css'
    case 'html':
    case 'htm':
      return 'html'
    case 'sql':
    case 'dbml':
      return 'sql'
    case 'py':
      return 'python'
    case 'rs':
      return 'rust'
    case 'go':
      return 'go'
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell'
    case 'ps1':
    case 'psm1':
      return 'powershell'
    case 'yaml':
    case 'yml':
      return 'yaml'
    case 'toml':
      return 'toml'
    default:
      return 'plaintext'
  }
}

/**
 * Jalankan perintah git dengan argumen terisolasi array (aman dari shell injection).
 */
export async function runGitCommand(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    })
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 }
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; code?: number }
    return {
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || (error instanceof Error ? error.message : String(error))).trim(),
      exitCode: typeof err.code === 'number' ? err.code : 1
    }
  }
}

/**
 * Dialog pemilih folder repositori lokal.
 */
export async function pickRepoFolder(
  window: BrowserWindow | null,
  defaultPath?: string
): Promise<{ canceled: boolean; path?: string; isGitRepo: boolean; branch?: string }> {
  if (!window) return { canceled: true, isGitRepo: false }

  const result = await dialog.showOpenDialog(window, {
    title: 'Pilih Folder Repositori Proyek',
    defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : undefined,
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, isGitRepo: false }
  }

  const selectedPath = result.filePaths[0]
  const gitCheck = await runGitCommand(['rev-parse', '--is-inside-work-tree'], selectedPath)
  const isGitRepo = gitCheck.exitCode === 0 && gitCheck.stdout === 'true'

  let branch: string | undefined = undefined
  if (isGitRepo) {
    const branchCheck = await runGitCommand(['branch', '--show-current'], selectedPath)
    branch = branchCheck.exitCode === 0 && branchCheck.stdout ? branchCheck.stdout : 'main'
  }

  return {
    canceled: false,
    path: selectedPath,
    isGitRepo,
    branch
  }
}

/**
 * Parsing output porcelain git status (XY PATH).
 */
export function parseGitPorcelainOutput(output: string): Map<string, GitFileStatus> {
  const map = new Map<string, GitFileStatus>()
  if (!output) return map

  const lines = output.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.length < 4) continue

    const x = line[0]
    const y = line[1]
    let filePath = line.slice(3).trim()

    // Handle renamed format: "R  orig -> new"
    if (filePath.includes(' -> ')) {
      filePath = filePath.split(' -> ')[1]
    }

    // Normalize path separator to forward slash
    const normalized = filePath.replace(/\\/g, '/')

    let status: GitFileStatus = 'modified'
    if (x === '?' && y === '?') {
      status = 'untracked'
    } else if (x === 'A' || y === 'A') {
      status = 'added'
    } else if (x === 'D' || y === 'D') {
      status = 'deleted'
    } else if (x === 'R' || y === 'R') {
      status = 'renamed'
    } else if (x === 'M' || y === 'M' || x === 'U' || y === 'U') {
      status = 'modified'
    }

    map.set(normalized, status)
  }

  return map
}

/**
 * Ringkasan status git di repoPath.
 */
export async function getRepoGitStatus(repoPath: string): Promise<RepoGitStatusSummary> {
  if (!fs.existsSync(repoPath)) {
    return {
      branch: 'unknown',
      isClean: true,
      changedFiles: [],
      linesAdded: 0,
      linesRemoved: 0
    }
  }

  const branchRes = await runGitCommand(['branch', '--show-current'], repoPath)
  const branch = branchRes.exitCode === 0 && branchRes.stdout ? branchRes.stdout : 'HEAD'

  const statusRes = await runGitCommand(['status', '--porcelain', '-uall'], repoPath)
  const statusMap = parseGitPorcelainOutput(statusRes.stdout)

  const changedFiles: { relPath: string; status: GitFileStatus }[] = []
  for (const [relPath, status] of statusMap.entries()) {
    changedFiles.push({ relPath, status })
  }

  // Parse lines added/removed via git diff --shortstat
  let linesAdded = 0
  let linesRemoved = 0
  const diffStatRes = await runGitCommand(['diff', '--shortstat'], repoPath)
  if (diffStatRes.exitCode === 0 && diffStatRes.stdout) {
    const addMatch = /(\d+)\s+insertion/.exec(diffStatRes.stdout)
    const delMatch = /(\d+)\s+deletion/.exec(diffStatRes.stdout)
    if (addMatch) linesAdded = parseInt(addMatch[1], 10)
    if (delMatch) linesRemoved = parseInt(delMatch[1], 10)
  }

  return {
    branch,
    isClean: changedFiles.length === 0,
    changedFiles,
    linesAdded,
    linesRemoved
  }
}

/**
 * Membaca satu level direktori secara lazy untuk Repo Explorer.
 */
export async function readRepoDirectory(
  repoPath: string,
  relPath: string = ''
): Promise<RepoEntry[]> {
  const targetDir = path.resolve(repoPath, relPath)

  // Guard path traversal
  const relCheck = path.relative(repoPath, targetDir)
  if (relCheck.startsWith('..') && !path.isAbsolute(relCheck)) {
    throw new Error('Akses direktori di luar repositori ditolak.')
  }

  if (!fs.existsSync(targetDir)) {
    return []
  }

  // Ambil status git saat ini untuk memberi badge
  const gitStatusRes = await runGitCommand(['status', '--porcelain', '-uall'], repoPath)
  const gitMap = parseGitPorcelainOutput(gitStatusRes.stdout)

  const rawEntries = fs.readdirSync(targetDir, { withFileTypes: true })
  const result: RepoEntry[] = []

  for (const entry of rawEntries) {
    if (entry.isDirectory() && IGNORED_DIR_NAMES.has(entry.name)) {
      continue
    }

    const itemRelPath = relPath ? `${relPath}/${entry.name}`.replace(/\\/g, '/') : entry.name
    const isDir = entry.isDirectory()

    let size: number | undefined
    if (!isDir) {
      try {
        const stat = fs.statSync(path.join(targetDir, entry.name))
        size = stat.size
      } catch {
        size = 0
      }
    }

    // Tentukan gitStatus untuk file atau cek apakah folder memuat file yang diubah
    let gitStatus = gitMap.get(itemRelPath)
    if (!gitStatus && isDir) {
      const folderPrefix = `${itemRelPath}/`
      for (const [changedPath, status] of gitMap.entries()) {
        if (changedPath.startsWith(folderPrefix)) {
          gitStatus = status
          break
        }
      }
    }

    result.push({
      name: entry.name,
      relPath: itemRelPath,
      isDirectory: isDir,
      size,
      gitStatus
    })
  }

  // Urutkan direktori lebih dulu, lalu abjad A-Z
  result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  return result
}

/**
 * Membaca berkas teks dari repositori.
 */
export async function readRepoFile(
  repoPath: string,
  relPath: string
): Promise<{ content: string; language: string; size: number }> {
  const fullPath = path.resolve(repoPath, relPath)

  // Guard path traversal
  const relCheck = path.relative(repoPath, fullPath)
  if (relCheck.startsWith('..') && !path.isAbsolute(relCheck)) {
    throw new Error('Akses berkas di luar repositori ditolak.')
  }

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Berkas tidak ditemukan: ${relPath}`)
  }

  const stat = fs.statSync(fullPath)
  if (stat.isDirectory()) {
    throw new Error(`Path adalah direktori, bukan berkas: ${relPath}`)
  }

  // Maksimum 2MB untuk kenyamanan editor & frame budget sub-16ms
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`Ukuran berkas melebihi batas 2MB (${Math.round(stat.size / 1024)} KB).`)
  }

  const content = fs.readFileSync(fullPath, 'utf-8')
  const ext = path.extname(fullPath)
  const language = mapExtensionToLanguage(ext)

  return {
    content,
    language,
    size: stat.size
  }
}
