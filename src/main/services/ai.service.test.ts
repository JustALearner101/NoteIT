import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDatabase, seedInitialWorkspace } from '../db/client'
import { getWorkspaceSnapshot, updateNotebookRepo } from './workspace.service'
import { executeAIChatStream, executeApprovedProposal } from './ai.service'
import type { AIChatStreamEvent } from '@shared/ipc-channels'

let tempDir: string
let tempRepoDir: string

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-ai-test-'))
  const db = initDatabase(tempDir)
  seedInitialWorkspace(db)

  tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-ai-repo-'))
  execFileSync('git', ['init'], { cwd: tempRepoDir })
  execFileSync('git', ['config', 'user.email', 'test@noteit.local'], { cwd: tempRepoDir })
  execFileSync('git', ['config', 'user.name', 'NoteIT Test'], { cwd: tempRepoDir })
  fs.mkdirSync(path.join(tempRepoDir, 'src'), { recursive: true })
  fs.writeFileSync(path.join(tempRepoDir, 'src', 'config.ts'), 'export const PORT = 3000\n', 'utf-8')
  execFileSync('git', ['add', '.'], { cwd: tempRepoDir })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: tempRepoDir })

  const snap = getWorkspaceSnapshot()
  updateNotebookRepo({
    notebookId: snap.notebooks[0].id,
    repoPath: tempRepoDir,
    defaultBranch: 'main'
  })
})

afterAll(() => {
  closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
  fs.rmSync(tempRepoDir, { recursive: true, force: true })
})

describe('ai.service (Strict Live-Only + ADE Proposal Execution)', () => {
  it('emits an explicit error when no live AI provider is configured (zero hardcoded fallback)', async () => {
    const snap = getWorkspaceSnapshot()
    const targetPage = snap.pages[0]

    const events: AIChatStreamEvent[] = []
    await executeAIChatStream(
      {
        requestId: 'req-unconfigured-1',
        provider: 'gemini',
        modelId: 'gemini-2.5-flash',
        chatMode: 'Free chat',
        approvalMode: 'ask',
        activePageId: targetPage.id,
        mentionedPageIds: [],
        messages: [{ role: 'user', content: 'Buatkan skema DBML untuk auth' }]
      },
      (event) => events.push(event)
    )

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('error')
    if (events[0].type === 'error') {
      expect(events[0].error).toMatch(/No AI provider is configured/i)
    }
    expect(events.some((e) => e.type === 'text-delta')).toBe(false)
  })

  it('executes approved spec-blocks proposals into SQLite', async () => {
    const snapBefore = getWorkspaceSnapshot()
    const targetPage = snapBefore.pages[0]
    const initialBlockCount = targetPage.blocks.length

    const res = await executeApprovedProposal({
      proposalId: 'prop-spec-1',
      kind: 'spec-blocks',
      targetPageId: targetPage.id,
      targetPageCode: targetPage.code,
      targetPageTitle: targetPage.title,
      summary: 'Insert DBML block',
      blocks: [{ type: 'dbml', content: 'Table users { id uuid [pk] }' }],
      status: 'approved'
    })

    expect(res.ok).toBe(true)
    const snapAfter = getWorkspaceSnapshot()
    const updated = snapAfter.pages.find((p) => p.id === targetPage.id)!
    expect(updated.blocks.length).toBe(initialBlockCount + 1)
    expect(updated.blocks.at(-1)?.type).toBe('dbml')
  })

  it('executes approved repo-file-edit proposals only inside bound repositories', async () => {
    const res = await executeApprovedProposal({
      proposalId: 'prop-edit-1',
      kind: 'repo-file-edit',
      targetPageId: '',
      targetPageCode: 'REPO',
      targetPageTitle: 'src/config.ts',
      summary: 'Update PORT to 8080',
      blocks: [],
      status: 'approved',
      repoFileEdit: {
        repoPath: tempRepoDir,
        relPath: 'src/config.ts',
        originalContent: 'export const PORT = 3000\n',
        newContent: 'export const PORT = 8080\n',
        language: 'typescript'
      }
    })

    expect(res.ok).toBe(true)
    expect(fs.readFileSync(path.join(tempRepoDir, 'src', 'config.ts'), 'utf-8')).toContain(
      'PORT = 8080'
    )

    // Unbound directory must be rejected
    const outsideRes = await executeApprovedProposal({
      proposalId: 'prop-edit-outside',
      kind: 'repo-file-edit',
      targetPageId: '',
      targetPageCode: 'REPO',
      targetPageTitle: 'outside.txt',
      summary: 'Try outside write',
      blocks: [],
      status: 'approved',
      repoFileEdit: {
        repoPath: os.tmpdir(),
        relPath: 'outside.txt',
        originalContent: '',
        newContent: 'nope',
        language: 'plaintext'
      }
    })
    expect(outsideRes.ok).toBe(false)
  })
})
