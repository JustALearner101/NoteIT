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

const CARD_WIDTH = 252
const HEADER_HEIGHT = 34
const ROW_HEIGHT = 26

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
    <div className="rounded-[8px] bg-surface-elevated border border-border-hairline overflow-hidden shadow-sm my-3">
      {/* Top Engineering Studio Bar */}
      <div className="h-9 px-3 bg-surface-chrome border-b border-border-hairline flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-cobalt" />
          <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-ink-primary">
            DBML STUDIO · ENGINEERING SCHEMATIC ERD
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-elevated border border-border-hairline text-ink-secondary tabular-nums">
            {parsed.tables.length} TABLES · {parsed.refs.length} REFS
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Segmented View Toggle: Code | Split | Diagram */}
          <div className="p-0.5 rounded bg-surface-elevated border border-border-hairline flex items-center font-mono text-[10px]">
            <button
              onClick={() => onChange({ dbmlViewMode: 'code' })}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === 'code'
                  ? 'bg-accent-cobalt text-white'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Code2 size={11} />
              <span>Code</span>
            </button>
            <button
              onClick={() => onChange({ dbmlViewMode: 'split' })}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === 'split'
                  ? 'bg-accent-cobalt text-white'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Columns2 size={11} />
              <span>Split</span>
            </button>
            <button
              onClick={() => onChange({ dbmlViewMode: 'diagram' })}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === 'diagram'
                  ? 'bg-accent-cobalt text-white'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <LayoutGrid size={11} />
              <span>Diagram</span>
            </button>
          </div>

          <button
            onClick={handleAutoLayout}
            title="Susun Ulang Posisi Tabel Otomatis"
            className="h-6 px-2 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline font-mono text-[10px] text-ink-secondary hover:text-ink-primary flex items-center gap-1"
          >
            <Sparkles size={11} className="text-accent-amber" />
            <span>Auto-Layout</span>
          </button>

          <button
            onClick={() => setSqlModalDialect(sqlModalDialect ? null : 'postgres')}
            className="h-6 px-2 rounded bg-accent-cobalt/15 hover:bg-accent-cobalt/25 border border-accent-cobalt/40 font-mono text-[10px] text-accent-cobalt flex items-center gap-1"
          >
            <Download size={11} />
            <span>Ekspor ke SQL</span>
          </button>

          <button
            onClick={() => onChange({ wide: !wide })}
            title={wide ? 'Kembalikan ke Lebar Standar' : 'Rentangkan Lebar Penuh'}
            className="h-6 w-6 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-ink-secondary hover:text-ink-primary"
          >
            {wide ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </div>
      </div>

      {/* Optional SQL DDL Preview & Export Bar */}
      {sqlModalDialect && (
        <div className="p-3 bg-surface-chrome border-b border-border-hairline">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-ink-secondary">SQL DDL COMPILER:</span>
              <button
                onClick={() => setSqlModalDialect('postgres')}
                className={`px-2 py-0.5 rounded border ${
                  sqlModalDialect === 'postgres'
                    ? 'bg-accent-cobalt text-white border-accent-cobalt'
                    : 'bg-surface-elevated text-ink-secondary border-border-hairline'
                }`}
              >
                PostgreSQL
              </button>
              <button
                onClick={() => setSqlModalDialect('sqlite')}
                className={`px-2 py-0.5 rounded border ${
                  sqlModalDialect === 'sqlite'
                    ? 'bg-accent-cobalt text-white border-accent-cobalt'
                    : 'bg-surface-elevated text-ink-secondary border-border-hairline'
                }`}
              >
                SQLite
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateSQLFromDBML(parsed, sqlModalDialect))
                  showToast('SQL DDL disalin ke clipboard')
                }}
                className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline font-mono text-[11px] text-ink-primary flex items-center gap-1"
              >
                <Copy size={11} />
                <span>Salin SQL</span>
              </button>
              <button
                onClick={() => handleExportSQL(sqlModalDialect)}
                className="px-2.5 py-1 rounded bg-accent-cobalt text-white font-mono text-[11px] flex items-center gap-1"
              >
                <Download size={11} />
                <span>Simpan .SQL</span>
              </button>
              <button
                onClick={() => setSqlModalDialect(null)}
                className="px-2 py-1 font-mono text-xs text-ink-muted hover:text-ink-primary"
              >
                Tutup
              </button>
            </div>
          </div>
          <pre className="p-2.5 rounded bg-canvas-primary border border-border-hairline font-mono text-[11px] text-ink-primary max-h-44 overflow-y-auto selectable-text">
            {generateSQLFromDBML(parsed, sqlModalDialect)}
          </pre>
        </div>
      )}

      {/* Main Split Body */}
      <div
        className={`grid ${
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
        } min-h-[420px]`}
      >
        {/* Left: Line-Numbered DBML Code Editor */}
        {(viewMode === 'code' || viewMode === 'split') && (
          <div
            className={`${
              viewMode === 'split' ? 'lg:col-span-5 border-r border-border-hairline' : ''
            } flex flex-col bg-surface-chrome/50`}
          >
            <div className="flex flex-1 min-h-[380px] font-mono text-[12.5px] leading-[1.6]">
              {/* Line Numbers */}
              <div className="w-9 py-3 bg-surface-chrome border-r border-border-subtle text-right pr-2 text-ink-muted select-none tabular-nums">
                {Array.from({ length: lineCount }).map((_, idx) => (
                  <div key={idx}>{idx + 1}</div>
                ))}
              </div>
              <textarea
                value={code}
                onChange={(e) => onChange({ content: e.target.value })}
                spellCheck={false}
                placeholder="Table users {\n  id uuid [pk]\n}"
                className="flex-1 p-3 bg-transparent text-ink-primary font-mono text-[12.5px] leading-[1.6] resize-none focus:outline-none selectable-text"
              />
            </div>

            {/* Diagnostic Error Bar (Interface Voice from DESIGN.md) */}
            {parsed.errors.length > 0 && (
              <div className="p-2.5 bg-[#EF4444]/10 border-t border-[#EF4444]/40 space-y-1">
                {parsed.errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 font-mono text-[11px] text-[#EF4444]"
                  >
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right: Interactive Engineering Schematic ERD Canvas */}
        {(viewMode === 'diagram' || viewMode === 'split') && (
          <div
            onMouseDown={handleMouseDownCanvas}
            onMouseMove={handleMouseMoveCanvas}
            onMouseUp={handleMouseUpCanvas}
            onMouseLeave={handleMouseUpCanvas}
            className={`${
              viewMode === 'split' ? 'lg:col-span-7' : ''
            } relative overflow-hidden bg-blueprint-grid min-h-[420px] cursor-grab active:cursor-grabbing select-none`}
          >
            {/* Floating Zoom & Coordinate HUD */}
            <div className="absolute right-3 bottom-3 z-20 flex items-center gap-1 p-1 rounded-[6px] bg-surface-elevated/95 border border-border-hairline font-mono text-[11px] shadow-md">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setZoom((z) => Math.max(0.55, +(z - 0.1).toFixed(2)))
                }}
                className="p-1 rounded hover:bg-surface-hover text-ink-secondary hover:text-ink-primary"
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
                className="px-1.5 text-ink-primary tabular-nums"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))
                }}
                className="p-1 rounded hover:bg-surface-hover text-ink-secondary hover:text-ink-primary"
              >
                <ZoomIn size={13} />
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
              {/* SVG Layer: Row-Accurate Orthogonal Foreign Key Wires */}
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
                  const midX = (srcX + tgtX) / 2

                  const pathData = `M ${srcX} ${srcY} L ${midX} ${srcY} L ${midX} ${tgtY} L ${tgtX} ${tgtY}`

                  const isHighlighted =
                    hoveredRefId === ref.id ||
                    hoveredTable === ref.sourceTable ||
                    hoveredTable === ref.targetTable

                  return (
                    <g key={ref.id}>
                      <path
                        d={pathData}
                        fill="none"
                        stroke={isHighlighted ? '#3B82F6' : 'var(--border-hairline)'}
                        strokeWidth={isHighlighted ? 2.2 : 1.3}
                        strokeDasharray={isHighlighted ? 'none' : 'none'}
                      />
                      <circle
                        cx={srcX}
                        cy={srcY}
                        r={3.5}
                        fill={isHighlighted ? '#3B82F6' : '#64748B'}
                      />
                      <polygon
                        points={`${tgtX},${tgtY} ${tgtX + (srcRightOfTgt ? 7 : -7)},${tgtY - 4} ${
                          tgtX + (srcRightOfTgt ? 7 : -7)
                        },${tgtY + 4}`}
                        fill={isHighlighted ? '#F59E0B' : '#64748B'}
                      />
                    </g>
                  )
                })}
              </svg>

              {/* Table Schematic Nodes */}
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
                    className={`absolute top-0 left-0 rounded-[6px] bg-surface-elevated border transition-opacity duration-150 shadow-lg cursor-move ${
                      hoveredTable === table.name
                        ? 'border-accent-cobalt ring-1 ring-accent-cobalt/40 z-10'
                        : 'border-border-hairline'
                    } ${isConnectedToHover ? 'opacity-100' : 'opacity-45'}`}
                  >
                    {/* Engineering Schematic Header with 3px Drafting Marker Bar */}
                    <div
                      style={{ height: `${HEADER_HEIGHT}px` }}
                      className="px-2.5 bg-surface-chrome border-b border-border-hairline rounded-t-[6px] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-4 rounded-[2px] ${marker.bgStrip} shrink-0`} />
                        <span className="font-mono font-semibold text-xs text-ink-primary truncate">
                          {table.name}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-ink-muted">
                        {table.columns.length} COL
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
                            className="px-2.5 flex items-center justify-between font-mono text-[11px] hover:bg-surface-hover/70 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {col.isPk ? (
                                <span
                                  title="Primary Key"
                                  className="text-accent-amber text-[10px] leading-none"
                                >
                                  ◆
                                </span>
                              ) : col.isFk ? (
                                <span
                                  title={`Foreign Key -> ${col.refTarget?.table}.${col.refTarget?.column}`}
                                  className="text-accent-cobalt text-[10px] leading-none"
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
                                <span className="px-1 rounded-[3px] bg-accent-amber/15 text-accent-amber border border-accent-amber/30 text-[9px]">
                                  PK
                                </span>
                              )}
                              {col.isFk && (
                                <span className="px-1 rounded-[3px] bg-accent-cobalt/15 text-accent-cobalt border border-accent-cobalt/30 text-[9px]">
                                  FK
                                </span>
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
