import { generateText, Output, stepCountIs, ToolLoopAgent, tool } from 'ai'
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
import type { AIAttachment, AIProviderKind, BlockType, Page, TaskStatus } from '@shared/types/domain'
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
import {
  getModelSlots,
  getProviderProfileById,
  resolveExecutionTarget
} from './provider.service'
import { resolveFallbackTarget, wrapWithReasoningMiddleware } from './ai-middleware'
import {
  buildIntelligentUiSystemPrompt,
  extractOpenUiArtifact,
  routePresentationMode,
  type RoutedPresentation
} from './ui-router.service'
import { redactSecrets } from './secret.service'
import { hybridSemanticSearch } from './embedding.service'
import { executeCliBridgeStream } from './cli-bridge/cli-bridge.service'
import type { LoopbackMcpToolDefinition } from './cli-bridge/mcp-loopback'

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
  boundRepoPath?: string | null,
  routedUi: RoutedPresentation = 'markdown'
): string {
  const lines: string[] = [
    `You are an AI software engineering & active learning assistant inside NoteIT AI Studio v2.4 (mode: ${req.chatMode}).`,
    `Respond in the same language as the user's prompt with technical precision and conciseness.`,
    `You have access to NoteIT Workbench, Semantic Search, Intelligent UI & ADE Repository Tools:`,
    `- search_workspace_fts5: search specifications, DBML tables, or pages in SQLite FTS5.`,
    `- semantic_search_workspace: hybrid vector + FTS5 semantic search across all NoteIT pages.`,
    `- read_page_spec: read blocks, DBML schemas, or Mermaid diagrams from a page.`,
    `- propose_spec_blocks: propose new specification blocks (paragraph, code, dbml, mermaid, graphviz, callout).`,
    `- render_interactive_widget: stream a self-contained sandboxed HTML/CSS/JS interactive widget (canvas, simulation, custom visualizer).`,
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

  const uiInstruction = buildIntelligentUiSystemPrompt(routedUi)
  if (uiInstruction) {
    lines.push(uiInstruction)
  }

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

  if (req.blockContext) {
    const bc = req.blockContext
    const focusBlockLines = [
      `Pinned Editor Block Context (from ${bc.pageCode}: "${bc.pageTitle}", blockId: ${bc.blockId}, type: ${bc.blockType}):`,
      bc.selectedText ? `Selected excerpt:\n${bc.selectedText.slice(0, 1200)}` : null,
      `Full block content:\n${bc.content.slice(0, 2500)}`
    ].filter(Boolean)
    lines.push(focusBlockLines.join('\n'))
  }

  return lines.join('\n\n')
}

function resolveLanguageModel(req: AIChatStreamRequest) {
  return resolveExecutionTarget({
    provider: req.provider,
    modelId: req.modelId,
    profileId: req.profileId
  })
}

/**
 * Reusable single-shot text completion using the Unified Provider Registry (Primary or Background slot).
 * Used by Learn Workbench (Wave 3) and Knowledge Graph extraction so both work with
 * Custom OpenAI/Anthropic endpoints and Zero-API-Key CLI bridges.
 */
export async function runTextCompletion(params: {
  slot?: 'primary' | 'background'
  system: string
  prompt: string
  providerOverride?: AIProviderKind
  profileIdOverride?: string
  modelIdOverride?: string
}): Promise<{ ok: boolean; text: string; providerLabel: string; usedLiveProvider: boolean }> {
  const slots = getModelSlots()
  const chosenProfileId =
    params.profileIdOverride ||
    (params.slot === 'background' ? slots.backgroundProfileId : slots.primaryProfileId)
  const chosenModelId =
    params.modelIdOverride ||
    (params.slot === 'background' ? slots.backgroundModelId : slots.primaryModelId)

  let provider: AIProviderKind = params.providerOverride || 'gemini'
  if (chosenProfileId.startsWith('builtin:')) {
    provider = chosenProfileId.replace('builtin:', '') as AIProviderKind
  } else {
    const prof = getProviderProfileById(chosenProfileId)
    if (prof) provider = prof.kind
  }

  const target = resolveExecutionTarget({
    provider,
    profileId: chosenProfileId,
    modelId: chosenModelId
  })

  if (!target) {
    return {
      ok: false,
      text: 'No AI provider is configured. Open Settings → AI Providers to connect an API key, custom endpoint, or CLI bridge.',
      providerLabel: 'Unconfigured',
      usedLiveProvider: false
    }
  }

  if (target.mode === 'cli') {
    let accumulated = ''
    let providerLabel = `CLI Bridge · ${target.profile.name}`
    let errMsg = ''
    await executeCliBridgeStream({
      req: {
        requestId: `slot-${Date.now()}`,
        provider: target.profile.kind,
        profileId: chosenProfileId,
        modelId: chosenModelId,
        approvalMode: 'plan-only',
        chatMode: 'Learn & Background',
        messages: [{ role: 'user', content: params.prompt }],
        mentionedPageIds: []
      },
      profile: target.profile,
      systemPrompt: params.system,
      tools: [],
      emit: (ev) => {
        if (ev.type === 'text-delta') accumulated += ev.textDelta
        else if (ev.type === 'done') providerLabel = ev.providerLabel
        else if (ev.type === 'error') errMsg = ev.error
      }
    })
    if (errMsg && !accumulated) {
      return { ok: false, text: errMsg, providerLabel, usedLiveProvider: true }
    }
    return { ok: true, text: accumulated, providerLabel, usedLiveProvider: true }
  }

  try {
    const res = await generateText({
      model: target.model,
      system: params.system,
      prompt: params.prompt
    })
    return {
      ok: true,
      text: res.text,
      providerLabel: target.label,
      usedLiveProvider: true
    }
  } catch (err) {
    return {
      ok: false,
      text: redactSecrets(err instanceof Error ? err.message : String(err)),
      providerLabel: target.label,
      usedLiveProvider: true
    }
  }
}

/**
 * Schema-validated structured object generation using Vercel AI SDK v7 `Output.object()`.
 */
export async function runStructuredObject<T>(params: {
  slot?: 'primary' | 'background'
  system: string
  prompt: string
  schema: z.ZodType<T>
}): Promise<{ ok: boolean; object: T | null; providerLabel: string }> {
  const slots = getModelSlots()
  const chosenProfileId =
    params.slot === 'background' ? slots.backgroundProfileId : slots.primaryProfileId
  const chosenModelId =
    params.slot === 'background' ? slots.backgroundModelId : slots.primaryModelId

  let provider: AIProviderKind = 'gemini'
  if (chosenProfileId.startsWith('builtin:')) {
    provider = chosenProfileId.replace('builtin:', '') as AIProviderKind
  } else {
    const prof = getProviderProfileById(chosenProfileId)
    if (prof) provider = prof.kind
  }

  const target = resolveExecutionTarget({
    provider,
    profileId: chosenProfileId,
    modelId: chosenModelId
  })

  if (!target || target.mode !== 'sdk') {
    return { ok: false, object: null, providerLabel: 'Non-SDK or Unconfigured' }
  }

  try {
    const res = await generateText({
      model: target.model,
      system: params.system,
      prompt: params.prompt,
      output: Output.object({ schema: params.schema as any })
    })
    return {
      ok: true,
      object: (res.output as T) ?? null,
      providerLabel: target.label
    }
  } catch {
    return { ok: false, object: null, providerLabel: target.label }
  }
}

function buildMultimodalMessages(
  messages: AIChatStreamRequest['messages'],
  attachments?: AIAttachment[]
): Array<any> {
  if (!attachments || attachments.length === 0 || messages.length === 0) {
    return messages.map((m) => ({ role: m.role, content: m.content }))
  }
  return messages.map((m, idx) => {
    if (idx !== messages.length - 1 || m.role !== 'user') {
      return { role: m.role, content: m.content }
    }
    const parts: Array<any> = [{ type: 'text', text: m.content }]
    for (const att of attachments) {
      if (att.kind === 'image' && att.dataUrl) {
        parts.push({ type: 'image', image: att.dataUrl })
      } else if (att.dataUrl) {
        parts.push({ type: 'file', data: att.dataUrl, mediaType: att.mime || 'application/pdf' })
      }
    }
    return { role: 'user', content: parts }
  })
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

export async function executeAIChatStream(
  req: AIChatStreamRequest,
  emit: (event: AIChatStreamEvent) => void
): Promise<void> {
  const resolved = resolveLanguageModel(req)
  if (!resolved) {
    emit({
      requestId: req.requestId,
      type: 'error',
      error:
        'No AI provider is configured. Open Settings → AI Providers to connect an API key, custom endpoint, or CLI bridge.'
    })
    return
  }

  const snapshot = getWorkspaceSnapshot()
  const activePage = resolveTargetPage(snapshot.pages, undefined, req.activePageId)
  const mentionedPages = snapshot.pages.filter((p) => req.mentionedPageIds.includes(p.id))
  const boundRepoPath = resolveActiveRepoPath(activePage)
  const lastUserMsg =
    [...req.messages].reverse().find((m) => m.role === 'user')?.content || ''
  const routedUi = routePresentationMode(lastUserMsg, req.uiMode)
  const startedAt = Date.now()

  if (resolved.mode === 'cli') {
    const cliTools: LoopbackMcpToolDefinition[] = [
      {
        name: 'search_workspace_fts5',
        description: 'Search specification pages, notes, or DBML schemas in NoteIT SQLite FTS5.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string', description: 'FTS5 search keywords' } },
          required: ['query']
        },
        execute: async ({ query }) => {
          const q = String(query || '')
          emit({ requestId: req.requestId, type: 'tool-call', toolName: 'search_workspace_fts5', argsSummary: `query="${q}"` })
          return searchWorkspace(q).slice(0, 6).map((h) => ({
            pageId: h.pageId,
            code: h.pageCode,
            title: h.title,
            snippet: h.snippet
          }))
        }
      },
      {
        name: 'read_page_spec',
        description: 'Read full document blocks or DBML schema from a NoteIT page.',
        inputSchema: {
          type: 'object',
          properties: { pageCodeOrTitle: { type: 'string' } },
          required: ['pageCodeOrTitle']
        },
        execute: async ({ pageCodeOrTitle }) => {
          const targetName = String(pageCodeOrTitle || '')
          emit({ requestId: req.requestId, type: 'tool-call', toolName: 'read_page_spec', argsSummary: `target="${targetName}"` })
          const snap = getWorkspaceSnapshot()
          const target = resolveTargetPage(snap.pages, targetName, req.activePageId)
          if (!target) return { error: 'Page not found' }
          return {
            id: target.id,
            code: target.code,
            title: target.title,
            mode: target.mode,
            blocks: target.blocks.map((b) => ({ type: b.type, content: b.content }))
          }
        }
      },
      {
        name: 'propose_spec_blocks',
        description: 'Propose new blocks to insert into the active NoteIT specification page.',
        inputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  content: { type: 'string' }
                },
                required: ['type', 'content']
              }
            }
          },
          required: ['summary', 'blocks']
        },
        execute: async ({ summary, blocks }) => {
          const target = activePage || snapshot.pages[0]
          if (!target) return { ok: false, error: 'No active target page.' }
          const parsedBlocks: ProposedSpecBlock[] = Array.isArray(blocks)
            ? blocks.map((b: any) => ({
                type: (['paragraph', 'code', 'dbml', 'mermaid', 'graphviz', 'callout'].includes(b?.type)
                  ? b.type
                  : 'paragraph') as BlockType,
                content: String(b?.content || '')
              }))
            : []
          const proposal: AIApprovalProposal = {
            proposalId: `prop-cli-${Date.now()}`,
            kind: 'spec-blocks',
            targetPageId: target.id,
            targetPageCode: target.code,
            targetPageTitle: target.title,
            summary: String(summary || 'Proposed blocks from CLI agent'),
            blocks: parsedBlocks,
            status: 'pending'
          }
          return handleProposalEmission(req, proposal, emit)
        }
      }
    ]

    if (boundRepoPath) {
      cliTools.push({
        name: 'get_git_diff_summary',
        description: 'Get working-tree git status for the bound repository.',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => getRepoGitStatus(boundRepoPath)
      })
    }

    let cliFullText = ''
    await executeCliBridgeStream({
      req,
      profile: resolved.profile,
      systemPrompt: buildSystemInstruction(req, mentionedPages, activePage, boundRepoPath, routedUi),
      tools: cliTools,
      emit: (ev) => {
        if (ev.type === 'text-delta') {
          cliFullText += ev.textDelta
          emit(ev)
        } else if (ev.type === 'done') {
          const { artifact } = extractOpenUiArtifact(cliFullText)
          if (artifact) {
            emit({ requestId: req.requestId, type: 'ui-artifact', artifact })
          }
          emit({
            requestId: req.requestId,
            type: 'telemetry',
            telemetry: {
              providerLabel: ev.providerLabel,
              latencyMs: Date.now() - startedAt,
              steps: 1,
              routedUiMode: artifact ? 'openui' : routedUi
            }
          })
          emit(ev)
        } else {
          emit(ev)
        }
      }
    })
    return
  }

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

  // Dynamic MCP tool selection: when > 12 MCP tools are connected, rank against user prompt
  let activeMcpTools = mcpToolMap
  const mcpNames = Object.keys(mcpToolMap)
  if (mcpNames.length > 12 && lastUserMsg.trim()) {
    const terms = lastUserMsg.toLowerCase().split(/\W+/).filter((w) => w.length >= 3)
    const ranked = mcpNames
      .map((name) => {
        const desc = String(mcpToolMap[name]?.description || '').toLowerCase()
        const hay = `${name} ${desc}`
        const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0)
        return { name, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
    activeMcpTools = {}
    for (const item of ranked) activeMcpTools[item.name] = mcpToolMap[item.name]
  }

  const systemInstruction = buildSystemInstruction(
    req,
    mentionedPages,
    activePage,
    boundRepoPath,
    routedUi
  )
  const multimodalMessages = buildMultimodalMessages(req.messages, req.attachments)

  const buildTools = () => ({
    semantic_search_workspace: tool({
      description:
        'Hybrid vector + FTS5 semantic search across all NoteIT pages for conceptually related notes.',
      inputSchema: z.object({
        query: z.string().describe('Conceptual or keyword search query'),
        limit: z.number().int().min(1).max(10).default(5)
      }),
      execute: async ({ query, limit }) => {
        emit({
          requestId: req.requestId,
          type: 'tool-call',
          toolName: 'semantic_search_workspace',
          argsSummary: `query="${query}"`
        })
        return hybridSemanticSearch(query, limit)
      }
    }),

    render_interactive_widget: tool({
      description:
        'Render a self-contained sandboxed HTML/CSS/JS interactive widget (simulation, canvas, calculator, visualizer) directly inside the AI Studio response.',
      inputSchema: z.object({
        title: z.string().describe('Widget title'),
        initialHeight: z.number().int().min(160).max(700).default(320),
        css: z.string().default(''),
        html: z.string().describe('Body HTML markup for the widget'),
        js: z.string().default('').describe('Vanilla JS for interactivity')
      }),
      execute: async ({ title, initialHeight, css, html, js }) => {
        emit({
          requestId: req.requestId,
          type: 'tool-call',
          toolName: 'render_interactive_widget',
          argsSummary: `title="${title}"`
        })
        emit({
          requestId: req.requestId,
          type: 'ui-artifact',
          artifact: {
            kind: 'sandbox-html',
            title,
            sandbox: { initialHeight, css, html, js }
          }
        })
        return { ok: true, rendered: title }
      }
    }),

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

        ...activeMcpTools
      })

  const runAgentStream = async (
    modelToUse: typeof resolved.model,
    providerLabel: string,
    usedFallback = false,
    fallbackReason?: string
  ): Promise<void> => {
    let stepCount = 0
    let inputTokens = 0
    let outputTokens = 0
    let reasoningTokens = 0
    let fullText = ''
    let emittedWidget = false

    const agent = new ToolLoopAgent({
      model: wrapWithReasoningMiddleware(modelToUse),
      instructions: systemInstruction,
      tools: buildTools(),
      stopWhen: stepCountIs(8),
      onStepFinish: ({ usage }) => {
        stepCount++
        inputTokens += Number((usage as any)?.inputTokens ?? (usage as any)?.promptTokens ?? 0)
        outputTokens += Number((usage as any)?.outputTokens ?? (usage as any)?.completionTokens ?? 0)
        reasoningTokens += Number((usage as any)?.reasoningTokens ?? 0)
      }
    })

    const result = await agent.stream({
      messages: multimodalMessages
    })

    for await (const part of result.fullStream as AsyncIterable<any>) {
      if (part.type === 'text-delta') {
        const delta = part.text ?? part.textDelta ?? ''
        if (delta) {
          fullText += delta
          emit({ requestId: req.requestId, type: 'text-delta', textDelta: delta })
        }
      } else if (part.type === 'reasoning-delta' || part.type === 'reasoning') {
        const delta = part.text ?? part.textDelta ?? ''
        if (delta) {
          emit({ requestId: req.requestId, type: 'reasoning-delta', reasoningDelta: delta })
        }
      } else if (part.type === 'tool-call' && part.toolName === 'render_interactive_widget') {
        emittedWidget = true
      }
    }

    if (!emittedWidget) {
      const { artifact } = extractOpenUiArtifact(fullText)
      if (artifact) {
        emit({ requestId: req.requestId, type: 'ui-artifact', artifact })
      }
    }

    emit({
      requestId: req.requestId,
      type: 'telemetry',
      telemetry: {
        providerLabel,
        inputTokens,
        outputTokens,
        reasoningTokens,
        totalTokens: inputTokens + outputTokens,
        latencyMs: Date.now() - startedAt,
        steps: Math.max(1, stepCount),
        usedFallback,
        fallbackReason,
        routedUiMode: emittedWidget ? 'sandbox-html' : routedUi
      }
    })

    emit({
      requestId: req.requestId,
      type: 'done',
      usedLiveSdk: true,
      providerLabel
    })
  }

  try {
    await runAgentStream(resolved.model, resolved.label)
  } catch (error) {
    const errMessage = redactSecrets(error instanceof Error ? error.message : String(error))
    const primaryKey = `${req.profileId || `builtin:${req.provider}`}:${req.modelId}`
    const fallback = resolveFallbackTarget(primaryKey)

    if (fallback?.target?.mode === 'sdk') {
      emit({
        requestId: req.requestId,
        type: 'fallback-notice',
        message: `Primary provider failed (${errMessage.slice(0, 100)}). Switched automatically to ${fallback.label}.`
      })
      try {
        await runAgentStream(fallback.target.model, fallback.label, true, errMessage)
        return
      } catch (fbErr) {
        const fbMsg = redactSecrets(fbErr instanceof Error ? fbErr.message : String(fbErr))
        emit({
          requestId: req.requestId,
          type: 'error',
          error: `Primary provider (${resolved.label}) failed: ${errMessage}\nFallback (${fallback.label}) also failed: ${fbMsg}`
        })
        return
      }
    }

    emit({
      requestId: req.requestId,
      type: 'error',
      error: `AI provider (${resolved.label}) failed: ${errMessage}`
    })
  }
}
