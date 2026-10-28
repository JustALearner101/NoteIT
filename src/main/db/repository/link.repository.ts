import { getDb } from '../client'

export interface BacklinkRow {
  source_page_id: string
  context_snippet: string
  source_page_code: string
  source_page_title: string
  source_page_icon: string
  section_name: string
  section_color: string
}

export function listBacklinks(pageId: string): BacklinkRow[] {
  return getDb()
    .prepare(
      `SELECT
        pl.source_page_id,
        pl.context_snippet,
        p.code as source_page_code,
        p.title as source_page_title,
        p.icon as source_page_icon,
        s.name as section_name,
        s.color as section_color
       FROM page_links pl
       JOIN pages p ON p.id = pl.source_page_id
       JOIN sections s ON s.id = p.section_id
       WHERE pl.target_page_id = ?
       ORDER BY p.updated_at DESC`
    )
    .all(pageId) as unknown as BacklinkRow[]
}
