import { describe, expect, it } from 'vitest'
import { applyBlocksInsertion, parseMarkdownToBlocks } from './markdown-to-blocks'
import type { DocumentBlock } from './types/domain'

describe('parseMarkdownToBlocks', () => {
  it('returns an empty array for blank input', () => {
    expect(parseMarkdownToBlocks('   \n\n  ')).toEqual([])
  })

  it('parses headings, paragraphs, checklists, callouts, and dividers', () => {
    const md = [
      '# Architecture Overview',
      '',
      'This service handles authentication.',
      'Second line of the same paragraph.',
      '',
      '## Action Items',
      '- [ ] Add rate limiter',
      '- [x] Write unit tests',
      '',
      '> Keep tokens encrypted at rest.',
      '',
      '---',
      '### Notes'
    ].join('\n')

    const blocks = parseMarkdownToBlocks(md, { idPrefix: 't', now: 1 })
    expect(blocks.map((b) => b.type)).toEqual([
      'h1',
      'paragraph',
      'h2',
      'checklist',
      'checklist',
      'callout',
      'divider',
      'h3'
    ])
    expect(blocks[0].content).toBe('Architecture Overview')
    expect(blocks[1].content).toBe(
      'This service handles authentication.\nSecond line of the same paragraph.'
    )
    expect(blocks[3]).toMatchObject({
      type: 'checklist',
      checked: false,
      content: 'Add rate limiter'
    })
    expect(blocks[4]).toMatchObject({
      type: 'checklist',
      checked: true,
      content: 'Write unit tests'
    })
    expect(blocks[5]).toMatchObject({
      type: 'callout',
      content: 'Keep tokens encrypted at rest.'
    })
  })

  it('maps mermaid, dbml, graphviz/dot, and code fences to native block types', () => {
    const md = [
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
      '',
      '```dbml',
      'Table users {',
      '  id int [pk]',
      '}',
      '```',
      '',
      '```dot',
      'digraph G { a -> b }',
      '```',
      '',
      '```typescript',
      'export const x = 42',
      '```'
    ].join('\n')

    const blocks = parseMarkdownToBlocks(md, { idPrefix: 'd', now: 2 })
    expect(blocks.map((b) => b.type)).toEqual(['mermaid', 'dbml', 'graphviz', 'code'])
    expect(blocks[0]).toMatchObject({ type: 'mermaid', wide: true, content: 'flowchart LR\n  A --> B' })
    expect(blocks[1]).toMatchObject({ type: 'dbml', wide: true })
    expect(blocks[2]).toMatchObject({ type: 'graphviz', wide: true, content: 'digraph G { a -> b }' })
    expect(blocks[3]).toMatchObject({
      type: 'code',
      language: 'typescript',
      content: 'export const x = 42'
    })
  })

  it('parses display math ($$) and GFM markdown tables into native math & table blocks', () => {
    const md = [
      '$$',
      'E = mc^2',
      '$$',
      '',
      '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
      '',
      '| Metric | Value |',
      '| --- | ---: |',
      '| Latency | 12ms |'
    ].join('\n')

    const blocks = parseMarkdownToBlocks(md, { idPrefix: 'm', now: 3 })
    expect(blocks.map((b) => b.type)).toEqual(['math', 'math', 'table'])
    expect(blocks[0].content).toBe('E = mc^2')
    expect(blocks[1].content).toBe('\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}')
    expect(blocks[2]).toMatchObject({
      type: 'table',
      wide: true,
      content: '| Metric | Value |\n| --- | ---: |\n| Latency | 12ms |'
    })
  })
})

describe('applyBlocksInsertion', () => {
  const base: DocumentBlock[] = [
    { id: 'b1', type: 'h1', content: 'Title' },
    { id: 'b2', type: 'paragraph', content: 'Draft', columnGroupId: 'cg-1', columnIndex: 1 },
    { id: 'b3', type: 'paragraph', content: 'Footer' }
  ]

  const incoming: DocumentBlock[] = [
    { id: 'n1', type: 'paragraph', content: 'Refined A' },
    { id: 'n2', type: 'paragraph', content: 'Refined B' }
  ]

  it('appends blocks to the end', () => {
    const result = applyBlocksInsertion(base, incoming, { mode: 'append' })
    expect(result.map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 'n1', 'n2'])
  })

  it('inserts after target block and preserves column metadata', () => {
    const result = applyBlocksInsertion(base, incoming, { mode: 'insert-after', blockId: 'b2' })
    expect(result.map((b) => b.id)).toEqual(['b1', 'b2', 'n1', 'n2', 'b3'])
    expect(result[2]).toMatchObject({ columnGroupId: 'cg-1', columnIndex: 1 })
    expect(result[3]).toMatchObject({ columnGroupId: 'cg-1', columnIndex: 1 })
  })

  it('replaces target block and preserves column metadata', () => {
    const result = applyBlocksInsertion(base, incoming, { mode: 'replace', blockId: 'b2' })
    expect(result.map((b) => b.id)).toEqual(['b1', 'n1', 'n2', 'b3'])
    expect(result[1]).toMatchObject({ columnGroupId: 'cg-1', columnIndex: 1 })
  })

  it('falls back to append if target blockId is missing', () => {
    const result = applyBlocksInsertion(base, incoming, { mode: 'replace', blockId: 'missing' })
    expect(result.map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 'n1', 'n2'])
  })
})
