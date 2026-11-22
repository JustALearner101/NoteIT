import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db/client'
import {
  computeLocalTrigramVector,
  hybridSemanticSearch,
  syncWorkspaceEmbeddings
} from './embedding.service'

describe('embedding.service (Hybrid SQLite Vector + FTS5 Search)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-embed-test-'))
    initDatabase(tmpDir)
  })

  afterEach(() => {
    closeDb()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('produces normalized 128-dim local trigram vectors and indexes workspace pages incrementally', async () => {
    const v1 = computeLocalTrigramVector('SQLite WAL concurrency')
    expect(v1).toHaveLength(128)
    const mag = Math.sqrt(v1.reduce((acc, x) => acc + x * x, 0))
    expect(mag).toBeCloseTo(1, 3)

    const first = await syncWorkspaceEmbeddings()
    expect(first.total).toBeGreaterThan(0)
    expect(first.indexed).toBe(first.total)

    // Second run skips unchanged pages
    const second = await syncWorkspaceEmbeddings()
    expect(second.indexed).toBe(0)
  })

  it('returns ranked hybrid semantic search hits across seeded pages', async () => {
    const hits = await hybridSemanticSearch('architecture database schema', 5)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].score).toBeGreaterThan(0)
  })
})
