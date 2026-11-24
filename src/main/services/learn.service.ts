import crypto from 'node:crypto'
import { z } from 'zod'
import type {
  AIProviderKind,
  DocumentBlock,
  KgChain,
  KgProposition,
  KgSnapshot,
  LearnCardKind,
  LearnPhase,
  LearnSession,
  LearnSideMessage,
  LearnSideThread,
  LearnTurn,
  Page
} from '@shared/types/domain'
import { getDb } from '../db/client'
import { runStructuredObject, runTextCompletion } from './ai.service'
import { createPage, getWorkspaceSnapshot } from './workspace.service'

interface SessionRow {
  id: string
  title: string
  goal: string
  kind: string
  phase: string
  source_page_ids_json: string
  source_url: string
  source_excerpt: string
  plan_mermaid: string
  active_node_id: string
  visited_nodes_json: string
  created_at: number
  updated_at: number
}

interface TurnRow {
  id: string
  session_id: string
  role: string
  phase: string
  card_kind: string
  content: string
  thinking_text: string
  confidence: number | null
  metadata_json: string
  created_at: number
}

interface SideThreadRow {
  id: string
  session_id: string
  anchor_turn_id: string
  selected_quote: string
  messages_json: string
  created_at: number
  updated_at: number
}

interface PropRow {
  id: string
  statement: string
  domain_tag: string
  source_session_id: string | null
  source_page_id: string | null
  pos_x: number
  pos_y: number
  created_at: number
}

interface ChainRow {
  id: string
  premise_ids_json: string
  conclusion_id: string
  relation_label: string
  source_session_id: string | null
  created_at: number
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function rowToSession(r: SessionRow): LearnSession {
  return {
    id: r.id,
    title: r.title,
    goal: r.goal,
    kind: r.kind === 'practice' ? 'practice' : 'teach',
    phase: (['probe', 'plan', 'teach', 'practice'].includes(r.phase) ? r.phase : 'probe') as LearnPhase,
    sourcePageIds: safeJsonParse<string[]>(r.source_page_ids_json, []),
    sourceUrl: r.source_url || '',
    sourceExcerpt: r.source_excerpt || '',
    planMermaid: r.plan_mermaid || '',
    activeNodeId: r.active_node_id || '',
    visitedNodes: safeJsonParse<string[]>(r.visited_nodes_json, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function rowToTurn(r: TurnRow): LearnTurn {
  return {
    id: r.id,
    sessionId: r.session_id,
    role: r.role === 'user' ? 'user' : 'assistant',
    phase: (['probe', 'plan', 'teach', 'practice'].includes(r.phase) ? r.phase : 'probe') as LearnPhase,
    cardKind: r.card_kind as LearnCardKind,
    content: r.content,
    thinkingText: r.thinking_text || '',
    confidence: r.confidence ?? null,
    metadata: safeJsonParse<Record<string, unknown>>(r.metadata_json, {}),
    createdAt: r.created_at
  }
}

function rowToSideThread(r: SideThreadRow): LearnSideThread {
  return {
    id: r.id,
    sessionId: r.session_id,
    anchorTurnId: r.anchor_turn_id || '',
    selectedQuote: r.selected_quote || '',
    messages: safeJsonParse<LearnSideMessage[]>(r.messages_json, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function rowToProposition(r: PropRow): KgProposition {
  return {
    id: r.id,
    statement: r.statement,
    domainTag: r.domain_tag || 'General',
    sourceSessionId: r.source_session_id,
    sourcePageId: r.source_page_id,
    posX: r.pos_x,
    posY: r.pos_y,
    createdAt: r.created_at
  }
}

function rowToChain(r: ChainRow): KgChain {
  return {
    id: r.id,
    premiseIds: safeJsonParse<string[]>(r.premise_ids_json, []),
    conclusionId: r.conclusion_id,
    relationLabel: r.relation_label || 'entails',
    sourceSessionId: r.source_session_id,
    createdAt: r.created_at
  }
}

export function listLearnSessions(): LearnSession[] {
  const rows = getDb()
    .prepare('SELECT * FROM learn_sessions ORDER BY updated_at DESC')
    .all() as unknown as SessionRow[]
  return rows.map(rowToSession)
}

export function getLearnSessionDetail(sessionId: string): {
  session: LearnSession
  turns: LearnTurn[]
  sideThreads: LearnSideThread[]
} | null {
  const db = getDb()
  const sRow = db
    .prepare('SELECT * FROM learn_sessions WHERE id = ?')
    .get(sessionId) as unknown as SessionRow | undefined
  if (!sRow) return null

  const tRows = db
    .prepare('SELECT * FROM learn_turns WHERE session_id = ? ORDER BY created_at ASC, rowid ASC')
    .all(sessionId) as unknown as TurnRow[]
  const stRows = db
    .prepare('SELECT * FROM learn_side_threads WHERE session_id = ? ORDER BY updated_at DESC')
    .all(sessionId) as unknown as SideThreadRow[]

  return {
    session: rowToSession(sRow),
    turns: tRows.map(rowToTurn),
    sideThreads: stRows.map(rowToSideThread)
  }
}

export function deleteLearnSession(sessionId: string): { ok: boolean } {
  getDb().prepare('DELETE FROM learn_sessions WHERE id = ?').run(sessionId)
  return { ok: true }
}

function insertTurn(input: {
  sessionId: string
  role: 'user' | 'assistant'
  phase: LearnPhase
  cardKind: LearnCardKind
  content: string
  thinkingText?: string
  confidence?: number | null
  metadata?: Record<string, unknown>
}): LearnTurn {
  const id = `lturn-${crypto.randomBytes(6).toString('hex')}`
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO learn_turns (
        id, session_id, role, phase, card_kind, content, thinking_text, confidence, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.sessionId,
      input.role,
      input.phase,
      input.cardKind,
      input.content,
      input.thinkingText || '',
      input.confidence ?? null,
      JSON.stringify(input.metadata || {}),
      now
    )

  return {
    id,
    sessionId: input.sessionId,
    role: input.role,
    phase: input.phase,
    cardKind: input.cardKind,
    content: input.content,
    thinkingText: input.thinkingText || '',
    confidence: input.confidence ?? null,
    metadata: input.metadata || {},
    createdAt: now
  }
}

function buildSourceContextText(sourcePageIds: string[], sourceUrl: string, sourceExcerpt: string): string {
  const parts: string[] = []
  if (sourcePageIds.length > 0) {
    const snap = getWorkspaceSnapshot()
    for (const pid of sourcePageIds) {
      const pg = snap.pages.find((p) => p.id === pid)
      if (pg) {
        const text = pg.blocks.map((b) => b.content).filter(Boolean).join('\n').slice(0, 2500)
        parts.push(`[NoteIT Page ${pg.code}: ${pg.title}]\n${text}`)
      }
    }
  }
  if (sourceUrl) {
    parts.push(`[Web Source: ${sourceUrl}]`)
  }
  if (sourceExcerpt.trim()) {
    parts.push(sourceExcerpt.trim().slice(0, 3000))
  }
  return parts.join('\n\n')
}

export function buildDefaultMermaidPlan(goal: string): string {
  const safeGoal = goal.replace(/["[\]<>]/g, '').slice(0, 42) || 'Target Concept'
  return [
    'flowchart TD',
    '  N1["1. Core Intuition & Prerequisites"]',
    '  N2["2. Key Mechanism & Invariants"]',
    '  N3["3. Edge Cases & Trade-offs"]',
    `  N4["4. Mastery: ${safeGoal}"]`,
    '  N1 --> N2',
    '  N2 --> N3',
    '  N3 --> N4'
  ].join('\n')
}

export function nextPhaseAfter(current: LearnPhase, turnCount: number): LearnPhase {
  if (current === 'probe') return 'plan'
  if (current === 'plan') return 'teach'
  if (current === 'teach' && turnCount >= 6) return 'practice'
  return current
}

function parseJsonBlockFromText<T>(raw: string): T | null {
  const fenced = /```json\s*([\s\S]*?)```/i.exec(raw)
  const candidate = fenced ? fenced[1].trim() : raw.trim()
  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace <= firstBrace) return null
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T
  } catch {
    return null
  }
}

export async function createLearnSession(input: {
  title: string
  goal: string
  kind?: 'teach' | 'practice'
  sourcePageIds?: string[]
  sourceUrl?: string
  sourceExcerpt?: string
  providerOverride?: AIProviderKind
  profileIdOverride?: string
  modelIdOverride?: string
}): Promise<{
  session: LearnSession
  turns: LearnTurn[]
  providerLabel: string
  usedLiveProvider: boolean
}> {
  const id = `lsess-${crypto.randomBytes(6).toString('hex')}`
  const now = Date.now()
  const kind = input.kind === 'practice' ? 'practice' : 'teach'
  const initialPhase: LearnPhase = kind === 'practice' ? 'practice' : 'probe'
  const sourcePageIds = input.sourcePageIds || []
  const sourceUrl = (input.sourceUrl || '').trim()
  const sourceExcerpt = (input.sourceExcerpt || '').trim()
  const title = input.title.trim() || input.goal.trim().slice(0, 48) || 'New Learning Session'
  const goal = input.goal.trim() || title

  getDb()
    .prepare(
      `INSERT INTO learn_sessions (
        id, title, goal, kind, phase, source_page_ids_json, source_url, source_excerpt,
        plan_mermaid, active_node_id, visited_nodes_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      title,
      goal,
      kind,
      initialPhase,
      JSON.stringify(sourcePageIds),
      sourceUrl,
      sourceExcerpt,
      '',
      'N1',
      '[]',
      now,
      now
    )

  const contextText = buildSourceContextText(sourcePageIds, sourceUrl, sourceExcerpt)
  const systemPrompt =
    kind === 'practice'
      ? `You are a LearnHarness Practitioner Agent inside NoteIT. Pose one focused transfer problem testing "${goal}" without naming the exact technique upfront. Ask the learner to explain their reasoning.`
      : `You are a LearnHarness Prober Agent inside NoteIT. Before teaching "${goal}", ask ONE concise diagnostic question to find where the learner's current understanding ends. Encourage them to think out loud and rate their confidence.`

  const completion = await runTextCompletion({
    slot: 'primary',
    providerOverride: input.providerOverride,
    profileIdOverride: input.profileIdOverride,
    modelIdOverride: input.modelIdOverride,
    system: systemPrompt,
    prompt: contextText
      ? `Learning goal: ${goal}\n\nReference material:\n${contextText}\n\nStart the session.`
      : `Learning goal: ${goal}\n\nStart the session.`
  })

  if (!completion.ok || !completion.text.trim()) {
    deleteLearnSession(id)
    throw new Error(
      completion.text.trim() ||
        'No AI provider is configured. Open Settings → AI Providers to connect an API key, custom endpoint, or CLI bridge.'
    )
  }

  const openingContent = completion.text.trim()

  const firstTurn = insertTurn({
    sessionId: id,
    role: 'assistant',
    phase: initialPhase,
    cardKind: kind === 'practice' ? 'problem' : 'probe',
    content: openingContent,
    metadata: {
      providerLabel: completion.providerLabel,
      usedLiveProvider: completion.usedLiveProvider
    }
  })

  const detail = getLearnSessionDetail(id)!
  return {
    session: detail.session,
    turns: [firstTurn],
    providerLabel: completion.providerLabel,
    usedLiveProvider: completion.usedLiveProvider
  }
}

export async function submitLearnResponse(input: {
  sessionId: string
  answer: string
  thinkingText?: string
  confidence?: number
  requestedPhase?: LearnPhase
  providerOverride?: AIProviderKind
  profileIdOverride?: string
  modelIdOverride?: string
}): Promise<{
  session: LearnSession
  turns: LearnTurn[]
  providerLabel: string
  usedLiveProvider: boolean
}> {
  const detail = getLearnSessionDetail(input.sessionId)
  if (!detail) {
    throw new Error('Learn session not found.')
  }

  const { session, turns } = detail
  insertTurn({
    sessionId: session.id,
    role: 'user',
    phase: session.phase,
    cardKind: 'message',
    content: input.answer.trim(),
    thinkingText: (input.thinkingText || '').trim(),
    confidence: input.confidence ?? null
  })

  const nextPhase = input.requestedPhase || nextPhaseAfter(session.phase, turns.length + 1)
  const sourceCtx = buildSourceContextText(
    session.sourcePageIds,
    session.sourceUrl,
    session.sourceExcerpt
  )
  const transcript = [...turns, { role: 'user', content: input.answer, thinkingText: input.thinkingText || '' }]
    .slice(-10)
    .map((t) => `${t.role.toUpperCase()}: ${t.content}${t.thinkingText ? `\n[Thinking out loud]: ${t.thinkingText}` : ''}`)
    .join('\n\n')

  let systemPrompt = ''
  let cardKind: LearnCardKind = 'explain'

  if (nextPhase === 'plan') {
    cardKind = 'plan'
    systemPrompt =
      'You are a LearnHarness Planner Agent. Based on the learner probe, return a brief explanation AND a valid Mermaid flowchart TD dependency DAG inside a ```mermaid ... ``` fence with 4-6 nodes (N1..N6) leading from their current intuition to the goal.'
  } else if (nextPhase === 'teach') {
    cardKind = 'quiz'
    systemPrompt =
      'You are a LearnHarness Teacher Agent. Repair any confusion from the learner\'s reasoning first, explain ONE small reasoning step building on what they know, and end with a short check-for-understanding question.'
  } else if (nextPhase === 'practice') {
    cardKind = 'problem'
    systemPrompt =
      'You are a LearnHarness Practitioner Agent. Evaluate the learner\'s previous reasoning, reveal any hidden nuance, and pose a varied transfer problem that requires recalling the right principle without naming it first.'
  } else {
    cardKind = 'probe'
    systemPrompt =
      'You are a LearnHarness Prober Agent. Ask one targeted follow-up diagnostic question to pinpoint the learner\'s prerequisite boundary.'
  }

  const completion = await runTextCompletion({
    slot: 'primary',
    providerOverride: input.providerOverride,
    profileIdOverride: input.profileIdOverride,
    modelIdOverride: input.modelIdOverride,
    system: systemPrompt,
    prompt: `Goal: ${session.goal}\nCurrent Phase: ${nextPhase}\nConfidence: ${input.confidence ?? 'unset'}/5\n\n${sourceCtx ? `Source Material:\n${sourceCtx}\n\n` : ''}Recent Transcript:\n${transcript}`
  })

  if (!completion.ok || !completion.text.trim()) {
    throw new Error(
      completion.text.trim() ||
        'AI provider failed to respond. Check your connection or API key in Settings → AI Providers.'
    )
  }

  const replyText = completion.text.trim()
  let nextPlanMermaid = session.planMermaid
  let nextActiveNode = session.activeNodeId || 'N1'
  const visitedSet = new Set(session.visitedNodes)

  if (nextPhase === 'plan') {
    const mermaidMatch = /```mermaid\s*([\s\S]*?)```/i.exec(replyText)
    if (mermaidMatch?.[1]?.trim()) {
      nextPlanMermaid = mermaidMatch[1].trim()
    }
  } else if (nextPhase === 'teach') {
    visitedSet.add(nextActiveNode)
    nextActiveNode = nextActiveNode === 'N1' ? 'N2' : nextActiveNode === 'N2' ? 'N3' : 'N4'
  }

  insertTurn({
    sessionId: session.id,
    role: 'assistant',
    phase: nextPhase,
    cardKind,
    content: replyText,
    metadata: {
      providerLabel: completion.providerLabel,
      usedLiveProvider: completion.usedLiveProvider,
      nodeId: nextActiveNode
    }
  })

  getDb()
    .prepare(
      `UPDATE learn_sessions
       SET phase = ?, plan_mermaid = ?, active_node_id = ?, visited_nodes_json = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      nextPhase,
      nextPlanMermaid,
      nextActiveNode,
      JSON.stringify(Array.from(visitedSet)),
      Date.now(),
      session.id
    )

  const updated = getLearnSessionDetail(session.id)!
  return {
    session: updated.session,
    turns: updated.turns,
    providerLabel: completion.providerLabel,
    usedLiveProvider: completion.usedLiveProvider
  }
}

export async function askLearnSideQuestion(input: {
  sessionId: string
  anchorTurnId?: string
  selectedQuote?: string
  question: string
  threadId?: string
  providerOverride?: AIProviderKind
  profileIdOverride?: string
  modelIdOverride?: string
}): Promise<LearnSideThread> {
  const detail = getLearnSessionDetail(input.sessionId)
  if (!detail) throw new Error('Learn session not found.')

  const db = getDb()
  const now = Date.now()
  let thread: LearnSideThread | undefined

  if (input.threadId) {
    thread = detail.sideThreads.find((t) => t.id === input.threadId)
  }

  const userMsg: LearnSideMessage = {
    id: `smsg-u-${now}`,
    role: 'user',
    content: input.question.trim(),
    createdAt: now
  }

  const lessonExcerpt = detail.turns
    .slice(-6)
    .map((t) => `${t.role}: ${t.content.slice(0, 400)}`)
    .join('\n')

  const completion = await runTextCompletion({
    slot: 'primary',
    providerOverride: input.providerOverride,
    profileIdOverride: input.profileIdOverride,
    modelIdOverride: input.modelIdOverride,
    system:
      'You are a concise LearnHarness side-question helper. Answer the learner\'s clarification in 2-4 crisp sentences without giving away unrevealed quiz answers or hijacking the main lesson.',
    prompt: `Lesson goal: ${detail.session.goal}\n${input.selectedQuote ? `Quoted passage: "${input.selectedQuote}"\n` : ''}Recent lesson context:\n${lessonExcerpt}\n\nSide question: ${input.question}`
  })

  if (!completion.ok || !completion.text.trim()) {
    throw new Error(
      completion.text.trim() ||
        'AI provider failed to answer the side question. Check Settings → AI Providers.'
    )
  }

  const assistantMsg: LearnSideMessage = {
    id: `smsg-a-${Date.now()}`,
    role: 'assistant',
    content: completion.text.trim(),
    createdAt: Date.now()
  }

  if (thread) {
    const nextMessages = [...thread.messages, userMsg, assistantMsg]
    db.prepare('UPDATE learn_side_threads SET messages_json = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(nextMessages),
      Date.now(),
      thread.id
    )
    return { ...thread, messages: nextMessages, updatedAt: Date.now() }
  }

  const newId = `sthread-${crypto.randomBytes(5).toString('hex')}`
  const messages = [userMsg, assistantMsg]
  db.prepare(
    `INSERT INTO learn_side_threads (
      id, session_id, anchor_turn_id, selected_quote, messages_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId,
    detail.session.id,
    input.anchorTurnId || '',
    input.selectedQuote || '',
    JSON.stringify(messages),
    now,
    now
  )

  return {
    id: newId,
    sessionId: detail.session.id,
    anchorTurnId: input.anchorTurnId || '',
    selectedQuote: input.selectedQuote || '',
    messages,
    createdAt: now,
    updatedAt: now
  }
}

export function getKnowledgeGraph(): KgSnapshot {
  const db = getDb()
  const props = db
    .prepare('SELECT * FROM kg_propositions ORDER BY created_at ASC')
    .all() as unknown as PropRow[]
  const chains = db
    .prepare('SELECT * FROM kg_chains ORDER BY created_at ASC')
    .all() as unknown as ChainRow[]

  return {
    propositions: props.map(rowToProposition),
    chains: chains.map(rowToChain)
  }
}

export function updateKgNodePosition(id: string, x: number, y: number): { ok: boolean } {
  getDb()
    .prepare('UPDATE kg_propositions SET pos_x = ?, pos_y = ? WHERE id = ?')
    .run(x, y, id)
  return { ok: true }
}

export function deleteKgProposition(id: string): { ok: boolean } {
  const db = getDb()
  // Also prune chains where this proposition appears as a premise
  const chains = db.prepare('SELECT id, premise_ids_json FROM kg_chains').all() as Array<{
    id: string
    premise_ids_json: string
  }>
  for (const ch of chains) {
    const premises = safeJsonParse<string[]>(ch.premise_ids_json, [])
    if (premises.includes(id)) {
      db.prepare('DELETE FROM kg_chains WHERE id = ?').run(ch.id)
    }
  }
  db.prepare('DELETE FROM kg_propositions WHERE id = ?').run(id)
  return { ok: true }
}

function normalizeStatementKey(stmt: string): string {
  return stmt.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Deterministic fallback extractor when no live provider is configured:
 * extracts concise factual sentences and links sequential claims into a reasoning chain.
 */
export function deterministicExtractPropositions(
  rawText: string,
  domainTag: string
): {
  propositions: Array<{ statement: string; domainTag: string }>
  chains: Array<{ premises: string[]; conclusion: string; relationLabel: string }>
} {
  const cleaned = rawText
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 24 && s.length <= 220)
    .slice(0, 5)

  const propositions = sentences.map((statement) => ({ statement, domainTag }))
  const chains: Array<{ premises: string[]; conclusion: string; relationLabel: string }> = []
  for (let i = 1; i < propositions.length; i++) {
    chains.push({
      premises: [propositions[i - 1].statement],
      conclusion: propositions[i].statement,
      relationLabel: 'leads to'
    })
  }
  return { propositions, chains }
}

export async function extractKnowledgeGraph(input: {
  sessionId?: string
  pageId?: string
}): Promise<{ addedPropositions: number; addedChains: number; snapshot: KgSnapshot }> {
  let sourceText = ''
  let domainTag = 'General'

  if (input.sessionId) {
    const detail = getLearnSessionDetail(input.sessionId)
    if (detail) {
      domainTag = detail.session.title.slice(0, 32)
      sourceText = detail.turns
        .filter((t) => t.role === 'assistant')
        .map((t) => t.content)
        .join('\n\n')
    }
  } else if (input.pageId) {
    const snap = getWorkspaceSnapshot()
    const page = snap.pages.find((p) => p.id === input.pageId)
    if (page) {
      domainTag = page.title.slice(0, 32)
      sourceText = page.blocks
        .filter((b) => b.type !== 'columns' && b.type !== 'divider')
        .map((b) => b.content)
        .join('\n\n')
    }
  }

  if (!sourceText.trim()) {
    return { addedPropositions: 0, addedChains: 0, snapshot: getKnowledgeGraph() }
  }

  const kgSchema = z.object({
    propositions: z
      .array(
        z.object({
          statement: z.string(),
          domainTag: z.string().optional()
        })
      )
      .max(6),
    chains: z
      .array(
        z.object({
          premises: z.array(z.string()),
          conclusion: z.string(),
          relationLabel: z.string().optional()
        })
      )
      .default([])
  })

  // Prefer Vercel AI SDK v7 Output.object() structured extraction when SDK provider is configured
  const structured = await runStructuredObject({
    slot: 'background',
    schema: kgSchema,
    system:
      'Extract objective propositions and jointly-entailing reasoning chains from the source text. Maximum 6 crisp propositions.',
    prompt: `Domain: ${domainTag}\n\nSource text:\n${sourceText.slice(0, 5000)}`
  })

  let parsed: {
    propositions?: Array<{ statement?: string; domainTag?: string }>
    chains?: Array<{ premises?: string[]; conclusion?: string; relationLabel?: string }>
  } | null = structured.ok && structured.object ? structured.object : null

  if (!parsed) {
    const completion = await runTextCompletion({
      slot: 'background',
      system:
        'Extract objective propositions and reasoning chains as strict JSON: {"propositions":[{"statement":"...","domainTag":"..."}],"chains":[{"premises":["..."],"conclusion":"...","relationLabel":"entails"}]}. Maximum 6 propositions.',
      prompt: `Domain: ${domainTag}\n\nSource text:\n${sourceText.slice(0, 5000)}`
    })

    parsed = completion.ok
      ? parseJsonBlockFromText<{
          propositions?: Array<{ statement?: string; domainTag?: string }>
          chains?: Array<{ premises?: string[]; conclusion?: string; relationLabel?: string }>
        }>(completion.text)
      : null
  }

  if (!parsed || !Array.isArray(parsed.propositions) || parsed.propositions.length === 0) {
    throw new Error(
      'Knowledge Graph extraction requires a live AI provider. Configure a Primary/Background model in Settings → AI Providers.'
    )
  }

  const extracted = {
    propositions: parsed.propositions
      .filter((p): p is { statement: string; domainTag?: string } => Boolean(p?.statement?.trim()))
      .map((p) => ({
        statement: p.statement.trim(),
        domainTag: (p.domainTag || domainTag).trim()
      })),
    chains: Array.isArray(parsed.chains)
      ? parsed.chains
          .filter((c) => Array.isArray(c?.premises) && c.premises.length > 0 && Boolean(c?.conclusion))
          .map((c) => ({
            premises: c.premises!.map(String),
            conclusion: String(c.conclusion),
            relationLabel: String(c.relationLabel || 'entails')
          }))
      : []
  }

  // Deterministic identity audit & merge against existing SQLite graph
  const db = getDb()
  const existing = getKnowledgeGraph()
  const keyToId = new Map<string, string>()
  for (const p of existing.propositions) {
    keyToId.set(normalizeStatementKey(p.statement), p.id)
  }

  let addedPropositions = 0
  let addedChains = 0
  const baseCount = existing.propositions.length
  const now = Date.now()

  const ensureProp = (statement: string, tag: string): string => {
    const key = normalizeStatementKey(statement)
    const found = keyToId.get(key)
    if (found) return found

    const id = `kgp-${crypto.randomBytes(5).toString('hex')}`
    const idx = baseCount + addedPropositions
    const posX = (idx % 3) * 320 + 40
    const posY = Math.floor(idx / 3) * 180 + 40
    db.prepare(
      `INSERT INTO kg_propositions (
        id, statement, domain_tag, source_session_id, source_page_id, pos_x, pos_y, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, statement, tag, input.sessionId ?? null, input.pageId ?? null, posX, posY, now)
    keyToId.set(key, id)
    addedPropositions++
    return id
  }

  for (const prop of extracted.propositions) {
    ensureProp(prop.statement, prop.domainTag)
  }

  const existingChainKeys = new Set(
    existing.chains.map((c) => `${[...c.premiseIds].sort().join(',')}=>${c.conclusionId}`)
  )

  for (const ch of extracted.chains) {
    const premiseIds = ch.premises.map((p) => ensureProp(p, domainTag))
    const conclusionId = ensureProp(ch.conclusion, domainTag)
    if (premiseIds.includes(conclusionId)) continue
    const sig = `${[...premiseIds].sort().join(',')}=>${conclusionId}`
    if (existingChainKeys.has(sig)) continue

    const chainId = `kgc-${crypto.randomBytes(5).toString('hex')}`
    db.prepare(
      `INSERT INTO kg_chains (
        id, premise_ids_json, conclusion_id, relation_label, source_session_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      chainId,
      JSON.stringify(premiseIds),
      conclusionId,
      ch.relationLabel,
      input.sessionId ?? null,
      now
    )
    existingChainKeys.add(sig)
    addedChains++
  }

  return { addedPropositions, addedChains, snapshot: getKnowledgeGraph() }
}

export function crystallizeLearnSessionToPage(input: {
  sessionId: string
  sectionId?: string
}): Page {
  const detail = getLearnSessionDetail(input.sessionId)
  if (!detail) throw new Error('Learn session not found.')

  const snap = getWorkspaceSnapshot()
  const targetSectionId = input.sectionId || snap.sections[0]?.id
  if (!targetSectionId) throw new Error('No workspace section available.')

  const page = createPage({
    sectionId: targetSectionId,
    title: `Learn Notes: ${detail.session.title}`,
    icon: '🎓',
    mode: 'block'
  })

  const blocks: DocumentBlock[] = [
    {
      id: `blk-learn-goal-${Date.now()}`,
      type: 'callout',
      calloutTitle: 'Learning Goal',
      calloutColor: 'teal',
      content: `${detail.session.goal}${detail.session.sourceUrl ? `\nSource: ${detail.session.sourceUrl}` : ''}`
    }
  ]

  if (detail.session.planMermaid) {
    blocks.push({
      id: `blk-learn-dag-${Date.now() + 1}`,
      type: 'mermaid',
      mermaidViewMode: 'diagram',
      content: detail.session.planMermaid
    })
  }

  const assistantTurns = detail.turns.filter((t) => t.role === 'assistant')
  assistantTurns.forEach((turn, idx) => {
    blocks.push({
      id: `blk-learn-turn-${Date.now() + 2 + idx}`,
      type: 'paragraph',
      content: `### Step ${idx + 1} (${turn.phase.toUpperCase()})\n${turn.content}`
    })
  })

  getDb()
    .prepare('UPDATE pages SET blocks_json = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(blocks), Date.now(), page.id)

  return { ...page, blocks }
}
