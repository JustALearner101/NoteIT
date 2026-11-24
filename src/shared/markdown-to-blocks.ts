import type { BlockType, DocumentBlock } from './types/domain'
import { isMarkdownTableHeaderPair } from './markdown-table'

export interface MarkdownBlockParseOptions {
  idPrefix?: string
  now?: number
}

const FENCE_OPEN_RE = /^```([a-zA-Z0-9_+-]*)\s*$/
const FENCE_CLOSE_RE = /^```\s*$/
const HEADING_RE = /^(#{1,3})\s+(.+)$/
const CHECKLIST_RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/
const DIVIDER_RE = /^\s*(?:---+|___+|\*\*\*+)\s*$/
const BLOCKQUOTE_RE = /^\s*>\s?(.*)$/
const SINGLE_LINE_MATH_RE = /^\$\$(.+?)\$\$$/
const MATH_FENCE_RE = /^\$\$\s*$/

function normalizeDiagramOrCodeType(rawLang: string): {
  type: BlockType
  language?: string
  wide?: boolean
} {
  const lang = rawLang.trim().toLowerCase()
  if (lang === 'mermaid') {
    return { type: 'mermaid', wide: true }
  }
  if (lang === 'dbml') {
    return { type: 'dbml', wide: true }
  }
  if (lang === 'dot' || lang === 'graphviz') {
    return { type: 'graphviz', wide: true }
  }
  if (lang === 'math' || lang === 'latex' || lang === 'tex') {
    return { type: 'math' }
  }
  return {
    type: 'code',
    language: lang || 'plaintext'
  }
}

/**
 * Parses an AI Markdown response into structured NoteIT DocumentBlocks:
 * headings, checklists, callouts (blockquotes), dividers, code blocks,
 * and native Mermaid / DBML / Graphviz diagram blocks.
 */
export function parseMarkdownToBlocks(
  markdown: string,
  options: MarkdownBlockParseOptions = {}
): DocumentBlock[] {
  const trimmed = markdown.replace(/\r\n/g, '\n').trim()
  if (!trimmed) return []

  const prefix = options.idPrefix ?? 'blk-ai'
  const stamp = options.now ?? Date.now()
  let seq = 0
  const nextId = (): string => `${prefix}-${stamp}-${++seq}`

  const lines = trimmed.split('\n')
  const blocks: DocumentBlock[] = []
  let paragraphBuf: string[] = []
  let quoteBuf: string[] = []

  const flushParagraph = (): void => {
    if (paragraphBuf.length === 0) return
    const text = paragraphBuf.join('\n').trim()
    paragraphBuf = []
    if (!text) return
    blocks.push({
      id: nextId(),
      type: 'paragraph',
      content: text
    })
  }

  const flushQuote = (): void => {
    if (quoteBuf.length === 0) return
    const text = quoteBuf.join('\n').trim()
    quoteBuf = []
    if (!text) return
    blocks.push({
      id: nextId(),
      type: 'callout',
      calloutTitle: 'AI Note',
      calloutColor: 'cobalt',
      content: text
    })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Fenced code / diagram block
    const fenceMatch = FENCE_OPEN_RE.exec(line.trim())
    if (fenceMatch) {
      flushParagraph()
      flushQuote()
      const lang = fenceMatch[1] || ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i].trim())) {
        codeLines.push(lines[i])
        i++
      }
      // Advance past closing fence if present
      if (i < lines.length && FENCE_CLOSE_RE.test(lines[i].trim())) {
        i++
      }

      const body = codeLines.join('\n').trimEnd()
      if (body.length > 0) {
        const meta = normalizeDiagramOrCodeType(lang)
        blocks.push({
          id: nextId(),
          type: meta.type,
          content: body,
          ...(meta.language ? { language: meta.language } : {}),
          ...(meta.wide ? { wide: true } : {})
        })
      }
      continue
    }

    // Display math block: single-line `$$ E = mc^2 $$` or multi-line `$$\n...\n$$`
    const trimmedLine = line.trim()
    const singleMathMatch = SINGLE_LINE_MATH_RE.exec(trimmedLine)
    if (singleMathMatch) {
      flushParagraph()
      flushQuote()
      blocks.push({
        id: nextId(),
        type: 'math',
        content: singleMathMatch[1].trim()
      })
      i++
      continue
    }

    if (MATH_FENCE_RE.test(trimmedLine)) {
      flushParagraph()
      flushQuote()
      const mathLines: string[] = []
      i++
      while (i < lines.length && !MATH_FENCE_RE.test(lines[i].trim())) {
        mathLines.push(lines[i])
        i++
      }
      if (i < lines.length && MATH_FENCE_RE.test(lines[i].trim())) {
        i++
      }
      const expr = mathLines.join('\n').trim()
      if (expr.length > 0) {
        blocks.push({
          id: nextId(),
          type: 'math',
          content: expr
        })
      }
      continue
    }

    // GFM Markdown table
    if (
      i + 1 < lines.length &&
      isMarkdownTableHeaderPair(lines[i], lines[i + 1])
    ) {
      flushParagraph()
      flushQuote()
      const tableLines: string[] = [lines[i], lines[i + 1]]
      i += 2
      while (i < lines.length && lines[i].trim().includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      blocks.push({
        id: nextId(),
        type: 'table',
        wide: true,
        content: tableLines.join('\n')
      })
      continue
    }

    // Blank line terminates active paragraph / quote buffer
    if (line.trim() === '') {
      flushParagraph()
      flushQuote()
      i++
      continue
    }

    // Horizontal divider
    if (DIVIDER_RE.test(line)) {
      flushParagraph()
      flushQuote()
      blocks.push({
        id: nextId(),
        type: 'divider',
        content: ''
      })
      i++
      continue
    }

    // Heading 1..3
    const headingMatch = HEADING_RE.exec(line.trim())
    if (headingMatch) {
      flushParagraph()
      flushQuote()
      const level = headingMatch[1].length
      const type: BlockType = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
      blocks.push({
        id: nextId(),
        type,
        content: headingMatch[2].trim()
      })
      i++
      continue
    }

    // Checklist item
    const checklistMatch = CHECKLIST_RE.exec(line)
    if (checklistMatch) {
      flushParagraph()
      flushQuote()
      blocks.push({
        id: nextId(),
        type: 'checklist',
        checked: checklistMatch[1].toLowerCase() === 'x',
        content: checklistMatch[2].trim()
      })
      i++
      continue
    }

    // Blockquote -> callout
    const quoteMatch = BLOCKQUOTE_RE.exec(line)
    if (quoteMatch) {
      flushParagraph()
      quoteBuf.push(quoteMatch[1])
      i++
      continue
    }

    // Normal text / bullet line
    flushQuote()
    paragraphBuf.push(line)
    i++
  }

  flushParagraph()
  flushQuote()

  return blocks
}

export type BlockInsertionTarget =
  | { mode: 'append' }
  | { mode: 'insert-after' | 'replace'; blockId: string }

/**
 * Inserts or replaces blocks inside a page's flat block array.
 * Preserves columnGroupId & columnIndex when targeting a block inside a multi-column layout.
 */
export function applyBlocksInsertion(
  existingBlocks: DocumentBlock[],
  incoming: DocumentBlock[],
  target: BlockInsertionTarget
): DocumentBlock[] {
  if (incoming.length === 0) return existingBlocks

  if (target.mode === 'append') {
    return [...existingBlocks, ...incoming]
  }

  const idx = existingBlocks.findIndex((b) => b.id === target.blockId)
  if (idx < 0) {
    return [...existingBlocks, ...incoming]
  }

  const anchor = existingBlocks[idx]
  const inheritedColumnMeta =
    anchor.columnGroupId !== undefined && anchor.columnIndex !== undefined
      ? {
          columnGroupId: anchor.columnGroupId,
          columnIndex: anchor.columnIndex
        }
      : null

  const normalizedIncoming = inheritedColumnMeta
    ? incoming.map((blk) => ({
        ...blk,
        ...inheritedColumnMeta
      }))
    : incoming

  const next = [...existingBlocks]
  if (target.mode === 'replace') {
    next.splice(idx, 1, ...normalizedIncoming)
  } else {
    next.splice(idx + 1, 0, ...normalizedIncoming)
  }
  return next
}
