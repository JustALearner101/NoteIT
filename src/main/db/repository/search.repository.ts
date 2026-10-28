import { getDb } from '../client'
import type { PageRow } from './page.repository'

export interface SearchRow extends PageRow {
  section_name: string
  section_color: string
  notebook_name: string
}

export function removeFromIndex(pageId: string): void {
  getDb().prepare('DELETE FROM pages_fts WHERE page_id = ?').run(pageId)
}

export function indexPage(pageId: string, title: string, plainText: string, tags: string): void {
  getDb()
    .prepare('INSERT INTO pages_fts (page_id, title, plain_text, tags) VALUES (?, ?, ?, ?)')
    .run(pageId, title, plainText, tags)
}

export function countIndexedPages(): number {
  const row = getDb().prepare('SELECT COUNT(*) as cnt FROM pages_fts').get() as { cnt: number }
  return row?.cnt ?? 0
}

export function listRecentPages(): SearchRow[] {
  return getDb()
    .prepare(
      `SELECT p.*, s.name as section_name, s.color as section_color, n.name as notebook_name
       FROM pages p
       JOIN sections s ON s.id = p.section_id
       JOIN notebooks n ON n.id = s.notebook_id
       ORDER BY p.updated_at DESC
       LIMIT 12`
    )
    .all() as unknown as SearchRow[]
}

export function searchByFts(matchQuery: string): SearchRow[] {
  return getDb()
    .prepare(
      `SELECT
        p.*,
        s.name as section_name,
        s.color as section_color,
        n.name as notebook_name
       FROM pages_fts f
       JOIN pages p ON p.id = f.page_id
       JOIN sections s ON s.id = p.section_id
       JOIN notebooks n ON n.id = s.notebook_id
       WHERE pages_fts MATCH ?
       ORDER BY rank
       LIMIT 20`
    )
    .all(matchQuery) as unknown as SearchRow[]
}

export function searchByLike(pattern: string): SearchRow[] {
  return getDb()
    .prepare(
      `SELECT
        p.*,
        s.name as section_name,
        s.color as section_color,
        n.name as notebook_name
       FROM pages p
       JOIN sections s ON s.id = p.section_id
       JOIN notebooks n ON n.id = s.notebook_id
       WHERE p.title LIKE ? OR p.plain_text LIKE ? OR p.code LIKE ?
       ORDER BY p.updated_at DESC
       LIMIT 20`
    )
    .all(pattern, pattern, pattern) as unknown as SearchRow[]
}
