import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDatabase, seedInitialWorkspace } from '../db/client'
import {
  deleteAgentSession,
  findAgentSessionById,
  insertAgentSession,
  listAgentSessions,
  resolveWorktreePath,
  safeUnlinkJunctions,
  updateAgentSession
} from './worktree.service'
import type { AgentSessionRecord } from '@shared/types/domain'

let tempDir: string

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-worktree-test-'))
  const db = initDatabase(tempDir)
  seedInitialWorkspace(db)
})

afterAll(() => {
  closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('worktree.service', () => {
  describe('resolveWorktreePath', () => {
    it('creates sibling worktree path with sanitized slug', () => {
      const repoPath = path.join(tempDir, 'MyRepo')
      const slug = 'feat/SPEC-101 Login UI!'
      const resolved = resolveWorktreePath(repoPath, slug)

      expect(resolved).toContain('MyRepo-worktrees')
      expect(resolved).toContain('feat-spec-101-login-ui-')
      // Path must be sibling to repoPath
      expect(path.dirname(path.dirname(resolved))).toBe(path.dirname(repoPath))
    })
  })

  describe('safeUnlinkJunctions', () => {
    it('safely unlinks directory symlinks without deleting original target content', () => {
      const testWorktreeDir = path.join(tempDir, 'fake-worktree')
      const originalTargetDir = path.join(tempDir, 'fake-original-node-modules')
      fs.mkdirSync(testWorktreeDir, { recursive: true })
      fs.mkdirSync(originalTargetDir, { recursive: true })

      // Create a canary file in the original target
      const canaryFile = path.join(originalTargetDir, 'canary.txt')
      fs.writeFileSync(canaryFile, 'DO_NOT_DELETE', 'utf-8')

      // Create symlink/junction inside testWorktreeDir pointing to originalTargetDir
      const linkPath = path.join(testWorktreeDir, 'node_modules')
      const linkType = process.platform === 'win32' ? 'junction' : 'dir'
      fs.symlinkSync(originalTargetDir, linkPath, linkType)

      expect(fs.existsSync(linkPath)).toBe(true)

      // Unlink safely
      const unlinked = safeUnlinkJunctions(testWorktreeDir)
      expect(unlinked).toContain('node_modules')

      // Link should no longer exist
      expect(fs.existsSync(linkPath)).toBe(false)

      // CRITICAL: The canary in the original target directory MUST still exist intact!
      expect(fs.existsSync(canaryFile)).toBe(true)
      expect(fs.readFileSync(canaryFile, 'utf-8')).toBe('DO_NOT_DELETE')
    })
  })

  describe('SQLite Agent Sessions CRUD', () => {
    const mockSession: AgentSessionRecord = {
      id: 'sess-test-01',
      notebookId: 'nb-eng-core',
      sectionId: 'sec-arch',
      pageId: 'pg-101',
      taskCode: 'SPEC-101',
      title: 'Auth Pipeline Refactor',
      agentPreset: 'claude-code',
      command: 'claude --dangerously-skip-permissions',
      approvalMode: 'ask-edit',
      isolationMode: 'worktree',
      repoPath: 'D:\\Project\\NoteIT',
      worktreePath: 'D:\\Project\\NoteIT-worktrees\\spec-101',
      branchName: 'feat/spec-101',
      status: 'idle',
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      lastOutputTail: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    it('inserts and finds agent session record', () => {
      insertAgentSession(mockSession)
      const found = findAgentSessionById(mockSession.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(mockSession.id)
      expect(found?.title).toBe(mockSession.title)
      expect(found?.agentPreset).toBe('claude-code')
      expect(found?.status).toBe('idle')
      expect(found?.worktreePath).toBe(mockSession.worktreePath)
    })

    it('updates session status and code metrics', () => {
      updateAgentSession(mockSession.id, {
        status: 'thinking',
        filesChanged: 3,
        linesAdded: 45,
        linesRemoved: 12,
        lastOutputTail: 'Compiling typescript...'
      })

      const updated = findAgentSessionById(mockSession.id)
      expect(updated?.status).toBe('thinking')
      expect(updated?.filesChanged).toBe(3)
      expect(updated?.linesAdded).toBe(45)
      expect(updated?.linesRemoved).toBe(12)
      expect(updated?.lastOutputTail).toBe('Compiling typescript...')
    })

    it('lists sessions with notebook filter', () => {
      const all = listAgentSessions()
      expect(all.length).toBeGreaterThanOrEqual(1)

      const filtered = listAgentSessions('nb-eng-core')
      expect(filtered.some((s) => s.id === mockSession.id)).toBe(true)

      const nonExistent = listAgentSessions('non-existent-nb')
      expect(nonExistent).toHaveLength(0)
    })

    it('deletes agent session record', () => {
      deleteAgentSession(mockSession.id)
      const notFound = findAgentSessionById(mockSession.id)
      expect(notFound).toBeNull()
    })
  })
})
