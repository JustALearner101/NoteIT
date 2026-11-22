import crypto from 'node:crypto'
import type {
  AIAttachment,
  AIMessageRecord,
  AIMessageTelemetry,
  AIThreadRecord,
  AIUiArtifact,
  AIUiMode
} from '@shared/types/domain'
import { getDb } from '../db/client'

interface ThreadRow {
  id: string
  title: string
  studio_mode: string
  chat_mode: string
  ui_mode: string
  provider_id: string
  model_id: string
  created_at: number
  updated_at: number
}

interface MessageRow {
  id: string
  thread_id: string
  role: string
  content: string
  reasoning_text: string
  ui_payload_json: string
  attachments_json: string
  tool_calls_json: string
  proposals_json: string
  telemetry_json: string
  created_at: number
}

function safeParse<T>(raw: string, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function rowToThread(r: ThreadRow): AIThreadRecord {
  return {
    id: r.id,
    title: r.title,
    studioMode: r.studio_mode === 'learn' ? 'learn' : 'chat',
    chatMode: r.chat_mode || 'Free chat',
    uiMode: (['auto', 'intelligent-ui', 'markdown'].includes(r.ui_mode)
      ? r.ui_mode
      : 'auto') as AIUiMode,
    providerId: r.provider_id || '',
    modelId: r.model_id || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function rowToMessage(r: MessageRow): AIMessageRecord {
  return {
    id: r.id,
    threadId: r.thread_id,
    role: r.role === 'user' ? 'user' : 'assistant',
    content: r.content,
    reasoningText: r.reasoning_text || '',
    uiArtifact: safeParse<AIUiArtifact | null>(r.ui_payload_json, null),
    attachments: safeParse<AIAttachment[]>(r.attachments_json, []),
    toolCalls: safeParse<{ toolName: string; argsSummary: string }[]>(r.tool_calls_json, []),
    proposals: safeParse<unknown[]>(r.proposals_json, []),
    telemetry: safeParse<AIMessageTelemetry>(r.telemetry_json, {}),
    createdAt: r.created_at
  }
}

export function listAiThreads(): AIThreadRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM ai_threads ORDER BY updated_at DESC')
    .all() as unknown as ThreadRow[]
  return rows.map(rowToThread)
}

export function getAiThreadWithMessages(
  threadId: string
): { thread: AIThreadRecord; messages: AIMessageRecord[] } | null {
  const db = getDb()
  const tRow = db
    .prepare('SELECT * FROM ai_threads WHERE id = ?')
    .get(threadId) as unknown as ThreadRow | undefined
  if (!tRow) return null

  const mRows = db
    .prepare('SELECT * FROM ai_messages WHERE thread_id = ? ORDER BY created_at ASC, rowid ASC')
    .all(threadId) as unknown as MessageRow[]

  return {
    thread: rowToThread(tRow),
    messages: mRows.map(rowToMessage)
  }
}

export function createAiThread(input?: {
  id?: string
  title?: string
  studioMode?: 'chat' | 'learn'
  chatMode?: string
  uiMode?: AIUiMode
  providerId?: string
  modelId?: string
}): AIThreadRecord {
  const id = input?.id?.trim() || `thr-${crypto.randomBytes(6).toString('hex')}`
  const now = Date.now()
  const title = (input?.title || 'New AI Studio Thread').trim()
  const studioMode = input?.studioMode === 'learn' ? 'learn' : 'chat'
  const chatMode = input?.chatMode || 'Free chat'
  const uiMode: AIUiMode = input?.uiMode || 'auto'

  getDb()
    .prepare(
      `INSERT INTO ai_threads (
        id, title, studio_mode, chat_mode, ui_mode, provider_id, model_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, title, studioMode, chatMode, uiMode, input?.providerId || '', input?.modelId || '', now, now)

  return {
    id,
    title,
    studioMode,
    chatMode,
    uiMode,
    providerId: input?.providerId || '',
    modelId: input?.modelId || '',
    createdAt: now,
    updatedAt: now
  }
}

export function updateAiThread(
  threadId: string,
  patch: Partial<Pick<AIThreadRecord, 'title' | 'chatMode' | 'uiMode' | 'providerId' | 'modelId'>>
): AIThreadRecord | null {
  const existing = getAiThreadWithMessages(threadId)
  if (!existing) return null
  const next = { ...existing.thread, ...patch, updatedAt: Date.now() }
  getDb()
    .prepare(
      `UPDATE ai_threads
       SET title = ?, chat_mode = ?, ui_mode = ?, provider_id = ?, model_id = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(next.title, next.chatMode, next.uiMode, next.providerId, next.modelId, next.updatedAt, threadId)
  return next
}

export function deleteAiThread(threadId: string): { ok: boolean } {
  getDb().prepare('DELETE FROM ai_threads WHERE id = ?').run(threadId)
  return { ok: true }
}

export function saveAiMessage(input: {
  id?: string
  threadId: string
  role: 'user' | 'assistant'
  content: string
  reasoningText?: string
  uiArtifact?: AIUiArtifact | null
  attachments?: AIAttachment[]
  toolCalls?: { toolName: string; argsSummary: string }[]
  proposals?: unknown[]
  telemetry?: AIMessageTelemetry
}): AIMessageRecord {
  const id = input.id?.trim() || `aimsg-${crypto.randomBytes(6).toString('hex')}`
  const now = Date.now()

  getDb()
    .prepare(
      `INSERT INTO ai_messages (
        id, thread_id, role, content, reasoning_text, ui_payload_json,
        attachments_json, tool_calls_json, proposals_json, telemetry_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        reasoning_text = excluded.reasoning_text,
        ui_payload_json = excluded.ui_payload_json,
        attachments_json = excluded.attachments_json,
        tool_calls_json = excluded.tool_calls_json,
        proposals_json = excluded.proposals_json,
        telemetry_json = excluded.telemetry_json`
    )
    .run(
      id,
      input.threadId,
      input.role,
      input.content,
      input.reasoningText || '',
      input.uiArtifact ? JSON.stringify(input.uiArtifact) : '',
      JSON.stringify(input.attachments || []),
      JSON.stringify(input.toolCalls || []),
      JSON.stringify(input.proposals || []),
      JSON.stringify(input.telemetry || {}),
      now
    )

  getDb().prepare('UPDATE ai_threads SET updated_at = ? WHERE id = ?').run(now, input.threadId)

  return {
    id,
    threadId: input.threadId,
    role: input.role,
    content: input.content,
    reasoningText: input.reasoningText || '',
    uiArtifact: input.uiArtifact ?? null,
    attachments: input.attachments || [],
    toolCalls: input.toolCalls || [],
    proposals: input.proposals || [],
    telemetry: input.telemetry || {},
    createdAt: now
  }
}
