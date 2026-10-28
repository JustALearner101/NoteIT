import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, getDb, initDatabase } from '../db/client'
import {
  MAX_ASSET_BYTES,
  collectReferencedAssetIds,
  copyAssetFile,
  deleteAsset,
  gcOrphanAssets,
  getAsset,
  getAssetFilePath,
  getAssetsDir,
  hashAssetContent,
  importAsset,
  importAssetFromPath,
  listAssets,
  resolveAssetPath,
  resolveAssetRequestPath
} from './asset.service'

let tempDir: string
let sectionId: string

function countAssetRows(): number {
  const row = getDb().prepare('SELECT COUNT(*) as cnt FROM assets').get() as { cnt: number }
  return row?.cnt ?? 0
}

function listAssetFiles(): string[] {
  const dir = getAssetsDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).sort()
}

function makePageWithAsset(assetId: string): string {
  const pageId = `pg-asset-${crypto.randomUUID()}`
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO pages (id, code, section_id, parent_page_id, title, icon, mode, blocks_json,
        canvas_json, plain_text, tags_json, is_favorite, is_pinned, sort_order, version_count,
        created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, 'block', ?, ?, ?, '[]', 0, 0, 0, 1, ?, ?)`
    )
    .run(
      pageId,
      `PG-${pageId.slice(-4)}`,
      sectionId,
      'Halaman Aset',
      '📄',
      JSON.stringify([{ id: 'blk-a', type: 'image', content: 'gambar.png', assetId }]),
      JSON.stringify({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }),
      'gambar.png',
      now,
      now
    )
  return pageId
}

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-asset-test-'))
  initDatabase(tempDir)
  const section = getDb().prepare('SELECT id FROM sections LIMIT 1').get() as { id: string }
  sectionId = section.id
})

afterAll(() => {
  closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('asset.service — impor dan dedupe', () => {
  it('menaruh folder assets di samping berkas database', () => {
    expect(getAssetsDir()).toBe(path.join(tempDir, 'assets'))
  })

  it('menulis berkas content-addressed dan baris tabel assets', () => {
    const data = Buffer.from('isi-png-palsu')
    const asset = importAsset({ data, name: 'Diagram Arsitektur.PNG' })

    expect(asset.id).toBe(hashAssetContent(data))
    expect(asset.ext).toBe('png')
    expect(asset.mime).toBe('image/png')
    expect(asset.name).toBe('Diagram Arsitektur.PNG')
    expect(asset.size).toBe(data.length)
    expect(fs.existsSync(path.join(getAssetsDir(), `${asset.id}.png`))).toBe(true)
    expect(getAsset(asset.id)?.id).toBe(asset.id)
  })

  it('impor isi identik dua kali hanya menghasilkan satu berkas dan satu baris', () => {
    const data = Buffer.from('isi-identik-untuk-dedupe')
    const first = importAsset({ data, name: 'satu.png' })
    const rowsBefore = countAssetRows()
    const filesBefore = listAssetFiles().length

    const second = importAsset({ data, name: 'dua.png' })
    const third = importAsset({ data, name: 'tiga.jpg' })

    expect(second.id).toBe(first.id)
    expect(third.id).toBe(first.id)
    expect(second.ext).toBe('png')
    expect(countAssetRows()).toBe(rowsBefore)
    expect(listAssetFiles().length).toBe(filesBefore)
    expect(listAssetFiles()).toContain(`${first.id}.png`)
    expect(listAssetFiles()).not.toContain(`${first.id}.jpg`)
  })

  it('memakai MIME fallback untuk ekstensi tak dikenal tanpa menolak impor', () => {
    const asset = importAsset({ data: Buffer.from('biner-asing'), name: 'data.zzz' })

    expect(asset.ext).toBe('zzz')
    expect(asset.mime).toBe('application/octet-stream')
    expect(fs.existsSync(path.join(getAssetsDir(), `${asset.id}.zzz`))).toBe(true)
  })

  it('menolak berkas kosong dan berkas melebihi batas ukuran', () => {
    expect(() => importAsset({ data: Buffer.alloc(0), name: 'kosong.png' })).toThrow(
      /kosong/i
    )

    const bigPath = path.join(tempDir, 'besar.bin')
    fs.writeFileSync(bigPath, Buffer.from([0]))
    fs.truncateSync(bigPath, MAX_ASSET_BYTES + 1)
    try {
      expect(() => importAssetFromPath(bigPath)).toThrow(/batas/i)
    } finally {
      fs.unlinkSync(bigPath)
    }
  })

  it('listAssets mengembalikan baris yang tersimpan', () => {
    const asset = importAsset({ data: Buffer.from('untuk-list'), name: 'list.pdf' })
    expect(listAssets().map((row) => row.id)).toContain(asset.id)
  })
})

describe('asset.service — keamanan path', () => {
  it('menolak id yang mengandung traversal', () => {
    expect(resolveAssetPath('../evil', 'png')).toBeNull()
    expect(resolveAssetPath('..\\..\\evil', 'png')).toBeNull()
    expect(resolveAssetPath('a'.repeat(63), 'png')).toBeNull()
    expect(resolveAssetPath('A'.repeat(64), 'png')).toBeNull()
  })

  it('menormalkan ekstensi berbahaya menjadi nama berkas di dalam assets', () => {
    const resolved = resolveAssetPath('b'.repeat(64), '../..')
    expect(resolved).toBe(path.join(getAssetsDir(), `${'b'.repeat(64)}.bin`))
  })

  it('menolak request protocol dengan traversal atau nama asing', () => {
    const valid = `${'c'.repeat(64)}.png`
    expect(resolveAssetRequestPath(valid)).toBe(path.join(getAssetsDir(), valid))
    expect(resolveAssetRequestPath(`/${valid}`)).toBe(path.join(getAssetsDir(), valid))

    expect(resolveAssetRequestPath('../rahasia.png')).toBeNull()
    expect(resolveAssetRequestPath('..%2F..%2Frahasia.png')).toBeNull()
    expect(resolveAssetRequestPath(`${'c'.repeat(64)}/../rahasia.png`)).toBeNull()
    expect(resolveAssetRequestPath('catatan.png')).toBeNull()
    expect(resolveAssetRequestPath('')).toBeNull()
  })
})

describe('asset.service — hapus dan GC', () => {
  it('deleteAsset menghapus berkas dan baris', () => {
    const asset = importAsset({ data: Buffer.from('hapus-saya'), name: 'hapus.txt' })
    const filePath = getAssetFilePath(asset.id)
    expect(filePath).not.toBeNull()

    expect(deleteAsset(asset.id)).toEqual({ ok: true })
    expect(getAsset(asset.id)).toBeNull()
    expect(fs.existsSync(filePath as string)).toBe(false)
    expect(deleteAsset(asset.id)).toEqual({ ok: false })
  })

  it('copyAssetFile menyalin biner apa adanya', () => {
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10])
    const asset = importAsset({ data: bytes, name: 'salinan.pdf' })
    const target = path.join(tempDir, 'keluaran', 'salinan.pdf')

    expect(copyAssetFile(asset.id, target)).toBe(true)
    expect(fs.readFileSync(target).equals(bytes)).toBe(true)
  })

  it('GC tidak menghapus aset yang masih dipakai halaman lain', () => {
    const shared = importAsset({ data: Buffer.from('dipakai-dua-halaman'), name: 'shared.png' })
    const lonely = importAsset({ data: Buffer.from('hanya-satu-halaman'), name: 'lonely.png' })

    const pageA = makePageWithAsset(shared.id)
    const pageB = makePageWithAsset(shared.id)
    const pageC = makePageWithAsset(lonely.id)

    expect(collectReferencedAssetIds().has(shared.id)).toBe(true)

    getDb().prepare('DELETE FROM pages WHERE id = ?').run(pageC)
    const result = gcOrphanAssets()

    expect(result.deleted).toContain(lonely.id)
    expect(result.deleted).not.toContain(shared.id)
    expect(getAsset(shared.id)).not.toBeNull()
    expect(getAsset(lonely.id)).toBeNull()
    expect(fs.existsSync(path.join(getAssetsDir(), `${shared.id}.png`))).toBe(true)

    // Setelah kedua halaman pemakai hilang, aset bersama ikut dibersihkan.
    getDb().prepare('DELETE FROM pages WHERE id IN (?, ?)').run(pageA, pageB)
    expect(gcOrphanAssets().deleted).toContain(shared.id)
    expect(getAsset(shared.id)).toBeNull()
  })

  it('GC membersihkan berkas yatim yang tidak punya baris', () => {
    const orphanName = `${'f'.repeat(64)}.png`
    fs.mkdirSync(getAssetsDir(), { recursive: true })
    fs.writeFileSync(path.join(getAssetsDir(), orphanName), 'yatim')

    gcOrphanAssets()

    expect(fs.existsSync(path.join(getAssetsDir(), orphanName))).toBe(false)
  })
})
