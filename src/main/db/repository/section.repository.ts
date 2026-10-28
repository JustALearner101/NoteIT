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

export function countSections(): number {
  const row = getDb().prepare('SELECT COUNT(*) as cnt FROM sections').get() as { cnt: number }
  return row?.cnt || 0
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
