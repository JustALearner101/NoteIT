import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readUiState, writeUiState } from './ui-state.service'

describe('ui-state.service (Atomic workspace/ui-state.json persistence)', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-ui-state-test-'))
  })

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns null when ui-state.json does not exist yet', () => {
    expect(readUiState(tempDir)).toBeNull()
  })

  it('atomically writes and reads tab order, split ratio, closed tabs, and sidebar collapse state', () => {
    const saved = writeUiState(
      {
        openTabIds: ['pg-2', 'pg-1', 'pg-3'],
        activePageId: 'pg-2',
        splitPageId: 'pg-3',
        splitRatio: 0.62,
        closedTabIds: ['pg-4'],
        isSidebarCollapsed: true,
        activeNotebookId: 'nb-1'
      },
      tempDir
    )

    expect(saved.splitRatio).toBe(0.62)
    const loaded = readUiState(tempDir)
    expect(loaded).toEqual({
      openTabIds: ['pg-2', 'pg-1', 'pg-3'],
      activePageId: 'pg-2',
      splitPageId: 'pg-3',
      splitRatio: 0.62,
      closedTabIds: ['pg-4'],
      isSidebarCollapsed: true,
      activeNotebookId: 'nb-1'
    })

    // Clamps out-of-range splitRatio
    writeUiState({ splitRatio: 0.99 }, tempDir)
    expect(readUiState(tempDir)?.splitRatio).toBe(0.8)
  })
})
