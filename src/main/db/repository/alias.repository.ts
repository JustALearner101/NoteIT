import { getDb } from '../client'

export interface AliasRow {
  alias: string
  page_id: string
  created_at: number
}

export function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase()
}

export function insertAlias(alias: string, pageId: string, createdAt: number): void {
  const normalized = normalizeAlias(alias)
  if (!normalized) return

  getDb()
    .prepare('INSERT OR IGNORE INTO page_aliases (alias, page_id, created_at) VALUES (?, ?, ?)')
    .run(normalized, pageId, createdAt)
}

export function listAliases(): AliasRow[] {
  return getDb()
    .prepare(
      'SELECT alias, page_id, created_at FROM page_aliases ORDER BY created_at ASC, alias ASC'
    )
    .all() as unknown as AliasRow[]
}

export function deleteAliasesForPage(pageId: string): void {
  getDb().prepare('DELETE FROM page_aliases WHERE page_id = ?').run(pageId)
}
