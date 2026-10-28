import { getDb } from '../client'

export interface VersionRow {
  id: string
  page_id: string
  version_number: number
  title: string
  label: string
  blocks_json: string
  canvas_json: string
  /** NULL = snapshot legacy yang dibuat sebelum kolom ini ada. */
  tags_json: string | null
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
  /** undefined = snapshot legacy: kolom dibiarkan NULL. */
  tagsJson?: string
  createdAt: number
}

export interface VersionSummaryRow {
  id: string
  page_id: string
  version_number: number
  title: string
  label: string
  /** NULL = snapshot legacy yang dibuat sebelum kolom ini ada. */
  tags_json: string | null
  block_count: number
  created_at: number
}

export function listVersionsByPage(pageId: string): VersionRow[] {
  return getDb()
    .prepare('SELECT * FROM page_versions WHERE page_id = ? ORDER BY version_number DESC')
    .all(pageId) as unknown as VersionRow[]
}

/**
 * Metadata-only: blocks_json/canvas_json tidak pernah dikirim ke renderer saat listing.
 * block_count dihitung SQLite supaya payload tetap kecil walau snapshot berisi diagram besar.
 */
export function listVersionSummariesByPage(pageId: string): VersionSummaryRow[] {
  return getDb()
    .prepare(
      `SELECT id, page_id, version_number, title, label, tags_json,
              json_array_length(COALESCE(blocks_json, '[]')) AS block_count,
              created_at
       FROM page_versions
       WHERE page_id = ?
       ORDER BY version_number DESC`
    )
    .all(pageId) as unknown as VersionSummaryRow[]
}

export function countVersionsByPage(pageId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS cnt FROM page_versions WHERE page_id = ?')
    .get(pageId) as { cnt: number } | undefined
  return row?.cnt ?? 0
}

export function deleteVersionById(versionId: string, pageId: string): number {
  const result = getDb()
    .prepare('DELETE FROM page_versions WHERE id = ? AND page_id = ?')
    .run(versionId, pageId)
  return Number(result.changes)
}

export function updateVersionLabel(versionId: string, pageId: string, label: string): number {
  const result = getDb()
    .prepare('UPDATE page_versions SET label = ? WHERE id = ? AND page_id = ?')
    .run(label, versionId, pageId)
  return Number(result.changes)
}

export function findVersionById(versionId: string, pageId: string): VersionRow | undefined {
  return getDb()
    .prepare('SELECT * FROM page_versions WHERE id = ? AND page_id = ?')
    .get(versionId, pageId) as unknown as VersionRow | undefined
}

export function insertVersion(version: NewVersionInput): void {
  getDb()
    .prepare(
      `INSERT INTO page_versions (id, page_id, version_number, title, label, blocks_json, canvas_json, tags_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      version.id,
      version.pageId,
      version.versionNumber,
      version.title,
      version.label,
      version.blocksJson,
      version.canvasJson,
      version.tagsJson ?? null,
      version.createdAt
    )
}
