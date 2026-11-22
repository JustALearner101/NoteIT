import { describe, expect, it } from 'vitest'
import { buildClipBlocksFromExtraction, normalizeBrowserUrl } from './web-clipper'

describe('web-clipper', () => {
  it('normalizes URLs, localhost shortcuts, and search queries', () => {
    expect(normalizeBrowserUrl('localhost:3000/api')).toBe('http://localhost:3000/api')
    expect(normalizeBrowserUrl('github.com/amosblomqvist/learnharness')).toBe(
      'https://github.com/amosblomqvist/learnharness'
    )
    expect(normalizeBrowserUrl('https://example.com')).toBe('https://example.com')
    expect(normalizeBrowserUrl('sqlite fts5 triggers')).toBe(
      'https://www.google.com/search?q=sqlite%20fts5%20triggers'
    )
    expect(normalizeBrowserUrl('sqlite fts5 triggers', 'duckduckgo')).toBe(
      'https://duckduckgo.com/?q=sqlite%20fts5%20triggers'
    )
    expect(normalizeBrowserUrl('sqlite fts5 triggers', 'brave')).toBe(
      'https://search.brave.com/search?q=sqlite%20fts5%20triggers'
    )
  })

  it('builds structured NoteIT blocks preserving headings and code blocks', () => {
    const blocks = buildClipBlocksFromExtraction(
      {
        url: 'https://docs.example.dev/guide',
        title: 'Example Guide',
        sections: [
          { kind: 'heading', text: 'Getting Started' },
          { kind: 'paragraph', text: 'Install the package and run init.' },
          { kind: 'code', language: 'ts', text: 'const x = 42;' }
        ],
        plainExcerpt: 'Install the package and run init.'
      },
      1000
    )

    expect(blocks[0].type).toBe('callout')
    expect(blocks[0].calloutTitle).toContain('Example Guide')
    expect(blocks.some((b) => b.type === 'h3' && b.content === 'Getting Started')).toBe(true)
    expect(blocks.some((b) => b.type === 'code' && b.language === 'ts' && b.content === 'const x = 42;')).toBe(
      true
    )
  })

  it('clips only the selection callout when user selected text', () => {
    const blocks = buildClipBlocksFromExtraction(
      {
        url: 'https://docs.example.dev/guide',
        title: 'Example Guide',
        selection: 'Selected exact snippet',
        sections: [{ kind: 'paragraph', text: 'Ignored full body' }],
        plainExcerpt: 'Ignored full body'
      },
      2000
    )
    expect(blocks).toHaveLength(1)
    expect(blocks[0].content).toContain('Selected exact snippet')
  })
})
