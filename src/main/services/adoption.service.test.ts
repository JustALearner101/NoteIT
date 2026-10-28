import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, getDb, initDatabase } from '../db/client'
import {
  createQuickNote,
  ensureInboxSection,
  getWorkspaceSnapshot
} from './workspace.service'

let tempDir: string

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-adoption-'))
  initDatabase(tempDir)
})

afterAll(() => {
  closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

function sectionsNamed(name: string): Array<{ id: string; color: string; code: string }> {
  return getWorkspaceSnapshot()
    .sections.filter((section) => section.name.trim().toLowerCase() === name.toLowerCase())
    .map((section) => ({ id: section.id, color: section.color, code: section.code }))
}

describe('ensureInboxSection', () => {
  it('idempoten: dipanggil 5x tetap menghasilkan satu section INBOX', () => {
    const ids = Array.from({ length: 5 }, () => ensureInboxSection().id)

    expect(new Set(ids).size).toBe(1)
    expect(sectionsNamed('inbox')).toHaveLength(1)
  })

  it('section INBOX memakai warna slate dan kode mengikuti pola MAX section', () => {
    const inbox = ensureInboxSection()
    const codes = getWorkspaceSnapshot().sections.map((section) => section.code)

    expect(inbox.name).toBe('INBOX')
    expect(inbox.color).toBe('slate')
    expect(inbox.code).toMatch(/^SEC-\d{2}$/)
    expect(codes.filter((code) => code === inbox.code)).toHaveLength(1)
  })

  it('membuat notebook default Catatan Pribadi bila database belum punya notebook', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-empty-'))

    closeDb()
    initDatabase(emptyDir)
    getDb().exec('DELETE FROM pages; DELETE FROM sections; DELETE FROM notebooks;')

    const section = ensureInboxSection()
    const snapshot = getWorkspaceSnapshot()

    expect(snapshot.notebooks).toHaveLength(1)
    expect(snapshot.notebooks[0].name).toBe('Catatan Pribadi')
    expect(snapshot.notebooks[0].icon.length).toBeGreaterThan(0)
    expect(section.notebookId).toBe(snapshot.notebooks[0].id)
    expect(sectionsNamed('inbox')).toHaveLength(1)

    closeDb()
    initDatabase(tempDir)
    fs.rmSync(emptyDir, { recursive: true, force: true })
  })
})

describe('createQuickNote', () => {
  it('teks multi-baris: baris pertama jadi judul, sisanya satu blok paragraph', () => {
    const page = createQuickNote('Belanja bahan rapat\n\nBeli kopi dan gula')

    expect(page.title).toBe('Belanja bahan rapat')
    expect(page.mode).toBe('block')
    expect(page.tags).toEqual([])
    expect(page.blocks).toHaveLength(1)
    expect(page.blocks[0].type).toBe('paragraph')
    expect(page.blocks[0].content).toBe('Beli kopi dan gula')
  })

  it('page capture masuk ke section INBOX', () => {
    const inbox = ensureInboxSection()
    const page = createQuickNote('Ide liar dari hotkey')

    expect(page.sectionId).toBe(inbox.id)
    const persisted = getWorkspaceSnapshot().pages.find((p) => p.id === page.id)
    expect(persisted?.sectionId).toBe(inbox.id)
    expect(persisted?.title).toBe('Ide liar dari hotkey')
  })

  it('judul dipotong maksimal 80 karakter di batas kata', () => {
    const longLine = 'Kata '.repeat(20).trim()
    expect(longLine.length).toBeGreaterThan(80)

    const page = createQuickNote(longLine)

    expect(page.title.length).toBeLessThanOrEqual(80)
    expect(page.title.endsWith('Kata')).toBe(true)
    expect(longLine.startsWith(page.title)).toBe(true)
  })

  it('baris pertama tanpa spasi tetap dipotong tepat 80 karakter', () => {
    const page = createQuickNote('x'.repeat(120))
    expect(page.title).toBe('x'.repeat(80))
  })

  it('teks satu baris menghasilkan blocks kosong', () => {
    const page = createQuickNote('  Satu baris saja  ')
    expect(page.title).toBe('Satu baris saja')
    expect(page.blocks).toEqual([])
  })

  it('teks kosong atau spasi saja ditolak dengan pesan Indonesia', () => {
    expect(() => createQuickNote('   ')).toThrow(/tidak boleh kosong/i)
    expect(() => createQuickNote('\n\n\t')).toThrow(/tidak boleh kosong/i)
  })
})
