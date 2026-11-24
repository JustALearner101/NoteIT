import crypto from 'node:crypto'
import type { BrowserBookmark } from '@shared/types/domain'
import { getDb } from '../db/client'

interface BookmarkRow {
  id: string
  title: string
  url: string
  notebook_id: string | null
  sort_order: number
  created_at: number
}

function rowToBookmark(row: BookmarkRow): BrowserBookmark {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    notebookId: row.notebook_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  }
}

export function listBrowserBookmarks(notebookId?: string): BrowserBookmark[] {
  const db = getDb()

  const rows = notebookId
    ? (db
        .prepare(
          'SELECT * FROM browser_bookmarks WHERE notebook_id IS NULL OR notebook_id = ? ORDER BY notebook_id DESC, sort_order ASC, created_at ASC'
        )
        .all(notebookId) as unknown as BookmarkRow[])
    : (db
        .prepare('SELECT * FROM browser_bookmarks ORDER BY sort_order ASC, created_at ASC')
        .all() as unknown as BookmarkRow[])

  return rows.map(rowToBookmark)
}

export function addBrowserBookmark(input: {
  title: string
  url: string
  notebookId?: string | null
}): BrowserBookmark {
  const title = input.title.trim() || input.url.trim()
  const url = input.url.trim()
  if (!url) throw new Error('Bookmark URL is required.')

  const id = `bm-${crypto.randomBytes(5).toString('hex')}`
  const now = Date.now()
  const db = getDb()
  const maxRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM browser_bookmarks')
    .get() as { maxOrder: number }

  db.prepare(
    'INSERT INTO browser_bookmarks (id, title, url, notebook_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, title, url, input.notebookId ?? null, (maxRow?.maxOrder ?? 0) + 1, now)

  return {
    id,
    title,
    url,
    notebookId: input.notebookId ?? null,
    sortOrder: (maxRow?.maxOrder ?? 0) + 1,
    createdAt: now
  }
}

export function deleteBrowserBookmark(id: string): { ok: boolean } {
  getDb().prepare('DELETE FROM browser_bookmarks WHERE id = ?').run(id)
  return { ok: true }
}
