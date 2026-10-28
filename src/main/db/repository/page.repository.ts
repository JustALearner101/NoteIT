import { getDb } from '../client'
import type { Page } from '@shared/types/domain'

export interface PageRow {
  id: string
  code: string
  section_id: string
  parent_page_id: string | null
  title: string
  icon: string
  mode: string
  blocks_json: string
  canvas_json: string
  plain_text: string
  tags_json: string
  is_favorite: number
  is_pinned: number
  sort_order: number
  version_count: number
  created_at: number
  updated_at: number
}

export function listPages(): PageRow[] {
  return getDb()
    .prepare('SELECT * FROM pages ORDER BY sort_order ASC, created_at ASC')
    .all() as unknown as PageRow[]
}

export function getMaxPageSortOrder(): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM pages')
    .get() as { maxOrder: number } | undefined
  return row?.maxOrder || 0
}

export function getPageCodeState(): { total: number; maxSuffix: number } {
  const row = getDb()
    .prepare(
      `SELECT
        COUNT(*) as total,
        COALESCE(MAX(CAST(SUBSTR(code, 4) AS INTEGER)), 0) as maxSuffix
       FROM pages
       WHERE code GLOB 'PG-[0-9]*' AND SUBSTR(code, 4) NOT GLOB '*[^0-9]*'`
    )
    .get() as { total: number; maxSuffix: number } | undefined
  return { total: row?.total || 0, maxSuffix: row?.maxSuffix || 0 }
}

export function findPageById(id: string): PageRow | undefined {
  return getDb().prepare('SELECT * FROM pages WHERE id = ?').get(id) as unknown as
    | PageRow
    | undefined
}

export function insertPage(page: Page, plainText: string): void {
  getDb()
    .prepare(
      `INSERT INTO pages (
        id, code, section_id, parent_page_id, title, icon, mode,
        blocks_json, canvas_json, plain_text, tags_json,
        is_favorite, is_pinned, sort_order, version_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      page.id,
      page.code,
      page.sectionId,
      page.parentPageId,
      page.title,
      page.icon,
      page.mode,
      JSON.stringify(page.blocks),
      JSON.stringify(page.canvasData),
      plainText,
      JSON.stringify(page.tags),
      page.isFavorite ? 1 : 0,
      page.isPinned ? 1 : 0,
      page.sortOrder,
      page.versionCount,
      page.createdAt,
      page.updatedAt
    )
}

export function updatePageRow(page: Page, plainText: string): void {
  getDb()
    .prepare(
      `UPDATE pages SET
        title = ?,
        icon = ?,
        mode = ?,
        blocks_json = ?,
        canvas_json = ?,
        plain_text = ?,
        tags_json = ?,
        is_favorite = ?,
        is_pinned = ?,
        updated_at = ?
       WHERE id = ?`
    )
    .run(
      page.title,
      page.icon,
      page.mode,
      JSON.stringify(page.blocks),
      JSON.stringify(page.canvasData),
      plainText,
      JSON.stringify(page.tags),
      page.isFavorite ? 1 : 0,
      page.isPinned ? 1 : 0,
      page.updatedAt,
      page.id
    )
}

export function deletePageById(id: string): void {
  getDb().prepare('DELETE FROM pages WHERE id = ?').run(id)
}

export function updatePageVersionCount(id: string, versionCount: number): void {
  getDb().prepare('UPDATE pages SET version_count = ? WHERE id = ?').run(versionCount, id)
}
