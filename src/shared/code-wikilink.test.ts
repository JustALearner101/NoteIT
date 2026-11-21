import { describe, expect, it } from 'vitest'
import { parseCodeWikiLink } from './code-wikilink'

describe('parseCodeWikiLink', () => {
  it('parses file paths with single line anchors (#L120)', () => {
    const res = parseCodeWikiLink('src/main/index.ts#L120')
    expect(res).toEqual({
      relPath: 'src/main/index.ts',
      startLine: 120,
      endLine: undefined,
      displayLabel: 'src/main/index.ts#L120'
    })
  })

  it('parses file paths with line range anchors (#L10-L25 and #L10-25)', () => {
    expect(parseCodeWikiLink('src/main/services/repo.service.ts#L10-L25')).toEqual({
      relPath: 'src/main/services/repo.service.ts',
      startLine: 10,
      endLine: 25,
      displayLabel: 'src/main/services/repo.service.ts#L10-L25'
    })

    expect(parseCodeWikiLink('src/main/services/repo.service.ts#L10-25')).toEqual({
      relPath: 'src/main/services/repo.service.ts',
      startLine: 10,
      endLine: 25,
      displayLabel: 'src/main/services/repo.service.ts#L10-L25'
    })
  })

  it('normalizes reversed line ranges and Windows backslashes', () => {
    const res = parseCodeWikiLink('src\\renderer\\src\\App.tsx#L50-L20')
    expect(res).toEqual({
      relPath: 'src/renderer/src/App.tsx',
      startLine: 20,
      endLine: 50,
      displayLabel: 'src/renderer/src/App.tsx#L20-L50'
    })
  })

  it('parses relative repository file paths without line anchors', () => {
    expect(parseCodeWikiLink('src/shared/ipc-channels.ts')).toEqual({
      relPath: 'src/shared/ipc-channels.ts',
      startLine: undefined,
      endLine: undefined,
      displayLabel: 'src/shared/ipc-channels.ts'
    })

    expect(parseCodeWikiLink('package.json')).toEqual({
      relPath: 'package.json',
      startLine: undefined,
      endLine: undefined,
      displayLabel: 'package.json'
    })
  })

  it('returns null for normal NoteIT page titles', () => {
    expect(parseCodeWikiLink('Architecture Blueprint')).toBeNull()
    expect(parseCodeWikiLink('Database Schema & ERD')).toBeNull()
    expect(parseCodeWikiLink('Sprint 12 Roadmap')).toBeNull()
    expect(parseCodeWikiLink('PG-101')).toBeNull()
  })

  it('rejects path traversal, absolute paths, and invalid targets', () => {
    expect(parseCodeWikiLink('../outside.ts')).toBeNull()
    expect(parseCodeWikiLink('src/../../etc/passwd')).toBeNull()
    expect(parseCodeWikiLink('/etc/passwd')).toBeNull()
    expect(parseCodeWikiLink('C:\\Windows\\System32\\cmd.exe')).toBeNull()
    expect(parseCodeWikiLink('https://example.com/file.ts')).toBeNull()
    expect(parseCodeWikiLink('')).toBeNull()
  })
})
