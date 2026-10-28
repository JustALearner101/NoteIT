import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { extensionFromFileName, mimeForExtension, normalizeAssetExtension } from '@shared/assets'
import type { AssetRecord } from '@shared/types/domain'
import { getDb, getDbPath } from '../db/client'

/** Batas keras ukuran satu aset. 120 MB ditolak sebelum dibaca ke memori. */
export const MAX_ASSET_BYTES = 100 * 1024 * 1024

const ASSET_ID_PATTERN = /^[0-9a-f]{64}$/
const ASSET_REQUEST_PATTERN = /^[0-9a-f]{64}\.[a-z0-9]{1,10}$/

interface AssetRow {
  id: string
  ext: string
  mime: string
  name: string
  size: number
  created_at: number
}

function toRecord(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    ext: row.ext,
    mime: row.mime,
    name: row.name,
    size: row.size,
    createdAt: row.created_at
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Folder aset selalu bersaudara dengan berkas database: <dir db>/assets. */
export function getAssetsDir(): string {
  const dbPath = getDbPath()
  if (!dbPath) {
    throw new Error('Path database belum tersedia; folder aset tidak bisa ditentukan.')
  }
  return path.join(path.dirname(dbPath), 'assets')
}

export function hashAssetContent(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Validasi nama berkas aset (<sha256>.<ext>) lalu resolve ke path absolut.
 * Null kalau id/ekstensi tidak valid atau hasil resolve keluar dari folder aset.
 */
export function resolveAssetPath(assetId: string, extension: string): string | null {
  if (!ASSET_ID_PATTERN.test(String(assetId || ''))) return null

  const ext = normalizeAssetExtension(extension)
  const base = path.resolve(getAssetsDir())
  const candidate = path.resolve(base, `${assetId}.${ext}`)

  // Pertahanan terakhir: apa pun yang terjadi pada input, hasilnya wajib tetap di dalam assets.
  if (candidate !== base && !candidate.startsWith(base + path.sep)) return null
  if (path.dirname(candidate) !== base) return null

  return candidate
}

/**
 * Path dari request protocol noteit-asset. Hanya menerima satu segmen
 * `<sha256>.<ext>`; traversal, subfolder, dan nama asing ditolak.
 */
export function resolveAssetRequestPath(requestPath: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(String(requestPath || ''))
  } catch {
    return null
  }

  const cleaned = decoded.replace(/^[/\\]+/, '')
  if (!ASSET_REQUEST_PATTERN.test(cleaned)) return null

  const base = path.resolve(getAssetsDir())
  const candidate = path.resolve(base, cleaned)
  if (candidate !== base && !candidate.startsWith(base + path.sep)) return null
  if (path.dirname(candidate) !== base) return null

  return candidate
}

export function getAsset(assetId: string): AssetRecord | null {
  const row = getDb().prepare('SELECT * FROM assets WHERE id = ?').get(assetId) as
    | AssetRow
    | undefined
  return row ? toRecord(row) : null
}

export function getAssetFilePath(assetId: string): string | null {
  const asset = getAsset(assetId)
  if (!asset) return null

  const filePath = resolveAssetPath(asset.id, asset.ext)
  if (!filePath || !fs.existsSync(filePath)) return null
  return filePath
}

export function listAssets(): AssetRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM assets ORDER BY created_at DESC, id ASC')
    .all() as unknown as AssetRow[]
  return rows.map(toRecord)
}

/**
 * Impor isi berkas: hash SHA-256 jadi id, tulis ke assets/<hash>.<ext>.
 * Isi identik selalu menghasilkan satu berkas dan satu baris (dedupe by hash).
 */
export function importAsset(input: { data: Buffer; name: string }): AssetRecord {
  const data = input.data
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw new Error('Aset kosong tidak bisa diimpor.')
  }
  if (data.length > MAX_ASSET_BYTES) {
    throw new Error(`Aset melebihi batas ${MAX_ASSET_BYTES} byte.`)
  }

  const id = hashAssetContent(data)
  const existing = getAsset(id)
  if (existing) {
    // Row sudah ada: jangan tulis berkas kedua dengan ekstensi berbeda.
    const filePath = resolveAssetPath(existing.id, existing.ext)
    if (filePath && !fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, data)
    }
    return existing
  }

  const ext = extensionFromFileName(input.name)
  const filePath = resolveAssetPath(id, ext)
  if (!filePath) {
    throw new Error('Nama berkas aset tidak valid.')
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, data)

  getDb()
    .prepare(
      'INSERT INTO assets (id, ext, mime, name, size, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, ext, mimeForExtension(ext), input.name, data.length, Date.now())

  return getAsset(id) as AssetRecord
}

/** Impor dari path di disk; ukuran diperiksa lebih dulu supaya berkas besar tidak dibaca. */
export function importAssetFromPath(filePath: string): AssetRecord {
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) {
    throw new Error('Path impor bukan berkas.')
  }
  if (stat.size > MAX_ASSET_BYTES) {
    throw new Error(`Aset melebihi batas ${MAX_ASSET_BYTES} byte.`)
  }
  return importAsset({ data: fs.readFileSync(filePath), name: path.basename(filePath) })
}

export function deleteAsset(assetId: string): { ok: boolean } {
  const asset = getAsset(assetId)
  if (!asset) return { ok: false }

  const filePath = resolveAssetPath(asset.id, asset.ext)
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath)
    } catch (error) {
      throw new Error(`Gagal menghapus berkas aset: ${toErrorMessage(error)}`)
    }
  }

  getDb().prepare('DELETE FROM assets WHERE id = ?').run(assetId)
  return { ok: true }
}

/** Semua assetId yang masih dipakai blok di halaman mana pun. */
export function collectReferencedAssetIds(): Set<string> {
  const rows = getDb().prepare('SELECT blocks_json FROM pages').all() as Array<{
    blocks_json: string
  }>

  const referenced = new Set<string>()
  for (const row of rows) {
    let blocks: unknown
    try {
      blocks = JSON.parse(row.blocks_json || '[]')
    } catch {
      continue
    }
    if (!Array.isArray(blocks)) continue
    for (const block of blocks) {
      const assetId = (block as { assetId?: unknown })?.assetId
      if (typeof assetId === 'string' && assetId.length > 0) referenced.add(assetId)
    }
  }
  return referenced
}

/**
 * Buang aset yang tidak direferensikan blok mana pun: baris + berkas.
 * Berkas tanpa baris (sisa impor yang gagal) juga dibersihkan.
 */
export function gcOrphanAssets(): { deleted: string[] } {
  const db = getDb()
  const referenced = collectReferencedAssetIds()
  const rows = db.prepare('SELECT * FROM assets').all() as unknown as AssetRow[]
  const deleted: string[] = []
  const knownIds = new Set<string>()

  for (const row of rows) {
    knownIds.add(row.id)
    if (referenced.has(row.id)) continue

    const filePath = resolveAssetPath(row.id, row.ext)
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        // Berkas terkunci: biarkan siklus GC berikutnya mencoba lagi.
        continue
      }
    }
    db.prepare('DELETE FROM assets WHERE id = ?').run(row.id)
    deleted.push(row.id)
  }

  const assetsDir = getAssetsDir()
  if (fs.existsSync(assetsDir)) {
    for (const entry of fs.readdirSync(assetsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !ASSET_REQUEST_PATTERN.test(entry.name)) continue
      const id = entry.name.split('.')[0]
      if (knownIds.has(id) || referenced.has(id)) continue
      try {
        fs.unlinkSync(path.join(assetsDir, entry.name))
        deleted.push(id)
      } catch {
        // Sama seperti di atas: best-effort.
      }
    }
  }

  return { deleted }
}

/** Salin berkas aset ke tujuan (biner!). writeFileSync utf-8 akan merusak PDF/gambar. */
export function copyAssetFile(assetId: string, targetPath: string): boolean {
  const source = getAssetFilePath(assetId)
  if (!source) return false
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(source, targetPath)
  return true
}
