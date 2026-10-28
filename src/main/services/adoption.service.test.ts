import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, getDb, initDatabase } from '../db/client'
import { ensureInboxSection, getWorkspaceSnapshot } from './workspace.service'

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
