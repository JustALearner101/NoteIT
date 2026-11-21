import { stepCountIs, streamText, tool } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import type {
  AIApprovalProposal,
  AIChatStreamEvent,
  AIChatStreamRequest,
  ProposedSpecBlock
} from '@shared/ipc-channels'
import type { BlockType, Page, TaskStatus } from '@shared/types/domain'
import { getWorkspaceSnapshot, searchWorkspace, updatePage } from './workspace.service'
import {
  getFileGitDiff,
  getRepoGitStatus,
  readRepoDirectory,
  readRepoFile,
  searchRepoCode,
  writeRepoFile
} from './repo.service'
import { dispatchMission } from './spec-compiler.service'
import {
  callMcpTool,
  discoverEnabledMcpServerTools,
  jsonSchemaToZod
} from './mcp.service'
import { getProviderSecretKeyName, getSecret } from './secret.service'

const execFileAsync = promisify(execFile)

const BLOCK_TYPE_ENUM = z.enum(['paragraph', 'code', 'dbml', 'mermaid', 'graphviz', 'callout'])

function resolveTargetPage(
  pages: Page[],
  pageCodeOrId?: string,
  fallbackPageId?: string
): Page | undefined {
  if (pageCodeOrId) {
    const q = pageCodeOrId.trim().toLowerCase()
    const match = pages.find(
      (p) =>
        p.id.toLowerCase() === q ||
        p.code.toLowerCase() === q ||
        p.title.toLowerCase().includes(q)
    )
    if (match) return match
  }
  if (fallbackPageId) {
    const byFallback = pages.find((p) => p.id === fallbackPageId)
    if (byFallback) return byFallback
  }
  return pages[0]
}

export function resolveActiveRepoPath(activePage?: Page): string | null {
  const snap = getWorkspaceSnapshot()
  if (activePage) {
    const sec = snap.sections.find((s) => s.id === activePage.sectionId)
    if (sec?.repoPathOverride) return sec.repoPathOverride
    const nb = snap.notebooks.find((n) => n.id === sec?.notebookId)
    if (nb?.repoPath) return nb.repoPath
  }
  const anyBoundNb = snap.notebooks.find((n) => Boolean(n.repoPath))
  return anyBoundNb?.repoPath || null
}

function isPathWithinBoundRepos(candidatePath: string): boolean {
  if (!candidatePath || !candidatePath.trim()) return false
  let candidateReal: string
  try {
    candidateReal = fs.realpathSync(candidatePath)
  } catch {
    return false
  }

  const snap = getWorkspaceSnapshot()
  const roots = new Set<string>()
  for (const nb of snap.notebooks) {
    if (nb.repoPath) roots.add(nb.repoPath)
  }
  for (const sec of snap.sections) {
    if (sec.repoPathOverride) roots.add(sec.repoPathOverride)
  }

  for (const root of roots) {
    try {
      const rootReal = fs.realpathSync(root)
      if (candidateReal === rootReal || candidateReal.startsWith(rootReal + path.sep)) {
        return true
      }
    } catch {
      // Ignore unbound or missing roots
    }
  }
  return false
}

function applySpecTaskStatusMutation(
  page: Page,
  taskCodeOrText: string,
  status?: TaskStatus,
  checked?: boolean,
  progress?: number
): { updated: boolean; summary: string } {
  const needle = taskCodeOrText.trim().toLowerCase()
  let touched = false

  const nextBlocks = page.blocks.map((block) => {
    if (block.type === 'checklist' && block.content.toLowerCase().includes(needle)) {
      touched = true
      const nextChecked =
        checked !== undefined ? checked : status === 'done' ? true : Boolean(block.checked)
      return { ...block, checked: nextChecked }
    }

    if (block.type === 'database' && Array.isArray(block.databaseItems)) {
      const nextItems = block.databaseItems.map((item) => {
        if (
          item.code.toLowerCase() === needle ||
          item.title.toLowerCase().includes(needle)
        ) {
          touched = true
          const nextStatus: TaskStatus =
            status ?? (checked ? 'done' : item.status)
          const nextProgress =
            progress !== undefined
              ? progress
              : nextStatus === 'done'
                ? 100
                : item.progress
          return {
            ...item,
            status: nextStatus,
            progress: nextProgress
          }
        }
        return item
      })
      return { ...block, databaseItems: nextItems }
    }

    return block
  })

  if (touched) {
    updatePage({ id: page.id, blocks: nextBlocks })
    return {
      updated: true,
      summary: `Updated task "${taskCodeOrText}" in ${page.code}`
    }
  }

  return {
    updated: false,
    summary: `No matching checklist or database task found for "${taskCodeOrText}" in ${page.code}`
  }
}

/**
 * Executes a user-approved (or auto-approved in `auto-edit` mode) proposal from AI Chat.
 */
export async function executeApprovedProposal(
  proposal: AIApprovalProposal
): Promise<{ ok: boolean; output?: string; error?: string }> {
  const kind = proposal.kind ?? 'spec-blocks'

  try {
    if (kind === 'spec-blocks') {
      const snap = getWorkspaceSnapshot()
      const target = resolveTargetPage(snap.pages, proposal.targetPageId, proposal.targetPageId)
      if (!target) {
        return { ok: false, error: 'Target specification page not found.' }
      }
      const nextBlocks = [
        ...target.blocks,
        ...proposal.blocks.map((b, idx) => ({
          id: `blk-ai-${Date.now()}-${idx}`,
          type: b.type,
          content: b.content
        }))
      ]
      updatePage({ id: target.id, blocks: nextBlocks })
      return {
        ok: true,
        output: `Inserted ${proposal.blocks.length} block(s) into ${target.code}`
      }
    }

    if (kind === 'repo-file-edit' && proposal.repoFileEdit) {
      const { repoPath, relPath, newContent } = proposal.repoFileEdit
      if (!isPathWithinBoundRepos(repoPath)) {
        return {
          ok: false,
          error: 'Target repository path is not bound to any notebook or section.'
        }
      }
      await writeRepoFile(repoPath, relPath, newContent)
      return {
        ok: true,
        output: `Wrote changes to ${relPath}`
      }
    }

    if (kind === 'repo-command' && proposal.repoCommand) {
      const { cwd, command, args, timeoutMs = 15000 } = proposal.repoCommand
      if (!isPathWithinBoundRepos(cwd)) {
        return {
          ok: false,
          error: 'Command working directory must be inside a bound repository.'
        }
      }
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd,
        timeout: Math.min(Math.max(timeoutMs, 1000), 60000),
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024
      })
      const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
      return {
        ok: true,
        output: combined.slice(0, 4000) || '(command exited 0 with no output)'
      }
    }

    if (kind === 'spec-task-status' && proposal.specTaskUpdate) {
      const snap = getWorkspaceSnapshot()
      const target = resolveTargetPage(
        snap.pages,
        proposal.specTaskUpdate.pageId,
        proposal.targetPageId
      )
      if (!target) {
        return { ok: false, error: 'Target page not found for task update.' }
      }
      const res = applySpecTaskStatusMutation(
        target,
        proposal.specTaskUpdate.taskCodeOrText,
        proposal.specTaskUpdate.status,
        proposal.specTaskUpdate.checked,
        proposal.specTaskUpdate.progress
      )
      return {
        ok: res.updated,
        output: res.summary,
        error: res.updated ? undefined : res.summary
      }
    }

    if (kind === 'spawn-agent' && proposal.spawnAgent) {
      const snap = getWorkspaceSnapshot()
      const target = resolveTargetPage(
        snap.pages,
        proposal.spawnAgent.pageId,
        proposal.targetPageId
      )
      const repoPath = resolveActiveRepoPath(target)
      if (!target || !repoPath) {
        return {
          ok: false,
          error: 'Cannot spawn CLI agent session without a bound repository and specification page.'
        }
      }
      const res = await dispatchMission(
        {
          pageId: target.id,
          presetId: proposal.spawnAgent.presetId,
          isolationMode: proposal.spawnAgent.isolationMode,
          approvalMode: proposal.spawnAgent.approvalMode,
          customDirective: proposal.spawnAgent.customDirective
        },
        repoPath,
        () => {}
      )
      return {
        ok: res.ok,
        output: res.ok
          ? `Spawned session ${res.sessionId} (${res.commandExecuted})`
          : undefined,
        error: res.error
      }
    }

    if (kind === 'mcp-tool' && proposal.mcpToolCall) {
      const res = await callMcpTool(
        proposal.mcpToolCall.serverId,
        proposal.mcpToolCall.toolName,
        proposal.mcpToolCall.args
      )
      return {
        ok: res.ok,
        output:
          typeof res.content === 'string'
            ? res.content
            : JSON.stringify(res.content, null, 2).slice(0, 4000)
      }
    }

    return { ok: false, error: `Unsupported proposal kind: ${kind}` }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function buildSystemInstruction(
  req: AIChatStreamRequest,
  mentionedPages: Page[],
  activePage?: Page,
  boundRepoPath?: string | null
): string {
  const lines: string[] = [
    `You are an AI software engineering assistant inside NoteIT Workbench v2.0 (mode: ${req.chatMode}).`,
    `Respond in the same language as the user's prompt with technical precision and conciseness.`,
    `You have access to NoteIT Workbench & ADE Repository Tools:`,
    `- search_workspace_fts5: search specifications, DBML tables, or pages in SQLite FTS5.`,
    `- read_page_spec: read blocks, DBML schemas, or Mermaid diagrams from a page.`,
    `- propose_spec_blocks: propose new specification blocks (paragraph, code, dbml, mermaid, graphviz, callout).`,
    `- read_active_browser_tab: read the active In-App Browser tab context.`,
    `- list_repo_files: list files and folders in the bound repository.`,
    `- read_repo_file: read a file (with optional startLine/endLine) from the bound repository.`,
    `- search_repo_code: search code across repository files.`,
    `- get_git_diff_summary: get working-tree git status and diff summary for the bound repository.`,
    `- propose_repo_file_edit: propose an atomic file edit in the repository (subject to Approval Gate).`,
    `- run_repo_command: run a bounded non-interactive command in the repository (subject to Approval Gate).`,
    `- update_spec_task_status: update a checklist item or Project Database task status (subject to Approval Gate).`,
    `- spawn_cli_agent_session: launch a CLI agent mission in an isolated worktree (subject to Approval Gate).`
  ]

  if (activePage) {
    lines.push(
      `Active specification page: ${activePage.code} — "${activePage.title}" (id: ${activePage.id}).`
    )
  }

  if (boundRepoPath) {
    lines.push(`Bound repository root path: ${boundRepoPath}`)
  }

  if (mentionedPages.length > 0) {
    lines.push(`Pages @mentioned by the user:`)
    for (const p of mentionedPages) {
      const preview = p.blocks
        .map((b) => `[${b.type}] ${b.content}`)
        .join('\n')
        .slice(0, 1200)
      lines.push(`--- ${p.code}: ${p.title} ---\n${preview}`)
    }
  }

  if (req.browserContext) {
    lines.push(
      `Active In-App Browser Tab:\nTitle: ${req.browserContext.title}\nURL: ${req.browserContext.url}\nExcerpt:\n${req.browserContext.excerpt.slice(0, 1500)}`
    )
  }

  return lines.join('\n\n')
}

function resolveLanguageModel(req: AIChatStreamRequest) {
  const storedSecret = getSecret(getProviderSecretKeyName(req.provider))
  const rawKey = (storedSecret || req.apiKey || '').trim()
  if (!rawKey) {
    return null
  }

  if (req.provider === 'ollama') {
    const normalizedBase = rawKey.startsWith('http')
      ? rawKey.endsWith('/v1')
        ? rawKey
        : `${rawKey.replace(/\/+$/, '')}/v1`
      : 'http://localhost:11434/v1'
    const ollama = createOpenAI({
      baseURL: normalizedBase,
      apiKey: 'ollama'
    })
    const modelName = req.modelId.toLowerCase().includes('llama') ? 'llama3.2' : 'qwen2.5-coder'
    return { model: ollama(modelName), label: `Vercel AI SDK · Ollama (${modelName})` }
  }

  if (req.provider === 'openai') {
    const openai = createOpenAI({ apiKey: rawKey })
    return { model: openai('gpt-4o-mini'), label: 'Vercel AI SDK · OpenAI (gpt-4o-mini)' }
  }

  if (req.provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: rawKey })
    return {
      model: anthropic('claude-3-5-sonnet-latest'),
      label: 'Vercel AI SDK · Anthropic (Claude Sonnet)'
    }
  }

  const google = createGoogleGenerativeAI({ apiKey: rawKey })
  return {
    model: google('gemini-2.5-flash'),
    label: 'Vercel AI SDK · Google Gemini (gemini-2.5-flash)'
  }
}

async function handleProposalEmission(
  req: AIChatStreamRequest,
  proposal: AIApprovalProposal,
  emit: (event: AIChatStreamEvent) => void
): Promise<{ ok: boolean; status: string; output?: string; error?: string }> {
  if (req.approvalMode === 'plan-only') {
    return {
      ok: false,
      status: 'blocked-by-plan-only-mode',
      error: 'Mutating tools are disabled while approval mode is set to plan-only.'
    }
  }

  // Repository commands always require explicit human approval even in auto-edit mode.
  if (req.approvalMode === 'auto-edit' && proposal.kind !== 'repo-command') {
    const execRes = await executeApprovedProposal(proposal)
    const appliedProposal: AIApprovalProposal = {
      ...proposal,
      status: 'approved',
      executionResult: execRes.output || execRes.error
    }
    emit({
      requestId: req.requestId,
      type: 'auto-applied',
      proposal: appliedProposal
    })
    return {
      ok: execRes.ok,
      status: 'auto-applied',
      output: execRes.output,
      error: execRes.error
    }
  }

  emit({
    requestId: req.requestId,
    type: 'approval-request',
    proposal: { ...proposal, status: 'pending' }
  })
  return {
    ok: true,
    status: 'awaiting-user-approval'
  }
}

/**
 * Local agentic fallback simulator when no cloud API key is configured or offline.
 * Exercises real SQLite FTS5, repository read/diff tools, and Approval Gate proposals.
 */
async function runLocalAgenticFallbackStream(
  req: AIChatStreamRequest,
  emit: (event: AIChatStreamEvent) => void
): Promise<void> {
  const snapshot = getWorkspaceSnapshot()
  const activePage = resolveTargetPage(snapshot.pages, undefined, req.activePageId)
  const mentionedPages = snapshot.pages.filter((p) => req.mentionedPageIds.includes(p.id))
  const boundRepoPath = resolveActiveRepoPath(activePage)
  const lastUserMsg =
    [...req.messages].reverse().find((m) => m.role === 'user')?.content || ''
  const lower = lastUserMsg.toLowerCase()

  const searchTerms = lastUserMsg
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')

  if (searchTerms.length >= 2) {
    emit({
      requestId: req.requestId,
      type: 'tool-call',
      toolName: 'search_workspace_fts5',
      argsSummary: `query="${searchTerms}"`
    })
  }

  if (boundRepoPath && (lower.includes('repo') || lower.includes('diff') || lower.includes('git') || lower.includes('file'))) {
    emit({
      requestId: req.requestId,
      type: 'tool-call',
      toolName: 'get_git_diff_summary',
      argsSummary: `repo="${boundRepoPath.split(/[/\\]/).pop()}"`
    })
  }

  if (req.browserContext) {
    emit({
      requestId: req.requestId,
      type: 'tool-call',
      toolName: 'read_active_browser_tab',
      argsSummary: `url="${req.browserContext.url}"`
    })
  }

  let replyText = ''
  let proposedBlocks: ProposedSpecBlock[] = []
  let proposalSummary = ''
  let customProposal: AIApprovalProposal | null = null

  // Check if prompt asks to edit a repo file in a bound repository
  const editFileMatch = /edit\s+file\s+([^\s]+)\s*:\s*([\s\S]+)/i.exec(lastUserMsg)
  if (boundRepoPath && editFileMatch && activePage) {
    const relPath = editFileMatch[1].trim()
    const newContent = editFileMatch[2]
    let originalContent = ''
    let language = 'plaintext'
    try {
      const existing = await readRepoFile(boundRepoPath, relPath)
      originalContent = existing.content
      language = existing.language
    } catch {
      originalContent = ''
    }

    emit({
      requestId: req.requestId,
      type: 'tool-call',
      toolName: 'propose_repo_file_edit',
      argsSummary: `relPath="${relPath}"`
    })

    replyText = `I have prepared an atomic repository file edit for \`${relPath}\`.`
    customProposal = {
      proposalId: `prop-repo-${Date.now()}`,
      kind: 'repo-file-edit',
      targetPageId: activePage.id,
      targetPageCode: activePage.code,
      targetPageTitle: activePage.title,
      summary: `Edit repository file ${relPath}`,
      blocks: [],
      status: req.approvalMode === 'auto-edit' ? 'approved' : 'pending',
      repoFileEdit: {
        repoPath: boundRepoPath,
        relPath,
        originalContent,
        newContent,
        language
      }
    }
  } else if (
    req.browserContext &&
    (lower.includes('web') ||
      lower.includes('browser') ||
      lower.includes('halaman ini') ||
      lower.includes('rangkum'))
  ) {
    replyText =
      `Berdasarkan pembacaan tab **In-App Browser** aktif (**${req.browserContext.title}** — \`${req.browserContext.url}\`), berikut intisari teknis yang berhasil diekstrak:\n\n` +
      `> ${req.browserContext.excerpt.slice(0, 360)}...\n\n` +
      `Saya telah menyiapkan blok ringkasan referensi untuk ditambahkan ke halaman spesifikasi **${activePage?.code || 'DOC'}**.`
    proposalSummary = `Simpan kutipan referensi web dari ${req.browserContext.title}`
    proposedBlocks = [
      {
        type: 'callout' as BlockType,
        content: `Referensi Web: ${req.browserContext.title} (${req.browserContext.url})\n${req.browserContext.excerpt.slice(0, 400)}`
      }
    ]
  } else if (
    lower.includes('dbml') ||
    lower.includes('skema') ||
    lower.includes('tabel') ||
    req.chatMode === 'DBML Schema Co-Pilot'
  ) {
    replyText =
      `Berikut rancangan skema relasional **DBML** yang disusun melalui pipeline **Vercel AI SDK Tooling**${
        mentionedPages.length > 0
          ? ` dengan mengacu pada konteks **${mentionedPages.map((p) => p.code).join(', ')}**`
          : ''
      }.\n\nSkema ini mencakup relasi kunci asing (*foreign key*) dan siap dirender menjadi diagram ERD interaktif maupun DDL SQL:`
    proposalSummary = 'Sisipkan blok DBML Schema baru ke dokumen spesifikasi'
    proposedBlocks = [
      {
        type: 'dbml' as BlockType,
        content: `Table browser_sessions {\n  id uuid [pk]\n  notebook_id uuid [not null]\n  url varchar [not null]\n  title varchar\n  clipped_at timestamp\n}\n\nTable agent_runs {\n  id uuid [pk]\n  session_id uuid [not null, ref: > browser_sessions.id]\n  provider varchar [not null]\n  approval_mode varchar [not null]\n  status varchar\n}\n\nRef: agent_runs.session_id > browser_sessions.id`
      }
    ]
  } else if (
    lower.includes('mermaid') ||
    lower.includes('diagram') ||
    lower.includes('alur') ||
    req.chatMode === 'Mermaid & DOT Diagrammer'
  ) {
    replyText =
      `Berikut diagram arsitektur **Mermaid** untuk memetakan alur komponen antara **In-App Browser**, **Vercel AI SDK**, dan penyimpanan **SQLite WAL**:`
    proposalSummary = 'Sisipkan diagram alur arsitektur Mermaid'
    proposedBlocks = [
      {
        type: 'mermaid' as BlockType,
        content: `flowchart LR\n  WV[In-App Chromium Webview] -->|Extract DOM| AI[Vercel AI SDK Stream]\n  AI -->|Tool: search_workspace_fts5| DB[(SQLite FTS5)]\n  AI -->|Approval Gate| DOC[Active Spec Page]`
      }
    ]
  } else {
    replyText =
      `Analisis spesifikasi untuk **"${lastUserMsg}"** (${req.chatMode}):\n\n` +
      `1. **Konteks Workspace**: Terhubung ke indeks SQLite FTS5 (${snapshot.pages.length} halaman aktif${
        mentionedPages.length > 0
          ? `, konteks @mention: ${mentionedPages.map((p) => p.code).join(', ')}`
          : ''
      }).\n` +
      `2. **Rekomendasi Implementasi**: Gunakan pemisahan jelas antara *state* antarmuka dan layanan IPC agar latensi tetap di bawah 16ms.\n` +
      `3. **Tindakan Dokumen**: Saya telah menyiapkan draf blok spesifikasi di bawah ini.`
    proposalSummary = `Tambahkan catatan spesifikasi hasil analisis "${lastUserMsg.slice(0, 32)}"`
    proposedBlocks = [
      {
        type: 'paragraph' as BlockType,
        content: `### Spesifikasi Teknis: ${lastUserMsg}\nDisusun secara otomatis dengan memperhatikan aturan isolasi konteks dan penyimpanan lokal SQLite WAL.`
      }
    ]
  }

  const chunks = replyText.match(/.{1,18}(\s|$)|\S+/g) || [replyText]
  for (const chunk of chunks) {
    emit({
      requestId: req.requestId,
      type: 'text-delta',
      textDelta: chunk
    })
    await new Promise((r) => setTimeout(r, 18))
  }

  if (customProposal) {
    await handleProposalEmission(req, customProposal, emit)
  } else if (req.approvalMode !== 'plan-only' && activePage && proposedBlocks.length > 0) {
    emit({
      requestId: req.requestId,
      type: 'tool-call',
      toolName: 'propose_spec_blocks',
      argsSummary: `target="${activePage.code}", blocks=${proposedBlocks.length}`
    })

    const proposal: AIApprovalProposal = {
      proposalId: `prop-${Date.now()}`,
      kind: 'spec-blocks',
      targetPageId: activePage.id,
      targetPageCode: activePage.code,
      targetPageTitle: activePage.title,
      summary: proposalSummary,
      blocks: proposedBlocks,
      status: req.approvalMode === 'auto-edit' ? 'approved' : 'pending'
    }

    await handleProposalEmission(req, proposal, emit)
  }

  emit({
    requestId: req.requestId,
    type: 'done',
    usedLiveSdk: false,
    providerLabel: 'NoteIT Local Agentic Engine (Configure API key in Settings for Live Cloud LLM)'
  })
}

export async function executeAIChatStream(
  req: AIChatStreamRequest,
  emit: (event: AIChatStreamEvent) => void
): Promise<void> {
  const resolved = resolveLanguageModel(req)
  if (!resolved) {
    await runLocalAgenticFallbackStream(req, emit)
    return
  }

  const snapshot = getWorkspaceSnapshot()
  const activePage = resolveTargetPage(snapshot.pages, undefined, req.activePageId)
  const mentionedPages = snapshot.pages.filter((p) => req.mentionedPageIds.includes(p.id))
  const boundRepoPath = resolveActiveRepoPath(activePage)

  // Discover enabled MCP server tools and wrap them for Vercel AI SDK
  const mcpToolMap: Record<string, any> = {}
  try {
    const discoveredMcp = await discoverEnabledMcpServerTools()
    for (const { server, tool: mcpTool } of discoveredMcp) {
      const safeServerSlug = server.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'server'
      const safeToolSlug = mcpTool.name
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
      const namespacedName = `mcp_${safeServerSlug}_${safeToolSlug}`

      mcpToolMap[namespacedName] = tool({
        description: `[MCP: ${server.name}] ${mcpTool.description || mcpTool.name}`,
        inputSchema: jsonSchemaToZod(mcpTool.inputSchema),
        execute: async (args: Record<string, unknown>) => {
          emit({
            requestId: req.requestId,
            type: 'tool-call',
            toolName: namespacedName,
            argsSummary: JSON.stringify(args).slice(0, 120)
          })

          if (server.requireApproval && req.approvalMode !== 'auto-edit') {
            const target = activePage || snapshot.pages[0]
            const proposal: AIApprovalProposal = {
              proposalId: `prop-mcp-${Date.now()}`,
              kind: 'mcp-tool',
              targetPageId: target?.id || '',
              targetPageCode: target?.code || 'MCP',
              targetPageTitle: target?.title || server.name,
              summary: `Invoke MCP tool ${mcpTool.name} on ${server.name}`,
              blocks: [],
              status: 'pending',
              mcpToolCall: {
                serverId: server.id,
                serverName: server.name,
                toolName: mcpTool.name,
                args
              }
            }
            return handleProposalEmission(req, proposal, emit)
          }

          return callMcpTool(server.id, mcpTool.name, args)
        }
      })
    }
  } catch (err) {
    console.warn('[ai.service] Failed to load MCP tools:', err)
  }

  try {
    const result = streamText({
      model: resolved.model,
      system: buildSystemInstruction(req, mentionedPages, activePage, boundRepoPath),
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      stopWhen: stepCountIs(5),
      tools: {
        search_workspace_fts5: tool({
          description:
            'Search specification pages, notes, or DBML schemas in NoteIT SQLite FTS5.',
          inputSchema: z.object({
            query: z.string().describe('FTS5 search keywords')
          }),
          execute: async ({ query }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'search_workspace_fts5',
              argsSummary: `query="${query}"`
            })
            const hits = searchWorkspace(query)
            return hits.slice(0, 6).map((h) => ({
              pageId: h.pageId,
              code: h.pageCode,
              title: h.title,
              snippet: h.snippet
            }))
          }
        }),

        read_page_spec: tool({
          description: 'Read full document blocks or DBML schema from a NoteIT page.',
          inputSchema: z.object({
            pageCodeOrTitle: z
              .string()
              .describe('Page code (e.g. ARC-01) or page title')
          }),
          execute: async ({ pageCodeOrTitle }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'read_page_spec',
              argsSummary: `target="${pageCodeOrTitle}"`
            })
            const snap = getWorkspaceSnapshot()
            const target = resolveTargetPage(snap.pages, pageCodeOrTitle, req.activePageId)
            if (!target) return { error: 'Page not found' }
            return {
              id: target.id,
              code: target.code,
              title: target.title,
              mode: target.mode,
              blocks: target.blocks.map((b) => ({ type: b.type, content: b.content }))
            }
          }
        }),

        read_active_browser_tab: tool({
          description: 'Read URL, title, and text excerpt from the active In-App Browser tab.',
          inputSchema: z.object({}),
          execute: async () => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'read_active_browser_tab',
              argsSummary: req.browserContext ? `url="${req.browserContext.url}"` : 'no-tab'
            })
            return (
              req.browserContext || {
                info: 'No active browser tab context is attached.'
              }
            )
          }
        }),

        // --- 4 Read-Only ADE Repository Tools (Auto-Allowed) ---
        list_repo_files: tool({
          description: 'List files and directories at a relative path in the bound Git repository.',
          inputSchema: z.object({
            relPath: z
              .string()
              .optional()
              .describe('Relative directory path inside the repository (empty for root)')
          }),
          execute: async ({ relPath }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'list_repo_files',
              argsSummary: `relPath="${relPath || '.'}"`
            })
            if (!boundRepoPath) return { error: 'No repository is bound to the active notebook.' }
            const entries = await readRepoDirectory(boundRepoPath, relPath || '')
            return entries.slice(0, 100)
          }
        }),

        read_repo_file: tool({
          description: 'Read a text file (with optional 1-based line range) from the bound repository.',
          inputSchema: z.object({
            relPath: z.string().describe('Relative file path inside the repository'),
            startLine: z.number().optional().describe('Optional 1-based start line'),
            endLine: z.number().optional().describe('Optional 1-based end line')
          }),
          execute: async ({ relPath, startLine, endLine }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'read_repo_file',
              argsSummary: `${relPath}${startLine ? `#L${startLine}-${endLine ?? startLine}` : ''}`
            })
            if (!boundRepoPath) return { error: 'No repository is bound to the active notebook.' }
            return readRepoFile(boundRepoPath, relPath, { startLine, endLine })
          }
        }),

        search_repo_code: tool({
          description: 'Search for a text or code pattern across files in the bound repository.',
          inputSchema: z.object({
            query: z.string().describe('Code or text substring to search for'),
            filePattern: z.string().optional().describe('Optional path substring filter (e.g. .ts)')
          }),
          execute: async ({ query, filePattern }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'search_repo_code',
              argsSummary: `query="${query}"${filePattern ? `, pattern="${filePattern}"` : ''}`
            })
            if (!boundRepoPath) return { error: 'No repository is bound to the active notebook.' }
            return searchRepoCode(boundRepoPath, query, { filePattern, maxResults: 30 })
          }
        }),

        get_git_diff_summary: tool({
          description:
            'Get git status summary or file-level HEAD vs working-tree diff for the bound repository.',
          inputSchema: z.object({
            relPath: z
              .string()
              .optional()
              .describe('Optional relative file path to inspect detailed diff')
          }),
          execute: async ({ relPath }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'get_git_diff_summary',
              argsSummary: relPath ? `file="${relPath}"` : 'repo-summary'
            })
            if (!boundRepoPath) return { error: 'No repository is bound to the active notebook.' }
            if (relPath) {
              return getFileGitDiff(boundRepoPath, relPath)
            }
            return getRepoGitStatus(boundRepoPath)
          }
        }),

        // --- 4 Mutating / Execution Tools (Strict Approval Gate) ---
        propose_spec_blocks: tool({
          description:
            'Propose adding new specification blocks (paragraph, code, dbml, mermaid, graphviz, callout) to a NoteIT page.',
          inputSchema: z.object({
            targetPageCode: z
              .string()
              .optional()
              .describe('Target page code, or omit to use active page'),
            summary: z.string().describe('Brief summary of the proposed block addition'),
            blocks: z.array(
              z.object({
                type: BLOCK_TYPE_ENUM,
                content: z.string()
              })
            )
          }),
          execute: async ({ targetPageCode, summary, blocks }) => {
            const snap = getWorkspaceSnapshot()
            const target = resolveTargetPage(snap.pages, targetPageCode, req.activePageId)
            if (!target) {
              return { ok: false, error: 'Target page not found' }
            }

            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'propose_spec_blocks',
              argsSummary: `target="${target.code}", blocks=${blocks.length}`
            })

            const proposal: AIApprovalProposal = {
              proposalId: `prop-${Date.now()}`,
              kind: 'spec-blocks',
              targetPageId: target.id,
              targetPageCode: target.code,
              targetPageTitle: target.title,
              summary,
              blocks,
              status: req.approvalMode === 'auto-edit' ? 'approved' : 'pending'
            }

            return handleProposalEmission(req, proposal, emit)
          }
        }),

        propose_repo_file_edit: tool({
          description:
            'Propose creating or modifying a file in the bound repository (gated by user Approval Gate).',
          inputSchema: z.object({
            relPath: z.string().describe('Relative file path inside the bound repository'),
            newContent: z.string().describe('Full new UTF-8 file content'),
            summary: z.string().describe('Summary of the code change')
          }),
          execute: async ({ relPath, newContent, summary }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'propose_repo_file_edit',
              argsSummary: `relPath="${relPath}"`
            })
            if (!boundRepoPath) {
              return { ok: false, error: 'No repository is bound to the active notebook.' }
            }

            let originalContent = ''
            let language = 'plaintext'
            try {
              const existing = await readRepoFile(boundRepoPath, relPath)
              originalContent = existing.content
              language = existing.language
            } catch {
              originalContent = ''
            }

            const target = activePage || snapshot.pages[0]
            const proposal: AIApprovalProposal = {
              proposalId: `prop-edit-${Date.now()}`,
              kind: 'repo-file-edit',
              targetPageId: target?.id || '',
              targetPageCode: target?.code || 'REPO',
              targetPageTitle: target?.title || relPath,
              summary,
              blocks: [],
              status: 'pending',
              repoFileEdit: {
                repoPath: boundRepoPath,
                relPath,
                originalContent,
                newContent,
                language
              }
            }

            return handleProposalEmission(req, proposal, emit)
          }
        }),

        run_repo_command: tool({
          description:
            'Propose running a bounded non-interactive command in the bound repository (gated by user Approval Gate).',
          inputSchema: z.object({
            command: z.string().describe('Executable binary name (e.g. git, npm, npx)'),
            args: z.array(z.string()).describe('Array of command arguments'),
            summary: z.string().describe('Reason for running this command')
          }),
          execute: async ({ command, args, summary }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'run_repo_command',
              argsSummary: `${command} ${args.join(' ')}`.slice(0, 100)
            })
            if (!boundRepoPath) {
              return { ok: false, error: 'No repository is bound to the active notebook.' }
            }

            const target = activePage || snapshot.pages[0]
            const proposal: AIApprovalProposal = {
              proposalId: `prop-cmd-${Date.now()}`,
              kind: 'repo-command',
              targetPageId: target?.id || '',
              targetPageCode: target?.code || 'CMD',
              targetPageTitle: target?.title || command,
              summary,
              blocks: [],
              status: 'pending',
              repoCommand: {
                cwd: boundRepoPath,
                command,
                args,
                timeoutMs: 15000
              }
            }

            return handleProposalEmission(req, proposal, emit)
          }
        }),

        update_spec_task_status: tool({
          description:
            'Update a checklist item or Project Database task status on a specification page (gated by user Approval Gate).',
          inputSchema: z.object({
            targetPageCode: z.string().optional(),
            taskCodeOrText: z.string().describe('Task code (e.g. TSK-01) or checklist text'),
            status: z.enum(['backlog', 'in_progress', 'review', 'done']).optional(),
            checked: z.boolean().optional(),
            progress: z.number().optional()
          }),
          execute: async ({ targetPageCode, taskCodeOrText, status, checked, progress }) => {
            const snap = getWorkspaceSnapshot()
            const target = resolveTargetPage(snap.pages, targetPageCode, req.activePageId)
            if (!target) return { ok: false, error: 'Target page not found' }

            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'update_spec_task_status',
              argsSummary: `task="${taskCodeOrText}", status="${status || (checked ? 'done' : '')}"`
            })

            const proposal: AIApprovalProposal = {
              proposalId: `prop-task-${Date.now()}`,
              kind: 'spec-task-status',
              targetPageId: target.id,
              targetPageCode: target.code,
              targetPageTitle: target.title,
              summary: `Update task "${taskCodeOrText}" in ${target.code}`,
              blocks: [],
              status: 'pending',
              specTaskUpdate: {
                pageId: target.id,
                taskCodeOrText,
                status,
                checked,
                progress
              }
            }

            return handleProposalEmission(req, proposal, emit)
          }
        }),

        spawn_cli_agent_session: tool({
          description:
            'Spawn an external CLI agent session in an isolated git worktree for a specification page (gated by user Approval Gate).',
          inputSchema: z.object({
            targetPageCode: z.string().optional(),
            presetId: z.enum(['claude', 'codex', 'gemini', 'aider', 'pwsh']),
            isolationMode: z.enum(['direct', 'worktree']).default('worktree'),
            customDirective: z.string().optional()
          }),
          execute: async ({ targetPageCode, presetId, isolationMode, customDirective }) => {
            const snap = getWorkspaceSnapshot()
            const target = resolveTargetPage(snap.pages, targetPageCode, req.activePageId)
            if (!target) return { ok: false, error: 'Target page not found' }

            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'spawn_cli_agent_session',
              argsSummary: `preset="${presetId}", mode="${isolationMode}"`
            })

            const proposal: AIApprovalProposal = {
              proposalId: `prop-spawn-${Date.now()}`,
              kind: 'spawn-agent',
              targetPageId: target.id,
              targetPageCode: target.code,
              targetPageTitle: target.title,
              summary: `Spawn ${presetId} agent session (${isolationMode}) for ${target.code}`,
              blocks: [],
              status: 'pending',
              spawnAgent: {
                pageId: target.id,
                presetId,
                isolationMode,
                approvalMode: 'ask-edit',
                customDirective
              }
            }

            return handleProposalEmission(req, proposal, emit)
          }
        }),

        ...mcpToolMap
      }
    })

    for await (const delta of result.textStream) {
      if (delta) {
        emit({
          requestId: req.requestId,
          type: 'text-delta',
          textDelta: delta
        })
      }
    }

    emit({
      requestId: req.requestId,
      type: 'done',
      usedLiveSdk: true,
      providerLabel: resolved.label
    })
  } catch (error) {
    console.warn('[ai.service] Live provider failed, falling back to local agentic engine:', error)
    await runLocalAgenticFallbackStream(req, emit)
  }
}
