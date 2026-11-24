import { dialog, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getDbPath } from '../db/client'
import type {
  GitFileStatus,
  RepoEntry,
  RepoFileDiffResult,
  RepoGitStatusSummary,
  RepoSearchMatch
} from '@shared/types/domain'

const execFileAsync = promisify(execFile)

/** Directories always hidden from the Repo Explorer and code search */
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

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  css: 'css',
  scss: 'css',
  sass: 'css',
  less: 'css',
  html: 'html',
  htm: 'html',
  sql: 'sql',
  dbml: 'sql',
  py: 'python',
  rs: 'rust',
  go: 'go',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  psm1: 'powershell',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml'
}

export function mapExtensionToLanguage(ext: string): string {
  return EXTENSION_TO_LANGUAGE[ext.toLowerCase().replace(/^\./, '')] ?? 'plaintext'
}

/**
 * Strictly resolves `relPath` inside `repoPath`, guarding against null bytes,
 * absolute paths, `..` traversal, cross-drive escapes on Windows, and symlink escapes.
 */
export function resolveSafeRepoFilePath(
  repoPath: string,
  relPath: string,
  allowRoot: boolean = false
): { rootReal: string; targetPath: string; normalizedRelPath: string } {
  if (!repoPath || typeof repoPath !== 'string' || repoPath.includes('\0')) {
    throw new Error('Invalid repository root path.')
  }
  if (typeof relPath !== 'string' || relPath.includes('\0')) {
    throw new Error('Invalid relative path.')
  }

  const trimmedRel = relPath.trim()
  if (!allowRoot && !trimmedRel) {
    throw new Error('Relative file path cannot be empty.')
  }

  if (
    trimmedRel.startsWith('/') ||
    trimmedRel.startsWith('\\') ||
    /^[a-zA-Z]:/.test(trimmedRel) ||
    path.isAbsolute(trimmedRel)
  ) {
    throw new Error('Access outside repository is denied (absolute path rejected).')
  }

  const normalizedRelPath = trimmedRel.replace(/\\/g, '/').replace(/^\.\//, '')
  if (normalizedRelPath) {
    const segments = normalizedRelPath.split('/')
    if (segments.some((seg) => seg === '..' || seg === '.')) {
      throw new Error('Access outside repository is denied (path traversal rejected).')
    }
  }

  const resolvedRepoRoot = path.resolve(repoPath)
  const rootReal = fs.existsSync(resolvedRepoRoot)
    ? fs.realpathSync(resolvedRepoRoot)
    : resolvedRepoRoot

  const candidatePath = normalizedRelPath
    ? path.resolve(rootReal, normalizedRelPath)
    : rootReal

  // Verify the resolved candidate stays within rootReal (including cross-drive check on Windows)
  const relFromRoot = path.relative(rootReal, candidatePath)
  if (
    relFromRoot.startsWith('..') ||
    path.isAbsolute(relFromRoot)
  ) {
    throw new Error('Access outside repository is denied.')
  }

  // If target or its parent already exists on disk, verify realpath doesn't escape via symlink
  const existingProbe = fs.existsSync(candidatePath)
    ? candidatePath
    : fs.existsSync(path.dirname(candidatePath))
      ? path.dirname(candidatePath)
      : null

  if (existingProbe) {
    const realProbe = fs.realpathSync(existingProbe)
    const relReal = path.relative(rootReal, realProbe)
    if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
      throw new Error('Access outside repository is denied (symlink escape rejected).')
    }
  }

  // Hardening: never allow repo tools to read or write NoteIT's SQLite database or backup directory
  const baseNameLower = path.basename(candidatePath).toLowerCase()
  if (
    baseNameLower === 'noteit-v2.db' ||
    baseNameLower === 'noteit-v2.db-wal' ||
    baseNameLower === 'noteit-v2.db-shm'
  ) {
    throw new Error('Access to NoteIT internal database files is denied.')
  }

  const activeDbPath = getDbPath()
  if (activeDbPath) {
    const dbDirResolved = path.resolve(path.dirname(activeDbPath))
    const resolvedCandidate = path.resolve(candidatePath)
    if (
      resolvedCandidate.toLowerCase() === activeDbPath.toLowerCase() ||
      resolvedCandidate.toLowerCase().startsWith((dbDirResolved + path.sep).toLowerCase())
    ) {
      throw new Error('Access to NoteIT internal storage directory is denied.')
    }
  }

  return {
    rootReal,
    targetPath: candidatePath,
    normalizedRelPath
  }
}

/**
 * Runs a git command with array arguments (safe from shell injection).
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
 * Local repository folder picker dialog.
 */
export async function pickRepoFolder(
  window: BrowserWindow | null,
  defaultPath?: string
): Promise<{ canceled: boolean; path?: string; isGitRepo: boolean; branch?: string }> {
  if (!window) return { canceled: true, isGitRepo: false }

  const result = await dialog.showOpenDialog(window, {
    title: 'Choose Project Repository Folder',
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
 * Parses git status --porcelain output (XY PATH).
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

    if (filePath.includes(' -> ')) {
      filePath = filePath.split(' -> ')[1]
    }

    // Strip surrounding quotes if git quoted a path
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1)
    }

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
 * Git status summary for repoPath.
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
 * Lazily reads one directory level for Repo Explorer.
 */
export async function readRepoDirectory(
  repoPath: string,
  relPath: string = ''
): Promise<RepoEntry[]> {
  const { targetPath: targetDir, normalizedRelPath } = resolveSafeRepoFilePath(
    repoPath,
    relPath,
    true
  )

  if (!fs.existsSync(targetDir)) {
    return []
  }

  const gitStatusRes = await runGitCommand(['status', '--porcelain', '-uall'], repoPath)
  const gitMap = parseGitPorcelainOutput(gitStatusRes.stdout)

  const rawEntries = fs.readdirSync(targetDir, { withFileTypes: true })
  const result: RepoEntry[] = []

  for (const entry of rawEntries) {
    if (entry.isDirectory() && IGNORED_DIR_NAMES.has(entry.name)) {
      continue
    }

    const itemRelPath = normalizedRelPath
      ? `${normalizedRelPath}/${entry.name}`.replace(/\\/g, '/')
      : entry.name
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

  result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  return result
}

function isLikelyBinaryBuffer(buf: Buffer): boolean {
  const sampleLen = Math.min(buf.length, 8000)
  for (let i = 0; i < sampleLen; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

/**
 * Reads a text file from the repository (with optional 1-based line range).
 */
export async function readRepoFile(
  repoPath: string,
  relPath: string,
  options?: { startLine?: number; endLine?: number }
): Promise<{ content: string; language: string; size: number; totalLines: number }> {
  const { targetPath: fullPath, normalizedRelPath } = resolveSafeRepoFilePath(repoPath, relPath)

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${normalizedRelPath}`)
  }

  const stat = fs.statSync(fullPath)
  if (stat.isDirectory()) {
    throw new Error(`Path is a directory, not a file: ${normalizedRelPath}`)
  }

  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`File size exceeds 2MB limit (${Math.round(stat.size / 1024)} KB).`)
  }

  const rawBuf = fs.readFileSync(fullPath)
  if (isLikelyBinaryBuffer(rawBuf)) {
    throw new Error(`Binary file cannot be opened as text: ${normalizedRelPath}`)
  }

  const fullText = rawBuf.toString('utf-8')
  const allLines = fullText.split(/\r?\n/)
  let content = fullText

  if (options?.startLine !== undefined || options?.endLine !== undefined) {
    const start = Math.max(1, options.startLine ?? 1)
    const end = Math.min(allLines.length, Math.max(start, options.endLine ?? allLines.length))
    content = allLines.slice(start - 1, end).join('\n')
  }

  const ext = path.extname(fullPath)
  const language = mapExtensionToLanguage(ext)

  return {
    content,
    language,
    size: stat.size,
    totalLines: allLines.length
  }
}

function normalizeLineEndings(str: string): string {
  return str.replace(/\r\n/g, '\n')
}

function countLineDiffStats(headContent: string, workingContent: string): {
  additions: number
  deletions: number
} {
  const normHead = normalizeLineEndings(headContent)
  const normWorking = normalizeLineEndings(workingContent)
  if (normHead === normWorking) return { additions: 0, deletions: 0 }
  const headLines = normHead ? normHead.split('\n') : []
  const workingLines = normWorking ? normWorking.split('\n') : []

  const headCounts = new Map<string, number>()
  for (const line of headLines) {
    headCounts.set(line, (headCounts.get(line) ?? 0) + 1)
  }

  let shared = 0
  for (const line of workingLines) {
    const c = headCounts.get(line) ?? 0
    if (c > 0) {
      shared++
      headCounts.set(line, c - 1)
    }
  }

  return {
    additions: Math.max(0, workingLines.length - shared),
    deletions: Math.max(0, headLines.length - shared)
  }
}

/**
 * Computes HEAD vs Working Tree content & diff metadata for `RepoDiffInspectorPane`.
 */
export async function getFileGitDiff(
  repoPath: string,
  relPath: string
): Promise<RepoFileDiffResult> {
  const { targetPath: fullPath, normalizedRelPath } = resolveSafeRepoFilePath(repoPath, relPath)
  const language = mapExtensionToLanguage(path.extname(fullPath))

  let workingContent = ''
  let isBinary = false
  const existsOnDisk = fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()

  if (existsOnDisk) {
    const stat = fs.statSync(fullPath)
    if (stat.size > 2 * 1024 * 1024) {
      throw new Error(`File size exceeds 2MB limit (${Math.round(stat.size / 1024)} KB).`)
    }
    const buf = fs.readFileSync(fullPath)
    if (isLikelyBinaryBuffer(buf)) {
      isBinary = true
    } else {
      workingContent = buf.toString('utf-8')
    }
  }

  // Retrieve HEAD version via `git show HEAD:<relPath>`
  let headContent = ''
  try {
    const { stdout } = await execFileAsync('git', ['show', `HEAD:${normalizedRelPath}`], {
      cwd: repoPath,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    })
    headContent = stdout
  } catch {
    // Untracked or newly added file not yet in HEAD
    headContent = ''
  }

  const statusRes = await runGitCommand(
    ['status', '--porcelain', '-uall', '--', normalizedRelPath],
    repoPath
  )
  const statusMap = parseGitPorcelainOutput(statusRes.stdout)
  const normHead = normalizeLineEndings(headContent)
  const normWorking = normalizeLineEndings(workingContent)
  let status: GitFileStatus | 'clean' = statusMap.get(normalizedRelPath) || 'clean'
  if (status === 'clean' && normHead !== normWorking) {
    status = normHead === '' ? 'untracked' : existsOnDisk ? 'modified' : 'deleted'
  }

  const stats = isBinary
    ? { additions: 0, deletions: 0 }
    : countLineDiffStats(normHead, normWorking)

  return {
    relPath: normalizedRelPath,
    headContent: normHead,
    workingContent: normWorking,
    language,
    isBinary,
    status,
    additions: stats.additions,
    deletions: stats.deletions
  }
}

/**
 * Atomically writes UTF-8 content to a file inside `repoPath` (write temp file + rename).
 */
export async function writeRepoFile(
  repoPath: string,
  relPath: string,
  content: string
): Promise<{ ok: boolean; relPath: string; size: number }> {
  const { targetPath: fullPath, normalizedRelPath } = resolveSafeRepoFilePath(repoPath, relPath)
  const parentDir = path.dirname(fullPath)
  fs.mkdirSync(parentDir, { recursive: true })

  const tempPath = `${fullPath}.noteit-tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tempPath, content, 'utf-8')
  fs.renameSync(tempPath, fullPath)

  const stat = fs.statSync(fullPath)
  return {
    ok: true,
    relPath: normalizedRelPath,
    size: stat.size
  }
}

/**
 * Discards uncommitted working-tree changes for a single file inside `repoPath`.
 * Tracked files are restored from HEAD; untracked files are removed.
 */
export async function discardRepoFileChanges(
  repoPath: string,
  relPath: string
): Promise<{ ok: boolean; relPath: string }> {
  const { targetPath: fullPath, normalizedRelPath } = resolveSafeRepoFilePath(repoPath, relPath)

  const trackedCheck = await runGitCommand(
    ['ls-files', '--error-unmatch', '--', normalizedRelPath],
    repoPath
  )

  if (trackedCheck.exitCode === 0) {
    const checkoutRes = await runGitCommand(['checkout', 'HEAD', '--', normalizedRelPath], repoPath)
    if (checkoutRes.exitCode !== 0) {
      throw new Error(checkoutRes.stderr || `Failed to discard changes for ${normalizedRelPath}`)
    }
  } else if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { force: true })
  }

  return { ok: true, relPath: normalizedRelPath }
}

/**
 * Fast bounded code search across repository files (excluding IGNORED_DIR_NAMES and binary files).
 */
export async function searchRepoCode(
  repoPath: string,
  query: string,
  options?: { filePattern?: string; maxResults?: number }
): Promise<RepoSearchMatch[]> {
  const { rootReal } = resolveSafeRepoFilePath(repoPath, '', true)
  const trimmedQuery = query.trim()
  if (!trimmedQuery || !fs.existsSync(rootReal)) return []

  const maxResults = Math.min(Math.max(options?.maxResults ?? 40, 1), 200)
  const lowerQuery = trimmedQuery.toLowerCase()
  const patternFilter = options?.filePattern?.trim().toLowerCase()
  const matches: RepoSearchMatch[] = []

  const walk = (currentDir: string, relPrefix: string): void => {
    if (matches.length >= maxResults) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (matches.length >= maxResults) return
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        if (IGNORED_DIR_NAMES.has(entry.name)) continue
        walk(path.join(currentDir, entry.name), relPath)
        continue
      }

      if (!entry.isFile()) continue
      if (patternFilter && !relPath.toLowerCase().includes(patternFilter)) continue

      const fullPath = path.join(currentDir, entry.name)
      let stat: fs.Stats
      try {
        stat = fs.statSync(fullPath)
      } catch {
        continue
      }
      if (stat.size > 512 * 1024) continue

      let buf: Buffer
      try {
        buf = fs.readFileSync(fullPath)
      } catch {
        continue
      }
      if (isLikelyBinaryBuffer(buf)) continue

      const text = buf.toString('utf-8')
      const lines = text.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i]
        const colIdx = lineText.toLowerCase().indexOf(lowerQuery)
        if (colIdx !== -1) {
          matches.push({
            relPath,
            line: i + 1,
            column: colIdx + 1,
            preview: lineText.trim().slice(0, 200)
          })
          if (matches.length >= maxResults) return
        }
      }
    }
  }

  walk(rootReal, '')
  return matches
}
