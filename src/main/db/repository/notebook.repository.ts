import { getDb } from '../client'
import type { Notebook } from '@shared/types/domain'

export interface NotebookRow {
  id: string
  name: string
  icon: string
  color: string
  sort_order: number
  created_at: number
  updated_at: number
}

export function listNotebooks(): NotebookRow[] {
  return getDb()
    .prepare('SELECT * FROM notebooks ORDER BY sort_order ASC, created_at ASC')
    .all() as unknown as NotebookRow[]
}

export function getMaxNotebookSortOrder(): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM notebooks')
    .get() as { maxOrder: number } | undefined
  return row?.maxOrder || 0
}

export function insertNotebook(notebook: Notebook): void {
  getDb()
    .prepare(
      `INSERT INTO notebooks (id, name, icon, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      notebook.id,
      notebook.name,
      notebook.icon,
      notebook.color,
      notebook.sortOrder,
      notebook.createdAt,
      notebook.updatedAt
    )
}
