export type TableColumnAlignment = 'left' | 'center' | 'right'

export interface MarkdownTableData {
  headers: string[]
  alignments: TableColumnAlignment[]
  rows: string[][]
}

export const DEFAULT_MARKDOWN_TABLE = [
  '| Feature | Status | Notes |',
  '| --- | :---: | --- |',
  '| Live Preview | Done | Obsidian-style click to edit |',
  '| KaTeX Math | Done | Offline display & inline |'
].join('\n')

function splitTableRow(line: string): string[] {
  const trimmed = line.trim()
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const clean = inner.endsWith('|') && !inner.endsWith('\\|') ? inner.slice(0, -1) : inner

  const cells: string[] = []
  let current = ''
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '\\' && clean[i + 1] === '|') {
      current += '|'
      i++
    } else if (clean[i] === '|') {
      cells.push(current.trim())
      current = ''
    } else {
      current += clean[i]
    }
  }
  cells.push(current.trim())
  return cells
}

function escapeCell(value: string): string {
  return (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

function parseAlignmentToken(token: string): TableColumnAlignment | null {
  const t = token.trim()
  if (!/^:?-{3,}:?$/.test(t)) return null
  const left = t.startsWith(':')
  const right = t.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  return 'left'
}

function serializeAlignmentToken(align: TableColumnAlignment): string {
  if (align === 'center') return ':---:'
  if (align === 'right') return '---:'
  return '---'
}

/**
 * Checks whether two consecutive lines form a valid GFM table header + separator.
 */
export function isMarkdownTableHeaderPair(headerLine: string, separatorLine: string): boolean {
  if (!headerLine || !separatorLine) return false
  if (!headerLine.includes('|') || !separatorLine.includes('|')) return false
  const headers = splitTableRow(headerLine)
  const sepTokens = splitTableRow(separatorLine)
  if (headers.length === 0 || sepTokens.length === 0) return false
  return sepTokens.every((t) => parseAlignmentToken(t) !== null)
}

/**
 * Parses a GFM Markdown table string into a structured editable grid.
 * Falls back to a default 2x2 table if the input is empty or malformed.
 */
export function parseMarkdownTable(markdown: string): MarkdownTableData {
  const lines = (markdown || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2 || !isMarkdownTableHeaderPair(lines[0], lines[1])) {
    return {
      headers: ['Column 1', 'Column 2'],
      alignments: ['left', 'left'],
      rows: [['', '']]
    }
  }

  const rawHeaders = splitTableRow(lines[0])
  const rawSep = splitTableRow(lines[1])
  const colCount = Math.max(1, rawHeaders.length, rawSep.length)

  const headers = Array.from({ length: colCount }, (_, i) => rawHeaders[i] ?? `Column ${i + 1}`)
  const alignments: TableColumnAlignment[] = Array.from(
    { length: colCount },
    (_, i) => parseAlignmentToken(rawSep[i] ?? '---') ?? 'left'
  )

  const rows: string[][] = lines.slice(2).map((line) => {
    const cells = splitTableRow(line)
    return Array.from({ length: colCount }, (_, i) => cells[i] ?? '')
  })

  if (rows.length === 0) {
    rows.push(Array.from({ length: colCount }, () => ''))
  }

  return { headers, alignments, rows }
}

/**
 * Serializes a structured table back into canonical GFM Markdown.
 */
export function serializeMarkdownTable(data: MarkdownTableData): string {
  const colCount = Math.max(1, data.headers.length)
  const headers = Array.from({ length: colCount }, (_, i) => escapeCell(data.headers[i] ?? ''))
  const sep = Array.from({ length: colCount }, (_, i) =>
    serializeAlignmentToken(data.alignments[i] ?? 'left')
  )
  const bodyLines = data.rows.map((row) => {
    const cells = Array.from({ length: colCount }, (_, i) => escapeCell(row[i] ?? ''))
    return `| ${cells.join(' | ')} |`
  })

  return [`| ${headers.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...bodyLines].join('\n')
}

export function updateTableHeader(
  data: MarkdownTableData,
  colIndex: number,
  value: string
): MarkdownTableData {
  const headers = data.headers.map((h, i) => (i === colIndex ? value : h))
  return { ...data, headers }
}

export function updateTableCell(
  data: MarkdownTableData,
  rowIndex: number,
  colIndex: number,
  value: string
): MarkdownTableData {
  const rows = data.rows.map((row, r) =>
    r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row
  )
  return { ...data, rows }
}

export function addTableRow(data: MarkdownTableData, atIndex?: number): MarkdownTableData {
  const emptyRow = Array.from({ length: data.headers.length }, () => '')
  const rows = [...data.rows]
  if (atIndex !== undefined && atIndex >= 0 && atIndex <= rows.length) {
    rows.splice(atIndex, 0, emptyRow)
  } else {
    rows.push(emptyRow)
  }
  return { ...data, rows }
}

export function removeTableRow(data: MarkdownTableData, rowIndex: number): MarkdownTableData {
  if (data.rows.length <= 1) return data
  return {
    ...data,
    rows: data.rows.filter((_, idx) => idx !== rowIndex)
  }
}

export function addTableColumn(data: MarkdownTableData): MarkdownTableData {
  const nextIndex = data.headers.length + 1
  return {
    headers: [...data.headers, `Column ${nextIndex}`],
    alignments: [...data.alignments, 'left'],
    rows: data.rows.map((row) => [...row, ''])
  }
}

export function removeTableColumn(data: MarkdownTableData, colIndex: number): MarkdownTableData {
  if (data.headers.length <= 1) return data
  return {
    headers: data.headers.filter((_, idx) => idx !== colIndex),
    alignments: data.alignments.filter((_, idx) => idx !== colIndex),
    rows: data.rows.map((row) => row.filter((_, idx) => idx !== colIndex))
  }
}

export function cycleTableColumnAlignment(
  data: MarkdownTableData,
  colIndex: number
): MarkdownTableData {
  const order: TableColumnAlignment[] = ['left', 'center', 'right']
  const current = data.alignments[colIndex] ?? 'left'
  const next = order[(order.indexOf(current) + 1) % order.length]
  return {
    ...data,
    alignments: data.alignments.map((a, i) => (i === colIndex ? next : a))
  }
}
