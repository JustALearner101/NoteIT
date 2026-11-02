import { describe, expect, it } from 'vitest'
import { parseGitPorcelainOutput } from './repo.service'

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
})
