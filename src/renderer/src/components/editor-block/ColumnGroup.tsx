import React, { useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  MIN_COLUMN_PCT,
  normalizeWidths,
  nudgeDivider,
  resizeColumnPair,
  type ColumnBlock
} from '@renderer/lib/columns'

interface ColumnGroupProps {
  header: ColumnBlock
  widths: number[]
  columns: ColumnBlock[][]
  renderBlock: (block: ColumnBlock, columnIndex: number) => React.ReactNode
  onWidthsChange: (widths: number[]) => void
  onRemoveColumn?: (columnIndex: number) => void
  readOnly?: boolean
}

interface DragState {
  pointerId: number
  dividerIndex: number
  startX: number
  startWidths: number[]
  containerWidth: number
}

/**
 * Grup kolom presentasional: grid persen eksplisit + divider yang bisa
 * di-drag/di-nudge. Lebar selama drag disimpan lokal, dan onWidthsChange
 * hanya dipanggil sekali saat pointer dilepas (satu entri undo per drag).
 */
export function ColumnGroup({
  header,
  widths,
  columns,
  renderBlock,
  onWidthsChange,
  onRemoveColumn,
  readOnly = false
}: ColumnGroupProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const pendingRef = useRef<number[] | null>(null)
  const [dragWidths, setDragWidths] = useState<number[] | null>(null)

  const columnCount = columns.length
  const committed = normalizeWidths(widths, columnCount)
  const active = dragWidths && dragWidths.length === columnCount ? dragWidths : committed

  const template = active.map((value) => `${value}%`).join(' ')

  const dividerOffsets: number[] = []
  let cumulative = 0
  for (let i = 0; i < active.length - 1; i += 1) {
    cumulative += active[i]
    dividerOffsets.push(Math.round(cumulative * 100) / 100)
  }

  const startDrag = (dividerIndex: number) => (event: React.PointerEvent<HTMLDivElement>): void => {
    if (readOnly) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return

    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      dividerIndex,
      startX: event.clientX,
      startWidths: committed,
      containerWidth: rect.width
    }
    pendingRef.current = null
    setDragWidths(committed)
  }

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaPct = ((event.clientX - drag.startX) / drag.containerWidth) * 100
    const next = resizeColumnPair(drag.startWidths, drag.dividerIndex, deltaPct)
    pendingRef.current = next
    setDragWidths(next)
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    const final = pendingRef.current
    pendingRef.current = null
    setDragWidths(null)
    if (final) onWidthsChange(final)
  }

  const handleKeyDown =
    (dividerIndex: number) => (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (readOnly) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      onWidthsChange(nudgeDivider(active, dividerIndex, direction))
    }

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={header.content || 'Grup kolom'}
      data-column-group={header.id}
      className="relative grid my-2"
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((columnBlocks, columnIndex) => (
        <div key={`${header.id}-col-${columnIndex}`} className="min-w-0 px-3">
          <div className="flex flex-col">
            {columnBlocks.length === 0 ? (
              <div className="font-mono text-[10px] text-ink-muted py-1 select-none">
                Kolom kosong
              </div>
            ) : (
              columnBlocks.map((block) => (
                <React.Fragment key={block.id}>{renderBlock(block, columnIndex)}</React.Fragment>
              ))
            )}
          </div>
          {onRemoveColumn && columnCount > 1 && (
            <button
              type="button"
              aria-label={`Hapus kolom ${columnIndex + 1}`}
              onClick={() => onRemoveColumn(columnIndex)}
              className="mt-1 p-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary hover:text-[#EF4444]"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}

      {dividerOffsets.map((offset, dividerIndex) => (
        <div
          key={`${header.id}-divider-${dividerIndex}`}
          role={readOnly ? undefined : 'separator'}
          aria-orientation={readOnly ? undefined : 'vertical'}
          aria-valuenow={readOnly ? undefined : Math.round(active[dividerIndex])}
          aria-valuemin={readOnly ? undefined : MIN_COLUMN_PCT}
          aria-valuemax={readOnly ? undefined : 100}
          tabIndex={readOnly ? undefined : 0}
          onPointerDown={readOnly ? undefined : startDrag(dividerIndex)}
          onPointerMove={readOnly ? undefined : moveDrag}
          onPointerUp={readOnly ? undefined : endDrag}
          onPointerCancel={readOnly ? undefined : endDrag}
          onKeyDown={readOnly ? undefined : handleKeyDown(dividerIndex)}
          className={`absolute top-0 bottom-0 w-1.5 -translate-x-1/2 ${
            readOnly
              ? 'bg-border-hairline'
              : 'cursor-col-resize bg-border-hairline hover:bg-accent-cobalt focus:outline-none focus-visible:bg-accent-cobalt'
          }`}
          style={{ left: `${offset}%` }}
        />
      ))}
    </div>
  )
}
