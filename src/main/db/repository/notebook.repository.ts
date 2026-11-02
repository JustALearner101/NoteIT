import { getDb } from '../client'
import type { Notebook } from '@shared/types/domain'

export interface NotebookRow {
  id: string
  name: string
  icon: string
  color: string
  repo_path?: string | null
  default_branch?: string | null
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
      `INSERT INTO notebooks (id, name, icon, color, repo_path, default_branch, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      notebook.id,
      notebook.name,
      notebook.icon,
      notebook.color,
      notebook.repoPath || null,
      notebook.defaultBranch || 'main',
      notebook.sortOrder,
      notebook.createdAt,
      notebook.updatedAt
    )
}

export function findNotebookById(id: string): NotebookRow | undefined {
  return getDb().prepare('SELECT * FROM notebooks WHERE id = ?').get(id) as unknown as
    | NotebookRow
    | undefined
}

export function updateNotebookRepoRow(
  id: string,
  repoPath: string | null,
  defaultBranch: string = 'main'
): void {
  getDb()
    .prepare(
      `UPDATE notebooks
       SET repo_path = ?, default_branch = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(repoPath, defaultBranch, Date.now(), id)
}
