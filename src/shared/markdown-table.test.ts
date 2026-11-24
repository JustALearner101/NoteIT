import { describe, expect, it } from 'vitest'
import {
  addTableColumn,
  addTableRow,
  cycleTableColumnAlignment,
  isMarkdownTableHeaderPair,
  parseMarkdownTable,
  removeTableColumn,
  removeTableRow,
  serializeMarkdownTable,
  updateTableCell
} from './markdown-table'

describe('markdown-table', () => {
  it('detects valid GFM table header pairs', () => {
    expect(isMarkdownTableHeaderPair('| A | B |', '| --- | ---: |')).toBe(true)
    expect(isMarkdownTableHeaderPair('Not a table', 'Still not')).toBe(false)
    expect(isMarkdownTableHeaderPair('| A | B |', '| not | separator |')).toBe(false)
  })

  it('parses and serializes alignments and escaped pipes cleanly', () => {
    const md = [
      '| Name | Expression | Score |',
      '| --- | :---: | ---: |',
      '| Alpha | a \\| b | 99 |'
    ].join('\n')

    const parsed = parseMarkdownTable(md)
    expect(parsed.headers).toEqual(['Name', 'Expression', 'Score'])
    expect(parsed.alignments).toEqual(['left', 'center', 'right'])
    expect(parsed.rows).toEqual([['Alpha', 'a | b', '99']])

    const serialized = serializeMarkdownTable(parsed)
    expect(serialized).toBe(md)
  })

  it('supports immutable row, column, cell, and alignment mutations', () => {
    let table = parseMarkdownTable('| Col 1 | Col 2 |\n| --- | --- |\n| a | b |')
    table = updateTableCell(table, 0, 1, 'beta')
    table = addTableRow(table)
    table = addTableColumn(table)
    table = cycleTableColumnAlignment(table, 1)

    expect(table.headers).toEqual(['Col 1', 'Col 2', 'Column 3'])
    expect(table.alignments).toEqual(['left', 'center', 'left'])
    expect(table.rows).toEqual([
      ['a', 'beta', ''],
      ['', '', '']
    ])

    table = removeTableRow(table, 1)
    table = removeTableColumn(table, 2)
    expect(table.headers).toEqual(['Col 1', 'Col 2'])
    expect(table.rows).toEqual([['a', 'beta']])

    // Never removes the last remaining row or column
    const minTable = removeTableRow(removeTableColumn(table, 0), 0)
    expect(minTable.headers.length).toBe(1)
    expect(minTable.rows.length).toBe(1)
  })
})
