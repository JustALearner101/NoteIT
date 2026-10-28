import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db/client'
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

// Ids are generated from Date.now(), so consecutive creations need a different
// millisecond to avoid primary-key collisions. Tests must not change that
// behaviour, they only work around it.
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 3))

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

  it('createNotebook -> createSection -> createPage (block) muncul di snapshot', async () => {
    const notebook = createNotebook({ name: 'Notebook Uji', icon: '🧪', color: 'teal' })
    notebookId = notebook.id
    expect(notebook.name).toBe('Notebook Uji')
    expect(notebook.sortOrder).toBe(3)

    await tick()
    const section = createSection({
      notebookId: notebook.id,
      name: 'Section Uji',
      color: 'amber'
    })
    sectionId = section.id
    expect(section.notebookId).toBe(notebook.id)
    // createNotebook otomatis membuat satu section, jadi section berikutnya adalah SEC-06.
    expect(section.code).toBe('SEC-06')

    await tick()
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

  it('updatePage mengubah judul dan blocks serta menaikkan updatedAt', async () => {
    const before = getWorkspaceSnapshot().pages.find((p) => p.id === pageId)
    expect(before).toBeDefined()

    await tick()
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

  it('getBacklinks mengembalikan link ketika page berisi [[Judul]] page lain', async () => {
    await tick()
    const target = createPage({
      sectionId,
      title: 'Halaman Target Backlink',
      mode: 'block'
    })

    await tick()
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

  it('createPageSnapshot lalu restorePageSnapshot mengembalikan blocks versi snapshot', async () => {
    const snapshot = createPageSnapshot(pageId, 'Snapshot Uji')
    expect(snapshot.pageId).toBe(pageId)
    expect(snapshot.label).toBe('Snapshot Uji')
    expect(snapshot.blocks[0].content).toContain('zettelkasten')

    await tick()
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

  it('deletePage menghapus page dan hasil search-nya', () => {
    expect(searchWorkspace('zettelkasten').some((r) => r.pageId === pageId)).toBe(true)

    const result = deletePage(pageId)
    expect(result).toEqual({ ok: true })

    expect(getWorkspaceSnapshot().pages.some((p) => p.id === pageId)).toBe(false)
    expect(searchWorkspace('zettelkasten').some((r) => r.pageId === pageId)).toBe(false)
  })
})
