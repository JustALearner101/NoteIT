import { getDb } from '../client'
import type { Section } from '@shared/types/domain'

export interface SectionRow {
  id: string
  notebook_id: string
  name: string
  code: string
  color: string
  sort_order: number
  created_at: number
  updated_at: number
}

export function listSections(): SectionRow[] {
  return getDb()
    .prepare('SELECT * FROM sections ORDER BY sort_order ASC, created_at ASC')
    .all() as unknown as SectionRow[]
}

export function getMaxSectionSortOrder(): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM sections')
    .get() as { maxOrder: number } | undefined
  return row?.maxOrder || 0
}

export function getSectionCodeState(): { total: number; maxSuffix: number } {
  const row = getDb()
    .prepare(
      `SELECT
        COUNT(*) as total,
        COALESCE(MAX(CAST(SUBSTR(code, 5) AS INTEGER)), 0) as maxSuffix
       FROM sections
       WHERE code GLOB 'SEC-[0-9]*' AND SUBSTR(code, 5) NOT GLOB '*[^0-9]*'`
    )
    .get() as { total: number; maxSuffix: number } | undefined
  return { total: row?.total || 0, maxSuffix: row?.maxSuffix || 0 }
}

export function insertSection(section: Section): void {
  getDb()
    .prepare(
      `INSERT INTO sections (id, notebook_id, name, code, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      section.id,
      section.notebookId,
      section.name,
      section.code,
      section.color,
      section.sortOrder,
      section.createdAt,
      section.updatedAt
    )
}
