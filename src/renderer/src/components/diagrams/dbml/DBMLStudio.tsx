import React, { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Code2,
  Columns2,
  Copy,
  Download,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Sparkles,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { generateSQLFromDBML, parseDBML, type DBMLTable } from '@shared/dbml-parser'
import type { DBMLTableLayout, MarkerColor } from '@shared/types/domain'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Badge, Button, SegmentedControl, cn } from '@renderer/components/ui'

interface DBMLStudioProps {
  code: string
  layout?: DBMLTableLayout
  viewMode?: 'code' | 'split' | 'diagram'
  wide?: boolean
  onChange: (updates: {
    content?: string
    dbmlLayout?: DBMLTableLayout
    dbmlViewMode?: 'code' | 'split' | 'diagram'
    wide?: boolean
  }) => void
}

const CARD_WIDTH = 260
const HEADER_HEIGHT = 44
const ROW_HEIGHT = 28

export const DBMLStudio: React.FC<DBMLStudioProps> = ({
  code,
  layout = {},
  viewMode = 'split',
  wide = true,
  onChange
}) => {
  const { setTelemetry, showToast } = useWorkspaceStore()
  const parsed = useMemo(() => parseDBML(code), [code])

  const [hoveredTable, setHoveredTable] = useState<string | null>(null)
  const [hoveredRefId, setHoveredRefId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [sqlModalDialect, setSqlModalDialect] = useState<'postgres' | 'sqlite' | null>(null)

  const dragRef = useRef<{
    type: 'table' | 'pan'
    tableName?: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  // Compute deterministic coordinates for every table
  const tablePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number; color: MarkerColor }> = {}
    parsed.tables.forEach((tbl, idx) => {
      const saved = layout[tbl.name]
      const col = idx % 3
      const row = Math.floor(idx / 3)
      pos[tbl.name] = {
        x: saved?.x ?? 28 + col * 300,
        y: saved?.y ?? 28 + row * 230,
        color: saved?.color || tbl.headerColor || 'cobalt'
      }
    })
    return pos
  }, [parsed.tables, layout])

  const handleAutoLayout = (): void => {
    const nextLayout: DBMLTableLayout = {}
    parsed.tables.forEach((tbl, idx) => {
      const col = idx % 3
      const row = Math.floor(idx / 3)
      nextLayout[tbl.name] = {
        x: 32 + col * 305,
        y: 32 + row * 235,
        color: tbl.headerColor || 'cobalt'
      }
    })
    setPan({ x: 0, y: 0 })
    setZoom(1)
    onChange({ dbmlLayout: nextLayout })
    showToast('Auto-Layout skema DBML diterapkan')
  }

  const handleMouseDownTable = (e: React.MouseEvent, table: DBMLTable): void => {
    e.stopPropagation()
    const currentPos = tablePositions[table.name] || { x: 24, y: 24 }
    dragRef.current = {
      type: 'table',
      tableName: table.name,
      startX: e.clientX,
      startY: e.clientY,
      origX: currentPos.x,
      origY: currentPos.y
    }
  }

  const handleMouseDownCanvas = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    dragRef.current = {
      type: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y
    }
  }

  const handleMouseMoveCanvas = (e: React.MouseEvent): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = Math.round((e.clientX - rect.left - pan.x) / zoom)
    const relY = Math.round((e.clientY - rect.top - pan.y) / zoom)
    setTelemetry({ cursorX: relX, cursorY: relY, zoomPercent: zoom * 100 })

    if (!dragRef.current) return
    const dx = (e.clientX - dragRef.current.startX) / zoom
    const dy = (e.clientY - dragRef.current.startY) / zoom

    if (dragRef.current.type === 'pan') {
      setPan({
        x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (e.clientY - dragRef.current.startY)
      })
    } else if (dragRef.current.type === 'table' && dragRef.current.tableName) {
      // Snap to 12px drafting grid
      const snappedX = Math.max(8, Math.round((dragRef.current.origX + dx) / 12) * 12)
      const snappedY = Math.max(8, Math.round((dragRef.current.origY + dy) / 12) * 12)
      const name = dragRef.current.tableName
      onChange({
        dbmlLayout: {
          ...tablePositions,
          [name]: {
            ...tablePositions[name],
            x: snappedX,
            y: snappedY
          }
        }
      })
    }
  }

  const handleMouseUpCanvas = (): void => {
    dragRef.current = null
  }

  const handleExportSQL = async (dialect: 'postgres' | 'sqlite'): Promise<void> => {
    const ddl = generateSQLFromDBML(parsed, dialect)
    const res = await window.noteitAPI.exportContent({
      filename: `noteit-schema-${dialect}`,
      content: ddl,
      extension: 'sql'
    })
    if (res.saved) {
      showToast(`Skema diekspor ke SQL (${dialect.toUpperCase()})`)
    }
  }

  const lineCount = code.split(/\r?\n/).length

  return (
    <div className="rounded-[12px] bg-canvas-primary border border-border-hairline overflow-hidden shadow-card my-4">
      {/* Top Studio Bar */}
      <div className="min-h-[44px] px-4 py-2 bg-surface-chrome/75 border-b border-border-hairline flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-accent-cobalt" />
          <span className="font-display text-[13.5px] font-semibold text-ink-primary">
            DBML Studio
          </span>
          <span className="px-2 py-0.5 rounded-[6px] bg-surface-elevated border border-border-hairline font-mono text-[10.5px] text-ink-muted tabular-nums">
            {parsed.tables.length} tables · {parsed.refs.length} refs
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <SegmentedControl<'code' | 'split' | 'diagram'>
            size="xs"
            value={viewMode}
            onChange={(nextMode) => onChange({ dbmlViewMode: nextMode })}
            options={[
              { value: 'code', label: 'Code', icon: <Code2 size={11} /> },
              { value: 'split', label: 'Split', icon: <Columns2 size={11} /> },
              { value: 'diagram', label: 'Diagram', icon: <LayoutGrid size={11} /> }
            ]}
          />

          <Button
            variant="secondary"
            size="xs"
            onClick={handleAutoLayout}
            title="Susun Ulang Posisi Tabel Otomatis"
          >
            <Sparkles size={11.5} className="text-accent-amber" />
            <span>Auto-layout</span>
          </Button>

          <Button
            variant="primary"
            size="xs"
            onClick={() => setSqlModalDialect(sqlModalDialect ? null : 'postgres')}
          >
            <Download size={11.5} />
            <span>Export SQL</span>
          </Button>

          <Button
            variant="secondary"
            size="icon-xs"
            onClick={() => onChange({ wide: !wide })}
            title={wide ? 'Kembalikan ke Lebar Standar' : 'Rentangkan Lebar Penuh'}
          >
            {wide ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </Button>
        </div>
      </div>

      {/* Optional SQL DDL Preview & Export Bar */}
      {sqlModalDialect && (
        <div className="p-3.5 bg-surface-chrome/65 border-b border-border-hairline space-y-2.5 animate-popover-enter">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-secondary font-medium">SQL DDL Compiler</span>
              <SegmentedControl<'postgres' | 'sqlite'>
                size="xs"
                value={sqlModalDialect}
                onChange={setSqlModalDialect}
                options={[
                  { value: 'postgres', label: 'PostgreSQL' },
                  { value: 'sqlite', label: 'SQLite' }
                ]}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  navigator.clipboard.writeText(generateSQLFromDBML(parsed, sqlModalDialect))
                  showToast('SQL DDL disalin ke clipboard')
                }}
              >
                <Copy size={11} />
                <span>Salin SQL</span>
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={() => handleExportSQL(sqlModalDialect)}
              >
                <Download size={11} />
                <span>Simpan .sql</span>
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setSqlModalDialect(null)}>
                Tutup
              </Button>
            </div>
          </div>
          <pre className="p-3 rounded-[8px] bg-canvas-primary border border-border-hairline font-mono text-[11.5px] text-ink-primary max-h-44 overflow-y-auto selectable-text">
            {generateSQLFromDBML(parsed, sqlModalDialect)}
          </pre>
        </div>
      )}

      {/* Main Split Body */}
      <div
        className={`grid ${
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
        } min-h-[430px]`}
      >
        {/* Left: Line-Numbered DBML Code Editor */}
        {(viewMode === 'code' || viewMode === 'split') && (
          <div
            className={`${
              viewMode === 'split' ? 'lg:col-span-5 border-r border-border-hairline' : ''
            } flex flex-col bg-surface-chrome/45`}
          >
            <div className="flex flex-1 min-h-[380px] font-mono text-[12.5px] leading-[1.65]">
              {/* Line Numbers */}
              <div className="w-10 py-3 bg-surface-chrome/70 border-r border-border-subtle text-right pr-2.5 text-ink-muted select-none tabular-nums">
                {Array.from({ length: lineCount }).map((_, idx) => (
                  <div key={idx}>{idx + 1}</div>
                ))}
              </div>
              <textarea
                value={code}
                onChange={(e) => onChange({ content: e.target.value })}
                spellCheck={false}
                placeholder={'Table users {\n  id uuid [pk]\n}'}
                className="flex-1 p-3 bg-transparent text-ink-primary font-mono text-[12.5px] leading-[1.65] resize-none focus:outline-none selectable-text"
              />
            </div>

            {/* Diagnostic Error Bar */}
            {parsed.errors.length > 0 && (
              <div className="p-2.5 bg-[var(--pill-red-bg)] border-t border-[var(--pill-red-border)] space-y-1">
                {parsed.errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 font-mono text-[11px] text-[var(--pill-red-text)]"
                  >
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right: Interactive Dot-Matrix ERD Canvas (Reference Image 3 node & bezier aesthetic) */}
        {(viewMode === 'diagram' || viewMode === 'split') && (
          <div
            onMouseDown={handleMouseDownCanvas}
            onMouseMove={handleMouseMoveCanvas}
            onMouseUp={handleMouseUpCanvas}
            onMouseLeave={handleMouseUpCanvas}
            className={`${
              viewMode === 'split' ? 'lg:col-span-7' : ''
            } relative overflow-hidden bg-dot-canvas min-h-[430px] cursor-grab active:cursor-grabbing select-none`}
          >
            {/* Floating Zoom Pill */}
            <div className="absolute right-3.5 bottom-3.5 z-20 flex items-center gap-0.5 p-1 rounded-[9px] bg-surface-elevated/95 border border-border-hairline font-mono text-[11px] shadow-popover">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setZoom((z) => Math.max(0.55, +(z - 0.1).toFixed(2)))
                }}
                className="h-6 w-6 rounded-[6px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
              >
                <ZoomOut size={12.5} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
                className="px-2 text-ink-primary tabular-nums"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))
                }}
                className="h-6 w-6 rounded-[6px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
              >
                <ZoomIn size={12.5} />
              </button>
            </div>

            {/* Transformed Plane */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0'
              }}
              className="w-[1400px] h-[900px] relative"
            >
              {/* SVG Layer: Smooth Cubic Bezier Foreign Key Curves (Image 3 wire craft) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                {parsed.refs.map((ref) => {
                  const srcTable = parsed.tables.find((t) => t.name === ref.sourceTable)
                  const tgtTable = parsed.tables.find((t) => t.name === ref.targetTable)
                  if (!srcTable || !tgtTable) return null

                  const srcPos = tablePositions[srcTable.name]
                  const tgtPos = tablePositions[tgtTable.name]
                  if (!srcPos || !tgtPos) return null

                  const srcColIdx = Math.max(
                    0,
                    srcTable.columns.findIndex((c) => c.name === ref.sourceColumn)
                  )
                  const tgtColIdx = Math.max(
                    0,
                    tgtTable.columns.findIndex((c) => c.name === ref.targetColumn)
                  )

                  const srcY =
                    srcPos.y + HEADER_HEIGHT + srcColIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                  const tgtY =
                    tgtPos.y + HEADER_HEIGHT + tgtColIdx * ROW_HEIGHT + ROW_HEIGHT / 2

                  const srcRightOfTgt = srcPos.x > tgtPos.x + CARD_WIDTH
                  const srcX = srcRightOfTgt ? srcPos.x : srcPos.x + CARD_WIDTH
                  const tgtX = srcRightOfTgt ? tgtPos.x + CARD_WIDTH : tgtPos.x
                  const dx = Math.max(48, Math.abs(tgtX - srcX) * 0.45)
                  const c1x = srcRightOfTgt ? srcX - dx : srcX + dx
                  const c2x = srcRightOfTgt ? tgtX + dx : tgtX - dx

                  const pathData = `M ${srcX} ${srcY} C ${c1x} ${srcY}, ${c2x} ${tgtY}, ${tgtX} ${tgtY}`

                  const isHighlighted =
                    hoveredRefId === ref.id ||
                    hoveredTable === ref.sourceTable ||
                    hoveredTable === ref.targetTable

                  return (
                    <g key={ref.id}>
                      <path
                        d={pathData}
                        fill="none"
                        stroke={isHighlighted ? '#6E7BF2' : 'var(--border-strong)'}
                        strokeWidth={isHighlighted ? 2 : 1.4}
                      />
                      <circle
                        cx={srcX}
                        cy={srcY}
                        r={isHighlighted ? 4 : 3}
                        fill={isHighlighted ? '#6E7BF2' : 'var(--text-muted)'}
                      />
                      <circle
                        cx={tgtX}
                        cy={tgtY}
                        r={isHighlighted ? 4 : 3}
                        fill={isHighlighted ? '#E5A93C' : 'var(--text-muted)'}
                      />
                    </g>
                  )
                })}
              </svg>

              {/* Table Schematic Nodes (rounded-[12px] obsidian studio cards) */}
              {parsed.tables.map((table) => {
                const pos = tablePositions[table.name] || {
                  x: 24,
                  y: 24,
                  color: 'cobalt' as MarkerColor
                }
                const marker = MARKER_META[pos.color]

                const isConnectedToHover =
                  !hoveredTable ||
                  hoveredTable === table.name ||
                  parsed.refs.some(
                    (r) =>
                      (r.sourceTable === hoveredTable && r.targetTable === table.name) ||
                      (r.targetTable === hoveredTable && r.sourceTable === table.name)
                  )

                const isHovered = hoveredTable === table.name

                return (
                  <div
                    key={table.name}
                    style={{
                      width: `${CARD_WIDTH}px`,
                      transform: `translate(${pos.x}px, ${pos.y}px)`
                    }}
                    onMouseDown={(e) => handleMouseDownTable(e, table)}
                    onMouseEnter={() => setHoveredTable(table.name)}
                    onMouseLeave={() => setHoveredTable(null)}
                    className={cn(
                      'absolute top-0 left-0 rounded-[12px] border transition-all duration-150 cursor-move overflow-hidden',
                      isHovered
                        ? 'bg-[var(--node-selected-bg)] border-[var(--node-selected-border)] shadow-node-selected z-10'
                        : 'bg-surface-elevated border-border-hairline shadow-card',
                      isConnectedToHover ? 'opacity-100' : 'opacity-40'
                    )}
                  >
                    {/* Card Header */}
                    <div
                      style={{ height: `${HEADER_HEIGHT}px` }}
                      className="px-3 bg-surface-chrome/65 border-b border-border-hairline flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('w-2.5 h-2.5 rounded-[4px] shrink-0', marker.dotBg)} />
                        <div className="min-w-0">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-muted leading-none mb-0.5">
                            TABLE
                          </div>
                          <div className="font-mono font-semibold text-xs text-ink-primary truncate leading-tight">
                            {table.name}
                          </div>
                        </div>
                      </div>
                      <span className="px-1.5 py-[2px] rounded-[5px] bg-surface-elevated border border-border-hairline font-mono text-[10px] text-ink-muted tabular-nums shrink-0">
                        {table.columns.length} cols
                      </span>
                    </div>

                    {/* Columns List */}
                    <div className="divide-y divide-border-subtle">
                      {table.columns.map((col) => {
                        const matchingRef = parsed.refs.find(
                          (r) => r.sourceTable === table.name && r.sourceColumn === col.name
                        )
                        return (
                          <div
                            key={col.name}
                            style={{ height: `${ROW_HEIGHT}px` }}
                            onMouseEnter={() => matchingRef && setHoveredRefId(matchingRef.id)}
                            onMouseLeave={() => setHoveredRefId(null)}
                            className="px-3 flex items-center justify-between font-mono text-[11px] hover:bg-surface-hover/55 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {col.isPk ? (
                                <span
                                  title="Primary Key"
                                  className="text-accent-amber text-[9.5px] leading-none"
                                >
                                  ◆
                                </span>
                              ) : col.isFk ? (
                                <span
                                  title={`Foreign Key -> ${col.refTarget?.table}.${col.refTarget?.column}`}
                                  className="text-accent-cobalt text-[9.5px] leading-none"
                                >
                                  ○
                                </span>
                              ) : (
                                <span className="w-2.5 inline-block" />
                              )}
                              <span
                                className={`truncate ${
                                  col.isPk
                                    ? 'text-ink-primary font-semibold'
                                    : 'text-ink-secondary'
                                }`}
                              >
                                {col.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-ink-muted">{col.type}</span>
                              {col.isPk && (
                                <Badge tone="amber" className="font-mono text-[9px] px-1 py-[1px]">
                                  PK
                                </Badge>
                              )}
                              {col.isFk && (
                                <Badge tone="cobalt" className="font-mono text-[9px] px-1 py-[1px]">
                                  FK
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
