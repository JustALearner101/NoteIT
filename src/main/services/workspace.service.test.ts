import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, getDb, initDatabase } from '../db/client'
import {
  createNotebook,
  createPage,
  createPageSnapshot,
  createSection,
  deletePage,
  getBacklinks,
  getWorkspaceSnapshot,
  restorePageSnapshot,
  searchWorkspace,
  updatePage
} from './workspace.service'

let tempDir: string
let notebookId: string
let sectionId: string
let pageId: string

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-test-'))
  initDatabase(tempDir)
})

afterAll(() => {
  closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

function countRows(table: 'pages' | 'pages_fts'): number {
  const row = getDb().prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number }
  return row?.cnt ?? 0
}

describe('workspace.service (integration)', () => {
  it('getWorkspaceSnapshot mengembalikan data seed dan path database sementara', () => {
    const snapshot = getWorkspaceSnapshot()

    expect(snapshot.notebooks.length).toBeGreaterThanOrEqual(2)
    expect(snapshot.sections.length).toBeGreaterThanOrEqual(4)
    expect(snapshot.pages.length).toBeGreaterThanOrEqual(4)
    expect(snapshot.notebooks.map((n) => n.id)).toContain('nb-eng-core')
    expect(snapshot.pages.map((p) => p.id)).toContain('pg-101')
    expect(snapshot.stats.dbPath).toBe(path.join(tempDir, 'noteit-v2.db'))
    expect(snapshot.stats.dbPath.startsWith(tempDir)).toBe(true)
    expect(snapshot.stats.sqliteWalActive).toBe(true)
    expect(snapshot.stats.ftsIndexedPages).toBe(snapshot.pages.length)
  })

  it('createNotebook -> createSection -> createPage (block) muncul di snapshot', () => {
    const notebook = createNotebook({ name: 'Notebook Uji', icon: '🧪', color: 'teal' })
    notebookId = notebook.id
    expect(notebook.name).toBe('Notebook Uji')
    expect(notebook.sortOrder).toBe(3)

    const section = createSection({
      notebookId: notebook.id,
      name: 'Section Uji',
      color: 'amber'
    })
    sectionId = section.id
    expect(section.notebookId).toBe(notebook.id)
    // createNotebook otomatis membuat satu section, jadi section berikutnya adalah SEC-06.
    expect(section.code).toBe('SEC-06')

    const page = createPage({
      sectionId: section.id,
      title: '  Halaman Uji Block  ',
      mode: 'block'
    })
    pageId = page.id
    expect(page.title).toBe('Halaman Uji Block')
    expect(page.mode).toBe('block')
    expect(page.sectionId).toBe(section.id)
    expect(page.code).toBe('PG-105')

    const snapshot = getWorkspaceSnapshot()
    const fromSnapshot = snapshot.pages.find((p) => p.id === page.id)
    expect(fromSnapshot).toBeDefined()
    expect(fromSnapshot?.title).toBe('Halaman Uji Block')
    expect(snapshot.notebooks.map((n) => n.id)).toContain(notebook.id)
    expect(snapshot.sections.map((s) => s.id)).toContain(section.id)
  })

  it('updatePage mengubah judul dan blocks serta menaikkan updatedAt', () => {
    const before = getWorkspaceSnapshot().pages.find((p) => p.id === pageId)
    expect(before).toBeDefined()

    const updated = updatePage({
      id: pageId,
      title: 'Halaman Uji Revisi',
      blocks: [
        {
          id: 'blk-uji-1',
          type: 'paragraph',
          content: 'Catatan tentang zettelkasten dan ketahanan data.'
        }
      ],
      tags: ['uji', 'revisi']
    })

    expect(updated.id).toBe(pageId)
    expect(updated.title).toBe('Halaman Uji Revisi')
    expect(updated.blocks).toHaveLength(1)
    expect(updated.blocks[0].content).toContain('zettelkasten')
    expect(updated.tags).toEqual(['uji', 'revisi'])
    expect(updated.updatedAt).toBeGreaterThan(before!.updatedAt)

    const persisted = getWorkspaceSnapshot().pages.find((p) => p.id === pageId)
    expect(persisted?.title).toBe('Halaman Uji Revisi')
    expect(persisted?.blocks[0].content).toContain('zettelkasten')
  })

  it('searchWorkspace menemukan kata di dalam block setelah update (FTS ter-update)', () => {
    const results = searchWorkspace('zettelkasten')
    const hit = results.find((r) => r.pageId === pageId)
    expect(hit).toBeDefined()
    expect(hit?.title).toBe('Halaman Uji Revisi')
    expect(hit?.snippet).toContain('zettelkasten')
  })

  it('searchWorkspace memakai snippet di sekitar match prefix, bukan 150 karakter awal', () => {
    const page = createPage({ sectionId, title: 'Halaman Snippet Prefix', mode: 'block' })
    const prefix = 'pengantar panjang tanpa kata kunci. '.repeat(10)

    updatePage({
      id: page.id,
      blocks: [
        {
          id: 'blk-snippet-1',
          type: 'paragraph',
          content: `${prefix}zettelkasten adalah metode catatan`
        }
      ]
    })

    // FTS5 prefix match: "zettel" cocok dengan "zettelkasten" walau indexOf gagal.
    const hit = searchWorkspace('zettel').find((r) => r.pageId === page.id)
    expect(hit).toBeDefined()
    expect(hit?.snippet).toContain('zettelkasten')
    expect(hit?.snippet.startsWith('...')).toBe(true)
  })

  it('getBacklinks mengembalikan link ketika page berisi [[Judul]] page lain', () => {
    const target = createPage({
      sectionId,
      title: 'Halaman Target Backlink',
      mode: 'block'
    })

    const source = createPage({
      sectionId,
      title: 'Halaman Sumber Backlink',
      mode: 'block'
    })
    updatePage({
      id: source.id,
      blocks: [
        {
          id: 'blk-link-1',
          type: 'paragraph',
          content: 'Rujukan ke [[Halaman Target Backlink]] untuk detail.'
        }
      ]
    })

    const backlinks = getBacklinks(target.id)
    expect(backlinks).toHaveLength(1)
    expect(backlinks[0].sourcePageId).toBe(source.id)
    expect(backlinks[0].sourcePageTitle).toBe('Halaman Sumber Backlink')
    expect(backlinks[0].contextSnippet).toContain('[[Halaman Target Backlink]]')
  })

  it('createPageSnapshot lalu restorePageSnapshot mengembalikan blocks versi snapshot', () => {
    const snapshot = createPageSnapshot(pageId, 'Snapshot Uji')
    expect(snapshot.pageId).toBe(pageId)
    expect(snapshot.label).toBe('Snapshot Uji')
    expect(snapshot.blocks[0].content).toContain('zettelkasten')

    updatePage({
      id: pageId,
      title: 'Halaman Uji Setelah Snapshot',
      blocks: [{ id: 'blk-uji-2', type: 'paragraph', content: 'Konten yang salah.' }]
    })

    const restored = restorePageSnapshot(pageId, snapshot.id)
    expect(restored.id).toBe(pageId)
    expect(restored.title).toBe('Halaman Uji Revisi')
    expect(restored.blocks).toHaveLength(1)
    expect(restored.blocks[0].content).toContain('zettelkasten')

    const persisted = getWorkspaceSnapshot().pages.find((p) => p.id === pageId)
    expect(persisted?.blocks[0].content).toContain('zettelkasten')
  })

  it('createPageSnapshot menyimpan tags dan restore mengembalikan tags lama', () => {
    const page = createPage({ sectionId, title: 'Halaman Tags Snapshot', mode: 'block' })
    updatePage({ id: page.id, tags: ['lama', 'arsip'] })

    const snapshot = createPageSnapshot(page.id, 'Snapshot Tags')
    const stored = getDb()
      .prepare('SELECT tags_json FROM page_versions WHERE id = ?')
      .get(snapshot.id) as { tags_json: string | null }
    expect(JSON.parse(stored.tags_json || 'null')).toEqual(['lama', 'arsip'])

    updatePage({ id: page.id, tags: ['baru'] })
    const restored = restorePageSnapshot(page.id, snapshot.id)

    expect(restored.tags).toEqual(['lama', 'arsip'])
    expect(getWorkspaceSnapshot().pages.find((p) => p.id === page.id)?.tags).toEqual([
      'lama',
      'arsip'
    ])
  })

  it('restore snapshot legacy (tags_json NULL) tidak menghapus tags halaman', () => {
    const page = createPage({ sectionId, title: 'Halaman Tags Legacy', mode: 'block' })
    updatePage({ id: page.id, tags: ['sekarang'] })

    const snapshot = createPageSnapshot(page.id, 'Snapshot Legacy')
    // Simulasikan snapshot yang dibuat sebelum kolom tags_json ada.
    getDb().prepare('UPDATE page_versions SET tags_json = NULL WHERE id = ?').run(snapshot.id)

    updatePage({ id: page.id, tags: ['tetap'] })
    const restored = restorePageSnapshot(page.id, snapshot.id)

    expect(restored.tags).toEqual(['tetap'])
  })

  it('deletePage menghapus page dan hasil search-nya', () => {
    expect(searchWorkspace('zettelkasten').some((r) => r.pageId === pageId)).toBe(true)

    const result = deletePage(pageId)
    expect(result).toEqual({ ok: true })

    expect(getWorkspaceSnapshot().pages.some((p) => p.id === pageId)).toBe(false)
    expect(searchWorkspace('zettelkasten').some((r) => r.pageId === pageId)).toBe(false)
  })

  it('dua page yang dibuat tanpa jeda tidak bentrok ID', () => {
    const first = createPage({ sectionId, title: 'Halaman Tanpa Jeda A', mode: 'block' })
    const second = createPage({ sectionId, title: 'Halaman Tanpa Jeda B', mode: 'block' })

    expect(first.id).not.toBe(second.id)
    expect(first.code).not.toBe(second.code)
    expect(getWorkspaceSnapshot().pages.filter((p) => p.id === first.id)).toHaveLength(1)
    expect(getWorkspaceSnapshot().pages.filter((p) => p.id === second.id)).toHaveLength(1)
  })

  it('kode page tetap unik setelah sebuah page dihapus', () => {
    const removed = createPage({ sectionId, title: 'Halaman Kode Dihapus', mode: 'block' })
    const kept = createPage({ sectionId, title: 'Halaman Kode Tetap', mode: 'block' })

    deletePage(removed.id)
    const created = createPage({ sectionId, title: 'Halaman Kode Baru', mode: 'block' })

    const codes = getWorkspaceSnapshot().pages.map((p) => p.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(created.code).not.toBe(removed.code)
    expect(created.code).not.toBe(kept.code)
    expect(created.code).toBe(`PG-${Number(kept.code.slice(3)) + 1}`)
  })

  it('createPageSnapshot tidak mengubah pages.updatedAt', () => {
    const page = createPage({ sectionId, title: 'Halaman Snapshot Waktu', mode: 'block' })
    const before = getWorkspaceSnapshot().pages.find((p) => p.id === page.id)
    expect(before).toBeDefined()

    const snapshot = createPageSnapshot(page.id, 'Snapshot Tanpa Ubah Waktu')
    const after = getWorkspaceSnapshot().pages.find((p) => p.id === page.id)

    expect(after?.updatedAt).toBe(before!.updatedAt)
    expect(after?.versionCount).toBe(before!.versionCount + 1)
    expect(snapshot.versionNumber).toBe(before!.versionCount + 1)
  })

  it('updatePage dengan judul spasi saja memakai judul fallback', () => {
    const page = createPage({ sectionId, title: 'Halaman Judul Fallback', mode: 'block' })
    const updated = updatePage({ id: page.id, title: '   ' })

    expect(updated.title).toBe('Halaman Tanpa Judul')
    expect(getWorkspaceSnapshot().pages.find((p) => p.id === page.id)?.title).toBe(
      'Halaman Tanpa Judul'
    )
  })

  it('searchWorkspace mengikuti kata yang ditambah dan dihapus dari block', () => {
    const page = createPage({ sectionId, title: 'Halaman FTS Trigger', mode: 'block' })

    updatePage({
      id: page.id,
      blocks: [{ id: 'blk-fts-1', type: 'paragraph', content: 'kata kunci lamamenu' }]
    })
    expect(searchWorkspace('lamamenu').some((r) => r.pageId === page.id)).toBe(true)

    updatePage({
      id: page.id,
      blocks: [{ id: 'blk-fts-1', type: 'paragraph', content: 'kata kunci barumenux' }]
    })

    expect(searchWorkspace('lamamenu').some((r) => r.pageId === page.id)).toBe(false)
    expect(searchWorkspace('barumenux').some((r) => r.pageId === page.id)).toBe(true)

    const ftsRows = getDb()
      .prepare('SELECT COUNT(*) as cnt FROM pages_fts WHERE page_id = ? AND pages_fts MATCH ?')
      .get(page.id, '"barumenux"*') as { cnt: number }
    expect(ftsRows.cnt).toBe(1)
  })

  it('setiap page punya tepat satu row pages_fts setelah create/update/delete', () => {
    const a = createPage({ sectionId, title: 'Halaman Hitung FTS A', mode: 'block' })
    const b = createPage({ sectionId, title: 'Halaman Hitung FTS B', mode: 'block' })

    const single = getDb()
      .prepare('SELECT COUNT(*) as cnt FROM pages_fts WHERE page_id = ?')
      .get(a.id) as { cnt: number }
    expect(single.cnt).toBe(1)

    updatePage({
      id: a.id,
      title: 'Halaman Hitung FTS A Revisi',
      blocks: [{ id: 'blk-hitung-1', type: 'paragraph', content: 'revisi hitung fts' }]
    })
    // Update yang tidak menyentuh kolom FTS tidak boleh menggandakan row index.
    updatePage({ id: b.id, isFavorite: true })

    deletePage(b.id)

    expect(countRows('pages_fts')).toBe(countRows('pages'))
    const singleAfter = getDb()
      .prepare('SELECT COUNT(*) as cnt FROM pages_fts WHERE page_id = ?')
      .get(a.id) as { cnt: number }
    expect(singleAfter.cnt).toBe(1)
  })
})

describe('page_aliases — backlink stabil saat rename', () => {
  function aliasRowsFor(pageId: string): Array<{ alias: string; page_id: string }> {
    return getDb()
      .prepare('SELECT alias, page_id FROM page_aliases WHERE page_id = ? ORDER BY alias ASC')
      .all(pageId) as unknown as Array<{ alias: string; page_id: string }>
  }

  function countOrphanAliases(): number {
    const row = getDb()
      .prepare(
        'SELECT COUNT(*) as cnt FROM page_aliases a LEFT JOIN pages p ON p.id = a.page_id WHERE p.id IS NULL'
      )
      .get() as { cnt: number }
    return row?.cnt ?? 0
  }

  function createLinkSource(title: string, targetTitle: string): string {
    const source = createPage({ sectionId, title, mode: 'block' })
    updatePage({
      id: source.id,
      blocks: [
        {
          id: `blk-alias-${source.id}`,
          type: 'paragraph',
          content: `Rujukan ke [[${targetTitle}]] dari catatan ini.`
        }
      ]
    })
    return source.id
  }

  it('rename page tidak memutus backlink [[judul lama]]', () => {
    const target = createPage({ sectionId, title: 'Arsitektur', mode: 'block' })
    const sourceId = createLinkSource('Catatan Arsitektur', 'Arsitektur')

    expect(getBacklinks(target.id).map((b) => b.sourcePageId)).toEqual([sourceId])

    updatePage({ id: target.id, title: 'Arsitektur Baru' })

    const backlinks = getBacklinks(target.id)
    expect(backlinks.map((b) => b.sourcePageId)).toEqual([sourceId])
    expect(backlinks[0].contextSnippet).toContain('[[Arsitektur]]')
    expect(aliasRowsFor(target.id).map((a) => a.alias)).toContain('arsitektur')
  })

  it('setelah rename, [[judul baru]] juga resolve ke page yang sama', () => {
    const target = createPage({ sectionId, title: 'Arsitektur Dua', mode: 'block' })
    const oldRefSource = createLinkSource('Catatan Arsitektur Dua Lama', 'Arsitektur Dua')

    updatePage({ id: target.id, title: 'Arsitektur Dua Baru' })
    const newRefSource = createLinkSource('Catatan Arsitektur Dua Baru', 'Arsitektur Dua Baru')

    const sourceIds = getBacklinks(target.id).map((b) => b.sourcePageId)
    expect(sourceIds).toContain(oldRefSource)
    expect(sourceIds).toContain(newRefSource)
  })

  it('rename berantai: [[A]], [[B]], dan [[C]] menunjuk page yang sama', () => {
    const target = createPage({ sectionId, title: 'Rantai Satu', mode: 'block' })

    updatePage({ id: target.id, title: 'Rantai Dua' })
    updatePage({ id: target.id, title: 'Rantai Tiga' })

    const firstId = createLinkSource('Rantai Sumber Satu', 'Rantai Satu')
    const secondId = createLinkSource('Rantai Sumber Dua', 'Rantai Dua')
    const thirdId = createLinkSource('Rantai Sumber Tiga', 'Rantai Tiga')

    const sourceIds = getBacklinks(target.id).map((b) => b.sourcePageId)
    expect(sourceIds).toContain(firstId)
    expect(sourceIds).toContain(secondId)
    expect(sourceIds).toContain(thirdId)
  })

  it('judul aktif menang atas alias saat dua page bertabrakan judul', () => {
    const incumbent = createPage({ sectionId, title: 'Tabrakan Judul', mode: 'block' })
    const renamer = createPage({ sectionId, title: 'Tabrakan Sumber', mode: 'block' })
    const sourceId = createLinkSource('Catatan Tabrakan', 'Tabrakan Judul')

    updatePage({ id: renamer.id, title: 'Tabrakan Judul' })

    expect(getBacklinks(incumbent.id).map((b) => b.sourcePageId)).toContain(sourceId)
    expect(getBacklinks(renamer.id).map((b) => b.sourcePageId)).not.toContain(sourceId)
    expect(aliasRowsFor(renamer.id).map((a) => a.alias)).toEqual(['tabrakan sumber'])
  })

  it('menghapus page ikut menghapus alias miliknya', () => {
    const page = createPage({ sectionId, title: 'Alias Akan Hilang', mode: 'block' })
    updatePage({ id: page.id, title: 'Alias Akan Hilang Baru' })

    expect(aliasRowsFor(page.id)).toHaveLength(1)

    deletePage(page.id)

    expect(aliasRowsFor(page.id)).toHaveLength(0)
    expect(countOrphanAliases()).toBe(0)
  })

  it('rename ke judul kosong tidak membuat alias dan memakai judul fallback', () => {
    const page = createPage({ sectionId, title: 'Judul Kosong Uji', mode: 'block' })

    const updated = updatePage({ id: page.id, title: '   ' })

    expect(updated.title).toBe('Halaman Tanpa Judul')
    expect(aliasRowsFor(page.id)).toHaveLength(0)
    expect(getWorkspaceSnapshot().pages.find((p) => p.id === page.id)?.title).toBe(
      'Halaman Tanpa Judul'
    )
  })
})

describe('migrasi page_versions.tags_json', () => {
  const versionColumns = (): string[] =>
    (getDb().prepare('PRAGMA table_info(page_versions)').all() as Array<{ name: string }>).map(
      (column) => column.name
    )

  it('idempoten saat database dibuka ulang', () => {
    expect(versionColumns()).toContain('tags_json')

    closeDb()
    initDatabase(tempDir)

    expect(versionColumns().filter((name) => name === 'tags_json')).toHaveLength(1)
  })
})

