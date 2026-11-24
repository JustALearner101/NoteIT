import React, { useMemo, useRef } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  Plus,
  Rows2,
  Table as TableIcon,
  Trash2
} from 'lucide-react'
import {
  addTableColumn,
  addTableRow,
  cycleTableColumnAlignment,
  parseMarkdownTable,
  removeTableColumn,
  removeTableRow,
  serializeMarkdownTable,
  updateTableCell,
  updateTableHeader,
  type MarkdownTableData,
  type TableColumnAlignment
} from '@shared/markdown-table'
import { cn } from '@renderer/components/ui'

interface TableBlockProps {
  content: string
  onChange: (nextMarkdown: string) => void
}

function alignClass(align: TableColumnAlignment): string {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

function AlignIcon({ align }: { align: TableColumnAlignment }): React.ReactNode {
  if (align === 'center') return <AlignCenter size={10.5} aria-hidden="true" />
  if (align === 'right') return <AlignRight size={10.5} aria-hidden="true" />
  return <AlignLeft size={10.5} aria-hidden="true" />
}

export const TableBlock: React.FC<TableBlockProps> = ({ content, onChange }) => {
  const table = useMemo(() => parseMarkdownTable(content), [content])
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const commit = (next: MarkdownTableData): void => {
    onChange(serializeMarkdownTable(next))
  }

  const focusCell = (rowIdx: number, colIdx: number): void => {
    window.requestAnimationFrame(() => {
      cellRefs.current[`${rowIdx}:${colIdx}`]?.focus()
    })
  }

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ): void => {
    const colCount = table.headers.length
    const rowCount = table.rows.length

    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        if (colIdx > 0) {
          focusCell(rowIdx, colIdx - 1)
        } else if (rowIdx > -1) {
          focusCell(rowIdx - 1, colCount - 1)
        }
      } else {
        if (colIdx < colCount - 1) {
          focusCell(rowIdx, colIdx + 1)
        } else if (rowIdx < rowCount - 1) {
          focusCell(rowIdx + 1, 0)
        } else {
          // Tab on last cell automatically adds a new row
          commit(addTableRow(table))
          focusCell(rowCount, 0)
        }
      }
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (rowIdx < rowCount - 1) {
        focusCell(rowIdx + 1, colIdx)
      } else {
        commit(addTableRow(table))
        focusCell(rowCount, colIdx)
      }
    }
  }

  return (
    <div className="rounded-[10px] bg-surface-elevated border border-border-hairline overflow-hidden">
      {/* Toolbar */}
      <div className="h-8 px-3 bg-surface-chrome/80 border-b border-border-hairline flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
          <TableIcon size={12} className="text-accent-cobalt" aria-hidden="true" />
          <span>Markdown Table</span>
          <span className="font-mono text-[10px] text-ink-muted">
            {table.rows.length}×{table.headers.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => commit(addTableRow(table))}
            className="h-6 px-2 rounded-[5px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-[10.5px] text-ink-secondary hover:text-ink-primary flex items-center gap-1 transition-colors"
          >
            <Rows2 size={10.5} aria-hidden="true" />
            <span>+ Row</span>
          </button>
          <button
            type="button"
            onClick={() => commit(addTableColumn(table))}
            className="h-6 px-2 rounded-[5px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-[10.5px] text-ink-secondary hover:text-ink-primary flex items-center gap-1 transition-colors"
          >
            <Columns2 size={10.5} aria-hidden="true" />
            <span>+ Column</span>
          </button>
        </div>
      </div>

      {/* Interactive Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-surface-chrome/50 border-b border-border-hairline">
              {table.headers.map((header, colIdx) => {
                const align = table.alignments[colIdx] ?? 'left'
                return (
                  <th
                    key={colIdx}
                    className="group/col border-r last:border-r-0 border-border-subtle p-0 min-w-[120px]"
                  >
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        ref={(el) => {
                          cellRefs.current[`-1:${colIdx}`] = el
                        }}
                        type="text"
                        aria-label={`Table header column ${colIdx + 1}`}
                        value={header}
                        onChange={(e) => commit(updateTableHeader(table, colIdx, e.target.value))}
                        onKeyDown={(e) => handleCellKeyDown(e, -1, colIdx)}
                        className={cn(
                          'w-full bg-transparent font-semibold text-ink-primary focus:outline-none',
                          alignClass(align)
                        )}
                      />
                      <div className="opacity-0 group-hover/col:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                        <button
                          type="button"
                          onClick={() => commit(cycleTableColumnAlignment(table, colIdx))}
                          title={`Column alignment: ${align} (click to cycle)`}
                          aria-label={`Cycle alignment for column ${colIdx + 1}`}
                          className="p-0.5 rounded hover:bg-surface-hover text-ink-muted hover:text-ink-primary"
                        >
                          <AlignIcon align={align} />
                        </button>
                        {table.headers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => commit(removeTableColumn(table, colIdx))}
                            title="Delete column"
                            aria-label={`Delete column ${colIdx + 1}`}
                            className="p-0.5 rounded hover:bg-[var(--pill-red-bg)] text-ink-muted hover:text-[var(--pill-red-text)]"
                          >
                            <Trash2 size={10} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                )
              })}
              <th className="w-8 bg-surface-chrome/50" aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="group/row border-b last:border-b-0 border-border-subtle hover:bg-surface-hover/25 transition-colors"
              >
                {table.headers.map((_, colIdx) => {
                  const align = table.alignments[colIdx] ?? 'left'
                  return (
                    <td
                      key={colIdx}
                      className="border-r last:border-r-0 border-border-subtle p-0"
                    >
                      <input
                        ref={(el) => {
                          cellRefs.current[`${rowIdx}:${colIdx}`] = el
                        }}
                        type="text"
                        aria-label={`Row ${rowIdx + 1} column ${colIdx + 1}`}
                        value={row[colIdx] ?? ''}
                        onChange={(e) =>
                          commit(updateTableCell(table, rowIdx, colIdx, e.target.value))
                        }
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                        placeholder="—"
                        className={cn(
                          'w-full px-2.5 py-1.5 bg-transparent text-ink-primary placeholder:text-ink-muted/40 focus:outline-none focus:bg-accent-cobalt/5',
                          alignClass(align)
                        )}
                      />
                    </td>
                  )
                })}
                <td className="w-8 px-1 text-center">
                  {table.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => commit(removeTableRow(table, rowIdx))}
                      title="Delete row"
                      aria-label={`Delete row ${rowIdx + 1}`}
                      className="opacity-0 group-hover/row:opacity-100 p-1 rounded hover:bg-[var(--pill-red-bg)] text-ink-muted hover:text-[var(--pill-red-text)] transition-opacity"
                    >
                      <Trash2 size={10.5} aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Quick Add Row */}
      <button
        type="button"
        onClick={() => {
          commit(addTableRow(table))
          focusCell(table.rows.length, 0)
        }}
        className="w-full py-1.5 text-[11px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover/40 border-t border-border-subtle flex items-center justify-center gap-1 transition-colors select-none"
      >
        <Plus size={11} aria-hidden="true" />
        <span>Add row (or press Tab in last cell)</span>
      </button>
    </div>
  )
}
