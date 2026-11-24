import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  discardRepoFileChanges,
  getFileGitDiff,
  parseGitPorcelainOutput,
  readRepoFile,
  resolveSafeRepoFilePath,
  searchRepoCode,
  writeRepoFile
} from './repo.service'

describe('repo.service', () => {
  describe('parseGitPorcelainOutput', () => {
    it('correctly maps modified, untracked, added, deleted, and renamed files', () => {
      const samplePorcelain = [
        ' M src/main/index.ts',
        '?? docs/NEW_SPEC.md',
        'A  src/main/services/repo.service.ts',
        ' D old_file.txt',
        'R  src/old.ts -> src/new.ts'
      ].join('\n')

      const map = parseGitPorcelainOutput(samplePorcelain)

      expect(map.get('src/main/index.ts')).toBe('modified')
      expect(map.get('docs/NEW_SPEC.md')).toBe('untracked')
      expect(map.get('src/main/services/repo.service.ts')).toBe('added')
      expect(map.get('old_file.txt')).toBe('deleted')
      expect(map.get('src/new.ts')).toBe('renamed')
    })

    it('returns empty map on empty output', () => {
      const map = parseGitPorcelainOutput('')
      expect(map.size).toBe(0)
    })
  })

  describe('resolveSafeRepoFilePath & Git Diff / Write / Discard', () => {
    let tempRepoDir: string

    beforeAll(() => {
      tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-repo-test-'))
      execFileSync('git', ['init'], { cwd: tempRepoDir })
      execFileSync('git', ['config', 'user.email', 'test@noteit.local'], { cwd: tempRepoDir })
      execFileSync('git', ['config', 'user.name', 'NoteIT Test'], { cwd: tempRepoDir })

      fs.mkdirSync(path.join(tempRepoDir, 'src'), { recursive: true })
      fs.writeFileSync(
        path.join(tempRepoDir, 'src', 'hello.ts'),
        'export const a = 1\nexport const b = 2\n',
        'utf-8'
      )
      execFileSync('git', ['add', '.'], { cwd: tempRepoDir })
      execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: tempRepoDir })
    })

    afterAll(() => {
      fs.rmSync(tempRepoDir, { recursive: true, force: true })
    })

    it('rejects path traversal (../outside.txt), null bytes, absolute/cross-drive paths, and NoteIT DB files', () => {
      expect(() => resolveSafeRepoFilePath(tempRepoDir, '../outside.txt')).toThrow(/denied/i)
      expect(() => resolveSafeRepoFilePath(tempRepoDir, 'src/../../outside.txt')).toThrow(/denied/i)
      expect(() => resolveSafeRepoFilePath(tempRepoDir, '/etc/passwd')).toThrow(/denied/i)
      expect(() => resolveSafeRepoFilePath(tempRepoDir, 'C:\\Windows\\System32\\cmd.exe')).toThrow(
        /denied/i
      )
      expect(() => resolveSafeRepoFilePath(tempRepoDir, 'src/hello.ts\0.txt')).toThrow(/invalid/i)
      expect(() => resolveSafeRepoFilePath(tempRepoDir, 'noteit-v2.db')).toThrow(/denied/i)
      expect(() => resolveSafeRepoFilePath(tempRepoDir, 'nested/noteit-v2.db-wal')).toThrow(
        /denied/i
      )
    })

    it('computes HEAD vs working tree diff, atomic write, and discard changes', async () => {
      // Clean state first
      const cleanDiff = await getFileGitDiff(tempRepoDir, 'src/hello.ts')
      expect(cleanDiff.status).toBe('clean')
      expect(cleanDiff.headContent.replace(/\r\n/g, '\n')).toBe(
        'export const a = 1\nexport const b = 2\n'
      )
      expect(cleanDiff.additions).toBe(0)
      expect(cleanDiff.deletions).toBe(0)

      // Modify file via writeRepoFile
      await writeRepoFile(
        tempRepoDir,
        'src/hello.ts',
        'export const a = 1\nexport const b = 42\nexport const c = 3\n'
      )

      const modDiff = await getFileGitDiff(tempRepoDir, 'src/hello.ts')
      expect(modDiff.status).toBe('modified')
      expect(modDiff.additions).toBe(2)
      expect(modDiff.deletions).toBe(1)

      // Line-ranged read
      const slice = await readRepoFile(tempRepoDir, 'src/hello.ts', {
        startLine: 2,
        endLine: 3
      })
      expect(slice.content).toBe('export const b = 42\nexport const c = 3')

      // Search repo code
      const hits = await searchRepoCode(tempRepoDir, 'b = 42')
      expect(hits.length).toBe(1)
      expect(hits[0].relPath).toBe('src/hello.ts')
      expect(hits[0].line).toBe(2)

      // Discard changes back to HEAD
      await discardRepoFileChanges(tempRepoDir, 'src/hello.ts')
      const afterDiscard = await getFileGitDiff(tempRepoDir, 'src/hello.ts')
      expect(afterDiscard.status).toBe('clean')
      expect(afterDiscard.workingContent.replace(/\r\n/g, '\n')).toBe(
        'export const a = 1\nexport const b = 2\n'
      )
    })
  })
})
