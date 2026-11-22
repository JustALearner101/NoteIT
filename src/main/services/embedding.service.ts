import crypto from 'node:crypto'
import { cosineSimilarity, embed } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { SemanticSearchHit } from '@shared/types/domain'
import { getDb, extractPlainTextFromPage } from '../db/client'
import { getProviderSecretKeyName, getSecret } from './secret.service'
import { getWorkspaceSnapshot, searchWorkspace } from './workspace.service'

const LOCAL_DIM = 128

/**
 * Deterministic local character-trigram + word-hash embedding vector (128-dim L2-normalized).
 * Ensures hybrid semantic search works 100% offline with zero API keys, and seamlessly upgrades
 * to cloud embeddings (`ai` SDK `embed()`) whenever an OpenAI or Gemini API key is configured.
 */
export function computeLocalTrigramVector(text: string): number[] {
  const vec = new Array<number>(LOCAL_DIM).fill(0)
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean) return vec

  const words = clean.split(' ')
  for (const w of words) {
    if (w.length < 2) continue
    let h = 2166136261
    for (let i = 0; i < w.length; i++) {
      h ^= w.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const idx = Math.abs(h) % LOCAL_DIM
    vec[idx] += 2.0

    for (let i = 0; i <= w.length - 3; i++) {
      const tri = w.slice(i, i + 3)
      let th = 2166136261
      for (let j = 0; j < 3; j++) {
        th ^= tri.charCodeAt(j)
        th = Math.imul(th, 16777619)
      }
      vec[Math.abs(th) % LOCAL_DIM] += 1.0
    }
  }

  let norm = 0
  for (let i = 0; i < LOCAL_DIM; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < LOCAL_DIM; i++) vec[i] = Number((vec[i] / norm).toFixed(5))
  return vec
}

async function computeEmbeddingVector(text: string): Promise<{ vector: number[]; modelId: string }> {
  const openaiKey = getSecret(getProviderSecretKeyName('openai'))
  if (openaiKey) {
    try {
      const openai = createOpenAI({ apiKey: openaiKey })
      const res = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: text.slice(0, 6000)
      })
      return { vector: res.embedding, modelId: 'openai:text-embedding-3-small' }
    } catch {
      // Fall back to local trigram embedding if offline or quota exceeded
    }
  }

  const googleKey = getSecret(getProviderSecretKeyName('gemini'))
  if (googleKey) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: googleKey })
      const res = await embed({
        model: google.textEmbeddingModel('text-embedding-004'),
        value: text.slice(0, 6000)
      })
      return { vector: res.embedding, modelId: 'google:text-embedding-004' }
    } catch {
      // Fall back to local trigram embedding
    }
  }

  return { vector: computeLocalTrigramVector(text), modelId: 'local:trigram-128' }
}

/**
 * Incrementally indexes all NoteIT pages into `page_embeddings` (skipping unchanged SHA-256 hashes).
 */
export async function syncWorkspaceEmbeddings(): Promise<{ indexed: number; total: number }> {
  const db = getDb()
  const snap = getWorkspaceSnapshot()
  const existingRows = db
    .prepare('SELECT page_id, content_hash, model_id FROM page_embeddings')
    .all() as Array<{ page_id: string; content_hash: string; model_id: string }>
  const existingMap = new Map(existingRows.map((r) => [r.page_id, r]))

  let indexed = 0
  const upsert = db.prepare(
    `INSERT INTO page_embeddings (page_id, content_hash, model_id, vector_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(page_id) DO UPDATE SET
       content_hash = excluded.content_hash,
       model_id = excluded.model_id,
       vector_json = excluded.vector_json,
       updated_at = excluded.updated_at`
  )

  for (const page of snap.pages) {
    const plain = extractPlainTextFromPage(page)
    const hash = crypto.createHash('sha256').update(plain).digest('hex').slice(0, 16)
    const prev = existingMap.get(page.id)
    if (prev && prev.content_hash === hash) continue

    const { vector, modelId } = await computeEmbeddingVector(plain)
    upsert.run(page.id, hash, modelId, JSON.stringify(vector), Date.now())
    indexed++
  }

  return { indexed, total: snap.pages.length }
}

/**
 * Hybrid Semantic + FTS5 Search across NoteIT workspace pages using Vercel AI SDK `cosineSimilarity`.
 */
export async function hybridSemanticSearch(query: string, limit = 6): Promise<SemanticSearchHit[]> {
  const q = query.trim()
  if (!q) return []

  await syncWorkspaceEmbeddings()
  const { vector: queryVec, modelId: queryModel } = await computeEmbeddingVector(q)

  const db = getDb()
  const snap = getWorkspaceSnapshot()
  const pageMap = new Map(snap.pages.map((p) => [p.id, p]))

  const ftsHits = searchWorkspace(q)
  const ftsScoreMap = new Map<string, { score: number; snippet: string }>()
  ftsHits.forEach((h, idx) => {
    ftsScoreMap.set(h.pageId, { score: Math.max(0.2, 1 - idx * 0.12), snippet: h.snippet })
  })

  const embRows = db
    .prepare('SELECT page_id, model_id, vector_json FROM page_embeddings')
    .all() as Array<{ page_id: string; model_id: string; vector_json: string }>

  const combined: SemanticSearchHit[] = []

  for (const row of embRows) {
    const page = pageMap.get(row.page_id)
    if (!page) continue

    let vecScore = 0
    if (row.model_id === queryModel) {
      try {
        const vec = JSON.parse(row.vector_json) as number[]
        if (vec.length === queryVec.length) {
          vecScore = Math.max(0, cosineSimilarity(queryVec, vec))
        }
      } catch {
        vecScore = 0
      }
    }

    const fts = ftsScoreMap.get(page.id)
    const ftsScore = fts?.score ?? 0
    const finalScore = ftsScore > 0 && vecScore > 0
      ? Number((0.55 * vecScore + 0.45 * ftsScore).toFixed(4))
      : Number(Math.max(vecScore, ftsScore * 0.85).toFixed(4))

    if (finalScore <= 0.05) continue

    combined.push({
      pageId: page.id,
      pageCode: page.code,
      title: page.title,
      score: finalScore,
      source: ftsScore > 0 && vecScore > 0 ? 'hybrid' : vecScore > 0 ? 'vector' : 'fts5',
      snippet:
        fts?.snippet ||
        extractPlainTextFromPage(page).replace(/\s+/g, ' ').slice(0, 180)
    })
  }

  return combined.sort((a, b) => b.score - a.score).slice(0, limit)
}
