import fs from 'node:fs'
import path from 'node:path'
import { parseDBML, generateSQLFromDBML } from '@shared/dbml-parser'
import type {
  DispatchMissionInput,
  DispatchMissionResult,
  DocumentBlock,
  Page,
  ProjectTaskItem,
  SpecBundleFile,
  SpecBundleSummary
} from '@shared/types/domain'
import { getWorkspaceSnapshot, updatePage } from './workspace.service'
import { createTerminalSession, type TerminalEventCallback } from './terminal.service'
import {
  createIsolatedWorktree,
  insertAgentSession,
  type WorktreeCreationResult
} from './worktree.service'

/** Watcher cache agar tidak memasang watcher ganda pada folder yang sama */
const activeWatchers = new Map<string, fs.FSWatcher>()

/**
 * Memastikan folder .noteit/ masuk ke .git/info/exclude lokal (Zero Git Pollution).
 */
export function ensureLocalGitExclude(repoPath: string): void {
  try {
    const gitDir = path.join(repoPath, '.git')
    if (!fs.existsSync(gitDir)) return

    const infoDir = path.join(gitDir, 'info')
    if (!fs.existsSync(infoDir)) {
      fs.mkdirSync(infoDir, { recursive: true })
    }

    const excludePath = path.join(infoDir, 'exclude')
    let currentContent = ''
    if (fs.existsSync(excludePath)) {
      currentContent = fs.readFileSync(excludePath, 'utf-8')
    }

    const pattern = '.noteit/'
    if (!currentContent.split(/\r?\n/).some((line) => line.trim() === pattern)) {
      const addition = currentContent.endsWith('\n') || currentContent.length === 0
        ? '# NoteIT ADE Agent Artifacts (auto-generated)\n.noteit/\n'
        : '\n# NoteIT ADE Agent Artifacts (auto-generated)\n.noteit/\n'
      fs.appendFileSync(excludePath, addition, 'utf-8')
    }
  } catch (error) {
    console.warn('[spec-compiler] Gagal mendaftarkan .noteit/ ke .git/info/exclude:', error)
  }
}

/**
 * Menyusun isi berkas active-task.md yang kaya konteks untuk dibaca agen CLI.
 */
export function generateActiveTaskMarkdown(page: Page, repoPath: string): string {
  const lines: string[] = [
    `# KONTRAK TUGAS REKAYASA: ${page.code} · ${page.title}`,
    `> Dokumen ini dikompilasi secara otomatis oleh **NoteIT Workbench v2.0 (ADE Engine)**.`,
    `> Repositori Kerja: \`${repoPath}\``,
    `> Terakhir Diperbarui: ${new Date(page.updatedAt).toISOString()}`,
    '',
    '## 1. Intisari Spesifikasi & Kebutuhan Teknis',
    ''
  ]

  let checklistIndex = 1
  const checklists: { index: number; content: string; checked: boolean }[] = []
  const tasks: ProjectTaskItem[] = []

  for (const block of page.blocks || []) {
    if (block.type === 'paragraph') {
      lines.push(block.content, '')
    } else if (block.type === 'callout') {
      lines.push(`> [!NOTE] ${block.calloutTitle || 'CATATAN ARSITEKTUR'}`)
      lines.push(`> ${block.content.replace(/\n/g, '\n> ')}`, '')
    } else if (block.type === 'toggle') {
      lines.push(`### ${block.toggleTitle || 'Detail Teknis'}`)
      lines.push(block.content, '')
    } else if (block.type === 'divider') {
      lines.push('---', '')
    } else if (block.type === 'code') {
      lines.push(`\`\`\`${block.language || 'text'}\n${block.content}\n\`\`\``, '')
    } else if (block.type === 'checklist') {
      checklists.push({
        index: checklistIndex++,
        content: block.content,
        checked: Boolean(block.checked)
      })
    } else if (block.type === 'database' && block.databaseItems?.length) {
      tasks.push(...block.databaseItems)
    }
  }

  if (tasks.length > 0) {
    lines.push('## 2. Daftar Tugas Rekayasa (Project Tasks)', '')
    lines.push('| Kode | Judul Sub-Tugas | Status | Assignee | Estimasi (Jam) |')
    lines.push('| :--- | :--- | :--- | :--- | :--- |')
    for (const t of tasks) {
      lines.push(`| **${t.code}** | ${t.title} | \`${t.status.toUpperCase()}\` | ${t.assignee || '-'} | ${t.estimateHours || 0}h |`)
    }
    lines.push('')
  }

  if (checklists.length > 0) {
    lines.push('## 3. Kriteria Penerimaan & Verifikasi (Checklists)', '')
    for (const c of checklists) {
      lines.push(`- [${c.checked ? 'x' : ' '}] ${c.content}`)
    }
    lines.push('')
  }

  lines.push(
    '## 4. Panduan Eksekusi untuk Agen AI',
    '1. Bacalah skema database di `.noteit/schema.sql` dan diagram arsitektur di `.noteit/architecture.mmd` sebagai acuan desain sistem.',
    '2. Jaga integritas kode yang ada: pertahankan komentar, struktur tipe, dan aturan linting proyek.',
    '3. Jalankan pengujian atau typecheck sebelum menyatakan tugas selesai.',
    '4. **Sinkronisasi Balik Dua Arah (Two-Way Sync)**: Ketika sub-tugas selesai atau berubah status, perbarui berkas `.noteit/status-update.json` dengan format:',
    '```json',
    '{',
    '  "tasks": [{ "code": "TSK-01", "status": "done" }],',
    '  "agentNotes": "Ringkasan berkas yang diubah..."',
    '}',
    '```',
    ''
  )

  return lines.join('\n')
}

/**
 * Menghasilkan SQL DDL dari seluruh blok DBML di halaman tersebut.
 */
export function compileDBMLBlocksToSQL(blocks: DocumentBlock[]): string {
  const dbmlBlocks = blocks.filter((b) => b.type === 'dbml' && b.content?.trim())
  if (dbmlBlocks.length === 0) {
    return '-- Tidak ada blok skema DBML pada spesifikasi ini.\n'
  }

  const chunks: string[] = [
    '-- ==========================================================================',
    '-- NoteIT ADE: Skema Database Relasional (Kompilasi Otomatis dari DBML)',
    `-- Dihasilkan pada: ${new Date().toISOString()}`,
    '-- ==========================================================================\n'
  ]

  for (const block of dbmlBlocks) {
    const parsed = parseDBML(block.content)
    if (parsed.errors.length > 0) {
      chunks.push(`-- Peringatan Parser DBML: ${parsed.errors.map((e) => e.message).join('; ')}`)
    }
    chunks.push(generateSQLFromDBML(parsed, 'sqlite'))
  }

  return chunks.join('\n')
}

/**
 * Mengompilasi diagram Mermaid / DOT ke architecture.mmd.
 */
export function compileDiagramBlocks(blocks: DocumentBlock[]): string {
  const diagramBlocks = blocks.filter(
    (b) => (b.type === 'mermaid' || b.type === 'graphviz') && b.content?.trim()
  )
  if (diagramBlocks.length === 0) {
    return '%% Tidak ada diagram arsitektur pada spesifikasi ini.\n'
  }

  const chunks: string[] = [
    '%% NoteIT ADE: Diagram Arsitektur & Topologi Sistem',
    `%% Dihasilkan pada: ${new Date().toISOString()}\n`
  ]

  for (const block of diagramBlocks) {
    chunks.push(`%% --- Tipe Diagram: ${block.type} ---`)
    chunks.push(block.content, '')
  }

  return chunks.join('\n')
}

/**
 * Memasang watcher pada .noteit/status-update.json untuk Two-Way Sync.
 */
export function setupTwoWaySyncWatcher(
  pageId: string,
  targetCwd: string,
  onSyncUpdated?: (page: Page) => void
): void {
  const noteitDir = path.join(targetCwd, '.noteit')
  const statusFile = path.join(noteitDir, 'status-update.json')
  if (activeWatchers.has(statusFile)) return

  try {
    if (!fs.existsSync(statusFile)) {
      fs.mkdirSync(noteitDir, { recursive: true })
      fs.writeFileSync(statusFile, JSON.stringify({ tasks: [], agentNotes: '' }, null, 2), 'utf-8')
    }
    const watcher = fs.watch(statusFile, { persistent: false }, () => {
      try {
        if (!fs.existsSync(statusFile)) return
        const raw = fs.readFileSync(statusFile, 'utf-8').trim()
        if (!raw) return

        const payload = JSON.parse(raw) as {
          tasks?: { code: string; status: ProjectTaskItem['status'] }[]
          agentNotes?: string
        }

        const snapshot = getWorkspaceSnapshot()
        const targetPage = snapshot.pages.find((p) => p.id === pageId)
        if (!targetPage) return

        let hasChanges = false
        const nextBlocks = targetPage.blocks.map((block) => {
          if (block.type === 'database' && block.databaseItems && payload.tasks?.length) {
            const nextItems = block.databaseItems.map((item) => {
              const update = payload.tasks?.find((u) => u.code.toLowerCase() === item.code.toLowerCase())
              if (update && update.status !== item.status) {
                hasChanges = true
                return { ...item, status: update.status }
              }
              return item
            })
            return { ...block, databaseItems: nextItems }
          }
          return block
        })

        if (hasChanges) {
          updatePage({ id: pageId, blocks: nextBlocks })
          const updatedPage = { ...targetPage, blocks: nextBlocks }
          onSyncUpdated?.(updatedPage)
        }
      } catch (err) {
        console.warn('[spec-compiler] Gagal memproses update status-update.json:', err)
      }
    })

    activeWatchers.set(statusFile, watcher)
  } catch {
    // Best-effort watcher
  }
}

export function closeAllSpecWatchers(): void {
  for (const watcher of activeWatchers.values()) {
    try {
      watcher.close()
    } catch {
      // Best-effort cleanup
    }
  }
  activeWatchers.clear()
}

/**
 * Kompilasi bundel lengkap .noteit/ di dalam repo/worktree.
 */
export function compileSpecBundle(pageId: string, targetCwd: string): SpecBundleSummary {
  const snapshot = getWorkspaceSnapshot()
  const page = snapshot.pages.find((p) => p.id === pageId)
  if (!page) {
    throw new Error(`Halaman spesifikasi ${pageId} tidak ditemukan.`)
  }

  const noteitDir = path.join(targetCwd, '.noteit')
  fs.mkdirSync(noteitDir, { recursive: true })

  // Pastikan Zero Git Pollution via local exclude
  ensureLocalGitExclude(targetCwd)

  const activeTaskContent = generateActiveTaskMarkdown(page, targetCwd)
  const schemaSqlContent = compileDBMLBlocksToSQL(page.blocks)
  const architectureContent = compileDiagramBlocks(page.blocks)

  const taskItems: ProjectTaskItem[] = []
  let dbmlTableCount = 0
  let diagramCount = 0

  for (const b of page.blocks) {
    if (b.type === 'database' && b.databaseItems) taskItems.push(...b.databaseItems)
    if (b.type === 'dbml' && b.content) {
      const parsed = parseDBML(b.content)
      dbmlTableCount += parsed.tables.length
    }
    if (b.type === 'mermaid' || b.type === 'graphviz') diagramCount++
  }

  const contractContent = JSON.stringify(
    {
      pageId: page.id,
      pageCode: page.code,
      pageTitle: page.title,
      taskCount: taskItems.length,
      tasks: taskItems,
      updatedAt: Date.now()
    },
    null,
    2
  )

  const filesToCreate: { filename: string; content: string; description: string }[] = [
    {
      filename: 'active-task.md',
      content: activeTaskContent,
      description: 'Kompilasi spesifikasi, konteks PRD, dan checklist tugas'
    },
    {
      filename: 'schema.sql',
      content: schemaSqlContent,
      description: 'DDL SQL relasional hasil kompilasi dari blok DBML'
    },
    {
      filename: 'architecture.mmd',
      content: architectureContent,
      description: 'Diagram arsitektur & alur sistem (Mermaid/Graphviz)'
    },
    {
      filename: 'task-contract.json',
      content: contractContent,
      description: 'Metadata kontrak tugas terstruktur untuk integrasi agen'
    }
  ]

  const bundleFiles: SpecBundleFile[] = []

  for (const item of filesToCreate) {
    const filePath = path.join(noteitDir, item.filename)
    fs.writeFileSync(filePath, item.content, 'utf-8')
    bundleFiles.push({
      filename: item.filename,
      relPath: `.noteit/${item.filename}`,
      size: Buffer.byteLength(item.content, 'utf-8'),
      description: item.description
    })
  }

  // Siapkan berkas status-update.json default jika belum ada
  const statusFile = path.join(noteitDir, 'status-update.json')
  if (!fs.existsSync(statusFile)) {
    fs.writeFileSync(
      statusFile,
      JSON.stringify({ tasks: [], agentNotes: '' }, null, 2),
      'utf-8'
    )
  }

  // Pasang watcher sinkronisasi dua arah
  setupTwoWaySyncWatcher(page.id, targetCwd)

  return {
    pageId: page.id,
    pageCode: page.code,
    pageTitle: page.title,
    targetDir: targetCwd,
    files: bundleFiles,
    taskCount: taskItems.length,
    dbmlTableCount,
    diagramCount
  }
}

/**
 * Menghasilkan perintah CLI dan prompt satu baris untuk preset yang dipilih.
 */
export function generateMissionExecutionCommand(
  presetId: DispatchMissionInput['presetId'],
  approvalMode: DispatchMissionInput['approvalMode'],
  customDirective?: string
): { command: string; args: string[]; promptText: string } {
  let promptText =
    'Bacalah spesifikasi teknis di .noteit/active-task.md dan skema di .noteit/schema.sql. Implementasikan solusinya dengan rapi.'
  if (customDirective?.trim()) {
    promptText += ` Arahan tambahan: ${customDirective.trim()}`
  }

  switch (presetId) {
    case 'claude': {
      const args: string[] = []
      if (approvalMode === 'plan-only') args.push('--permission-mode', 'plan')
      else if (approvalMode === 'auto-edit') args.push('--dangerously-skip-permissions')
      return { command: 'claude', args, promptText }
    }
    case 'codex': {
      const args: string[] = []
      if (approvalMode === 'plan-only') args.push('--ask-for-approval', 'untrusted')
      else if (approvalMode === 'auto-edit') args.push('--full-auto')
      return { command: 'codex', args, promptText }
    }
    case 'gemini': {
      const args: string[] = []
      if (approvalMode === 'auto-edit') args.push('--yolo')
      return { command: 'gemini', args, promptText }
    }
    case 'aider': {
      const args: string[] = []
      if (approvalMode === 'plan-only') args.push('--architect')
      else if (approvalMode === 'auto-edit') args.push('--yes-always')
      return { command: 'aider', args, promptText }
    }
    case 'pwsh':
      return { command: 'powershell.exe', args: [], promptText }
    case 'cmd':
      return { command: 'cmd.exe', args: [], promptText }
    case 'bash':
      return { command: 'bash', args: [], promptText }
    default:
      return { command: 'powershell.exe', args: [], promptText }
  }
}

/**
 * Meluncurkan misi agen: kompilasi bundel .noteit/ dan buka sesi PTY dengan prompt handoff.
 */
export async function dispatchMission(
  input: DispatchMissionInput,
  repoPath: string,
  onTerminalEvent: TerminalEventCallback
): Promise<DispatchMissionResult> {
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Folder repositori ${repoPath} tidak ditemukan.`)
  }

  const snapshot = getWorkspaceSnapshot()
  const targetPage = snapshot.pages.find((p) => p.id === input.pageId)
  const targetSec = snapshot.sections.find((s) => s.id === targetPage?.sectionId)
  const notebookId = targetSec?.notebookId || snapshot.notebooks[0]?.id || ''

  let targetCwd = repoPath
  let worktreeInfo: WorktreeCreationResult | null = null

  // 1. Jika mode worktree, buat cabang & folder terisolasi (+ auto-junction node_modules)
  if (input.isolationMode === 'worktree') {
    const branchName = input.worktreeBranch || `feat/${input.pageId}`
    worktreeInfo = await createIsolatedWorktree(repoPath, branchName)
    targetCwd = worktreeInfo.worktreePath
  }

  // 2. Kompilasi artefak spesifikasi ke .noteit/ di direktori kerja
  compileSpecBundle(input.pageId, targetCwd)

  // 3. Susun perintah eksekusi
  const { command, args, promptText } = generateMissionExecutionCommand(
    input.presetId,
    input.approvalMode,
    input.customDirective
  )

  // 4. Buat sesi terminal PTY di direktori kerja
  const sessionTitle = `${input.presetId.toUpperCase()}: ${targetPage?.code || input.pageId}`
  const termRes = createTerminalSession(
    {
      cwd: targetCwd,
      command,
      args,
      title: sessionTitle,
      cliPresetId: input.presetId
    },
    onTerminalEvent
  )

  // 5. Simpan rekaman sesi ke database SQLite agent_sessions
  insertAgentSession({
    id: termRes.sessionId,
    notebookId,
    sectionId: targetPage?.sectionId || null,
    pageId: targetPage?.id || null,
    taskCode: targetPage?.code || null,
    title: targetPage?.title || input.pageId,
    agentPreset: input.presetId,
    command: `${command} ${args.join(' ')}`.trim(),
    approvalMode: input.approvalMode,
    isolationMode: input.isolationMode,
    repoPath,
    worktreePath: worktreeInfo?.worktreePath || null,
    branchName: worktreeInfo?.branchName || null,
    status: 'idle',
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0,
    lastOutputTail: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  })

  return {
    ok: true,
    sessionId: termRes.sessionId,
    cwd: targetCwd,
    branchName: worktreeInfo?.branchName,
    commandExecuted: `${command} ${args.join(' ')}`.trim()
  }
}
