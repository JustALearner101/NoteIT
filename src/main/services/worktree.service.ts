import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '../db/client'
import { runGitCommand } from './repo.service'
import type { AgentSessionRecord, AgentSessionStatus } from '@shared/types/domain'

export interface WorktreeCreationResult {
  worktreePath: string
  branchName: string
  junctionsCreated: string[]
  envFilesCopied: string[]
}

/**
 * Pemetaan baris tabel agent_sessions ke tipe domain AgentSessionRecord.
 */
function mapRowToSession(row: any): AgentSessionRecord {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    sectionId: row.section_id || null,
    pageId: row.page_id || null,
    taskCode: row.task_code || null,
    title: row.title,
    agentPreset: row.agent_preset,
    command: row.command,
    approvalMode: row.approval_mode as AgentSessionRecord['approvalMode'],
    isolationMode: row.isolation_mode as AgentSessionRecord['isolationMode'],
    repoPath: row.repo_path,
    worktreePath: row.worktree_path || null,
    branchName: row.branch_name || null,
    status: row.status as AgentSessionStatus,
    filesChanged: row.files_changed || 0,
    linesAdded: row.lines_added || 0,
    linesRemoved: row.lines_removed || 0,
    lastOutputTail: row.last_output_tail || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/* ========================================================================== */
/* SQLite Agent Sessions Repository                                           */
/* ========================================================================== */

export function insertAgentSession(session: AgentSessionRecord): void {
  getDb()
    .prepare(
      `INSERT INTO agent_sessions (
        id, notebook_id, section_id, page_id, task_code, title,
        agent_preset, command, approval_mode, isolation_mode,
        repo_path, worktree_path, branch_name, status,
        files_changed, lines_added, lines_removed, last_output_tail,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      session.id,
      session.notebookId,
      session.sectionId || null,
      session.pageId || null,
      session.taskCode || null,
      session.title,
      session.agentPreset,
      session.command,
      session.approvalMode,
      session.isolationMode,
      session.repoPath,
      session.worktreePath || null,
      session.branchName || null,
      session.status,
      session.filesChanged,
      session.linesAdded,
      session.linesRemoved,
      session.lastOutputTail,
      session.createdAt,
      session.updatedAt
    )
}

export function updateAgentSession(id: string, patch: Partial<AgentSessionRecord>): void {
  const sets: string[] = ['updated_at = ?']
  const values: any[] = [Date.now()]

  if (patch.status !== undefined) {
    sets.push('status = ?')
    values.push(patch.status)
  }
  if (patch.filesChanged !== undefined) {
    sets.push('files_changed = ?')
    values.push(patch.filesChanged)
  }
  if (patch.linesAdded !== undefined) {
    sets.push('lines_added = ?')
    values.push(patch.linesAdded)
  }
  if (patch.linesRemoved !== undefined) {
    sets.push('lines_removed = ?')
    values.push(patch.linesRemoved)
  }
  if (patch.lastOutputTail !== undefined) {
    sets.push('last_output_tail = ?')
    values.push(patch.lastOutputTail)
  }

  values.push(id)
  getDb()
    .prepare(`UPDATE agent_sessions SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values)
}

export function findAgentSessionById(id: string): AgentSessionRecord | null {
  const row = getDb().prepare('SELECT * FROM agent_sessions WHERE id = ?').get(id)
  return row ? mapRowToSession(row) : null
}

export function listAgentSessions(notebookId?: string): AgentSessionRecord[] {
  let query = 'SELECT * FROM agent_sessions'
  const params: any[] = []
  if (notebookId) {
    query += ' WHERE notebook_id = ?'
    params.push(notebookId)
  }
  query += ' ORDER BY created_at DESC'

  const rows = getDb().prepare(query).all(...params)
  return rows.map(mapRowToSession)
}

export function deleteAgentSession(id: string): void {
  getDb().prepare('DELETE FROM agent_sessions WHERE id = ?').run(id)
}

/* ========================================================================== */
/* Git Worktree & NTFS Junction Engine                                        */
/* ========================================================================== */

/**
 * Menghitung direktori target worktree (berada di folder sibling).
 */
export function resolveWorktreePath(repoPath: string, slug: string): string {
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
  const repoName = path.basename(repoPath)
  const parentDir = path.dirname(repoPath)
  return path.join(parentDir, `${repoName}-worktrees`, cleanSlug)
}

/**
 * Auto-bootstrap dependensi via NTFS Directory Junction di Windows (<5ms, 0 byte disk).
 */
export function bootstrapWorktreeEnvironment(
  mainRepoPath: string,
  worktreePath: string
): { junctions: string[]; copiedEnvs: string[] } {
  const junctions: string[] = []
  const copiedEnvs: string[] = []

  const linkTargets = ['node_modules', '.venv', 'venv']
  for (const name of linkTargets) {
    const mainTarget = path.join(mainRepoPath, name)
    const wtTarget = path.join(worktreePath, name)

    if (fs.existsSync(mainTarget) && !fs.existsSync(wtTarget)) {
      try {
        const linkType = process.platform === 'win32' ? 'junction' : 'dir'
        fs.symlinkSync(mainTarget, wtTarget, linkType)
        junctions.push(name)
      } catch (err) {
        console.warn(`[worktree.service] Gagal membuat junction untuk ${name}:`, err)
      }
    }
  }

  // Salin file environment (.env*)
  const envCandidates = ['.env', '.env.local', '.env.development', '.env.test']
  for (const envFile of envCandidates) {
    const mainEnv = path.join(mainRepoPath, envFile)
    const wtEnv = path.join(worktreePath, envFile)
    if (fs.existsSync(mainEnv) && !fs.existsSync(wtEnv)) {
      try {
        fs.copyFileSync(mainEnv, wtEnv)
        copiedEnvs.push(envFile)
      } catch (err) {
        console.warn(`[worktree.service] Gagal menyalin ${envFile}:`, err)
      }
    }
  }

  return { junctions, copiedEnvs }
}

/**
 * ATURAN KESELAMATAN WAJIB:
 * Lepas (unlink) semua junction sebelum folder worktree dihapus,
 * agar isi node_modules di repo utama tidak ikut terhapus!
 */
export function safeUnlinkJunctions(worktreePath: string): string[] {
  const unlinked: string[] = []
  const linkTargets = ['node_modules', '.venv', 'venv']

  for (const name of linkTargets) {
    const targetPath = path.join(worktreePath, name)
    try {
      if (fs.existsSync(targetPath)) {
        const stat = fs.lstatSync(targetPath)
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(targetPath)
          unlinked.push(name)
        }
      }
    } catch (err) {
      console.warn(`[worktree.service] Gagal melepas junction ${name}:`, err)
    }
  }

  return unlinked
}

/**
 * Membuat Git Worktree baru yang terisolasi.
 */
export async function createIsolatedWorktree(
  repoPath: string,
  branchName: string,
  slug?: string
): Promise<WorktreeCreationResult> {
  const worktreePath = resolveWorktreePath(repoPath, slug || branchName)
  const worktreeDir = path.dirname(worktreePath)
  fs.mkdirSync(worktreeDir, { recursive: true })

  // Cek apakah cabang sudah ada
  const branchCheck = await runGitCommand(['branch', '--list', branchName], repoPath)
  const branchExists = Boolean(branchCheck.stdout.trim())

  const gitArgs = branchExists
    ? ['worktree', 'add', worktreePath, branchName]
    : ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD']

  const addRes = await runGitCommand(gitArgs, repoPath)
  if (addRes.exitCode !== 0) {
    throw new Error(`Gagal membuat git worktree: ${addRes.stderr || addRes.stdout}`)
  }

  // Auto-bootstrap environment
  const { junctions, copiedEnvs } = bootstrapWorktreeEnvironment(repoPath, worktreePath)

  return {
    worktreePath,
    branchName,
    junctionsCreated: junctions,
    envFilesCopied: copiedEnvs
  }
}

/**
 * Menggabungkan (merge) pekerjaan worktree kembali ke cabang utama repo.
 */
export async function mergeWorktreeToMain(
  sessionId: string,
  commitMessage?: string
): Promise<{ ok: boolean; error?: string }> {
  const session = findAgentSessionById(sessionId)
  if (!session || !session.worktreePath || !session.branchName) {
    return { ok: false, error: 'Sesi worktree tidak ditemukan.' }
  }

  const { repoPath, worktreePath, branchName } = session

  // 1. Cek perubahan uncommitted di worktree
  const statusRes = await runGitCommand(['status', '--porcelain'], worktreePath)
  if (statusRes.stdout.trim().length > 0) {
    await runGitCommand(['add', '-A'], worktreePath)
    const commitMsg = commitMessage || `feat(${session.taskCode || 'ADE'}): ${session.title}`
    await runGitCommand(['commit', '-m', commitMsg], worktreePath)
  }

  // 2. Di repo utama, lakukan merge --no-ff
  const mergeRes = await runGitCommand(['merge', '--no-ff', branchName], repoPath)
  if (mergeRes.exitCode !== 0) {
    updateAgentSession(sessionId, { status: 'failed' })
    return {
      ok: false,
      error: `Konflik merge terdeteksi di cabang utama: ${mergeRes.stderr || mergeRes.stdout}`
    }
  }

  // 3. Lepas junction dengan aman dan hapus worktree
  safeUnlinkJunctions(worktreePath)
  await runGitCommand(['worktree', 'remove', worktreePath], repoPath)

  updateAgentSession(sessionId, { status: 'merged' })
  return { ok: true }
}

/**
 * Membatalkan & menghapus worktree terisolasi secara aman.
 */
export async function discardWorktreeSession(
  sessionId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = findAgentSessionById(sessionId)
  if (!session) {
    return { ok: false, error: 'Sesi agen tidak ditemukan.' }
  }

  if (session.worktreePath && fs.existsSync(session.worktreePath)) {
    // WAJIB: Lepas junction terlebih dahulu sebelum git worktree remove!
    safeUnlinkJunctions(session.worktreePath)
    await runGitCommand(['worktree', 'remove', '--force', session.worktreePath], session.repoPath)
    if (session.branchName) {
      await runGitCommand(['branch', '-D', session.branchName], session.repoPath)
    }
  }

  deleteAgentSession(sessionId)
  return { ok: true }
}
