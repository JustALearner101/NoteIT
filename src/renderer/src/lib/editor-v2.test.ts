import { describe, expect, it } from 'vitest'
import {
  applyInlineMarkdownShortcut,
  filterSlashOptions,
  matchSlashTrigger,
  matchWikiAutocompleteTrigger,
  reorderTopLevelBlocks
} from './editor-v2'
import type { DocumentBlock } from '@shared/types/domain'

describe('editor-v2 pure helpers', () => {
  describe('filterSlashOptions & matchSlashTrigger', () => {
    it('filters slash options by fuzzy query (/dbml, /col, /tog, /div)', () => {
      expect(filterSlashOptions('/dbml').map((o) => o.type)).toContain('dbml')
      expect(filterSlashOptions('col').some((o) => o.type === 'columns')).toBe(true)
      expect(filterSlashOptions('toggle').map((o) => o.type)).toEqual(['toggle'])
      expect(filterSlashOptions('divider').map((o) => o.type)).toEqual(['divider'])
    })

    it('detects active slash trigger at end of block text', () => {
      expect(matchSlashTrigger('Hello /dbm')).toEqual({
        query: 'dbm',
        triggerStart: 6
      })
      expect(matchSlashTrigger('/mer')).toEqual({
        query: 'mer',
        triggerStart: 0
      })
      expect(matchSlashTrigger('https://example.com/path')).toBeNull()
    })
  })

  describe('matchWikiAutocompleteTrigger', () => {
    it('detects unclosed [[ query before cursor and ignores closed [[...]]', () => {
      expect(matchWikiAutocompleteTrigger('See [[Arch')).toEqual({
        query: 'Arch',
        triggerStart: 4,
        cursorEnd: 10
      })
      expect(matchWikiAutocompleteTrigger('See [[src/main/index.ts#L')).toEqual({
        query: 'src/main/index.ts#L',
        triggerStart: 4,
        cursorEnd: 25
      })
      expect(matchWikiAutocompleteTrigger('See [[Architecture]] done')).toBeNull()
    })
  })

  describe('applyInlineMarkdownShortcut', () => {
    it('wraps and unwraps bold (**), italic (*), inline code (`), and strikethrough (~~)', () => {
      const bolded = applyInlineMarkdownShortcut('hello world', 6, 11, 'bold')
      expect(bolded).toEqual({
        text: 'hello **world**',
        selectionStart: 8,
        selectionEnd: 13
      })

      // Toggle off when already wrapped
      const unbolded = applyInlineMarkdownShortcut(
        bolded.text,
        bolded.selectionStart,
        bolded.selectionEnd,
        'bold'
      )
      expect(unbolded.text).toBe('hello world')

      const coded = applyInlineMarkdownShortcut('run npm test now', 4, 12, 'code')
      expect(coded.text).toBe('run `npm test` now')

      const struck = applyInlineMarkdownShortcut('old requirement', 0, 3, 'strike')
      expect(struck.text).toBe('~~old~~ requirement')
    })
  })

  describe('reorderTopLevelBlocks', () => {
    const sampleBlocks: DocumentBlock[] = [
      { id: 'b1', type: 'h1', content: 'Title' },
      { id: 'b2', type: 'paragraph', content: 'Para 1' },
      { id: 'b3', type: 'code', content: 'const x = 1' }
    ]

    it('reorders top-level blocks before or after target and returns null on no-op', () => {
      const movedAfter = reorderTopLevelBlocks(sampleBlocks, 'b1', 'b3', 'after')
      expect(movedAfter?.map((b) => b.id)).toEqual(['b2', 'b3', 'b1'])

      const movedBefore = reorderTopLevelBlocks(sampleBlocks, 'b3', 'b1', 'before')
      expect(movedBefore?.map((b) => b.id)).toEqual(['b3', 'b1', 'b2'])

      expect(reorderTopLevelBlocks(sampleBlocks, 'b1', 'b1', 'after')).toBeNull()
    })
  })
})
