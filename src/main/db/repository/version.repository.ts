import { getDb } from '../client'

export interface VersionRow {
  id: string
  page_id: string
  version_number: number
  title: string
  label: string
  blocks_json: string
  canvas_json: string
  created_at: number
}

export interface NewVersionInput {
  id: string
  pageId: string
  versionNumber: number
  title: string
  label: string
  blocksJson: string
  canvasJson: string
  createdAt: number
}

export function listVersionsByPage(pageId: string): VersionRow[] {
  return getDb()
    .prepare('SELECT * FROM page_versions WHERE page_id = ? ORDER BY version_number DESC')
    .all(pageId) as unknown as VersionRow[]
}

export function findVersionById(versionId: string, pageId: string): VersionRow | undefined {
  return getDb()
    .prepare('SELECT * FROM page_versions WHERE id = ? AND page_id = ?')
    .get(versionId, pageId) as unknown as VersionRow | undefined
}

export function insertVersion(version: NewVersionInput): void {
  getDb()
    .prepare(
      `INSERT INTO page_versions (id, page_id, version_number, title, label, blocks_json, canvas_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      version.id,
      version.pageId,
      version.versionNumber,
      version.title,
      version.label,
      version.blocksJson,
      version.canvasJson,
      version.createdAt
    )
}
