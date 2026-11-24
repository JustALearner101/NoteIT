import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db/client'
import { addBrowserBookmark, deleteBrowserBookmark, listBrowserBookmarks } from './browser.service'

describe('browser.service (Web Workbench Bookmarks)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-browser-test-'))
    initDatabase(tmpDir)
  })

  afterEach(() => {
    closeDb()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('starts 100% empty on fresh DB, then adds and deletes custom bookmarks', () => {
    expect(listBrowserBookmarks()).toHaveLength(0)

    const added = addBrowserBookmark({
      title: 'LearnHarness Repo',
      url: 'https://github.com/amosblomqvist/learnharness'
    })
    expect(added.title).toBe('LearnHarness Repo')

    const afterAdd = listBrowserBookmarks()
    expect(afterAdd.some((b) => b.id === added.id)).toBe(true)

    deleteBrowserBookmark(added.id)
    const afterDelete = listBrowserBookmarks()
    expect(afterDelete.some((b) => b.id === added.id)).toBe(false)
  })
})
