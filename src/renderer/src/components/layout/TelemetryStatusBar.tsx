import React from 'react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'

export const TelemetryStatusBar: React.FC = () => {
  const { pages, activePageId, stats, telemetry } = useWorkspaceStore()
  const activePage = pages.find((p) => p.id === activePageId)

  const wordCount = React.useMemo(() => {
    if (!activePage) return 0
    const allText = activePage.blocks.map((b) => b.content).join(' ')
    const words = allText.trim().split(/\s+/).filter(Boolean)
    return words.length
  }, [activePage])

  return (
    <footer className="h-6 bg-surface-chrome border-t border-border-hairline px-3 flex items-center justify-between font-mono text-[11px] text-ink-secondary select-none shrink-0 tabular-nums">
      {/* Left: Local SQLite & FTS5 Engine Status */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-ink-primary">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>SQLITE WAL: {stats.sqliteWalActive ? 'ONLINE' : 'READY'}</span>
        </span>
        <span className="text-border-hairline">│</span>
        <span>FTS5 INDEXED: {stats.ftsIndexedPages} PAGES</span>
        {activePage && (
          <>
            <span className="text-border-hairline">│</span>
            <span>
              SPEC: <strong className="text-ink-primary">{activePage.code}</strong> (
              {activePage.mode === 'canvas' ? 'SPATIAL CANVAS' : 'BLOCK DOC'})
            </span>
          </>
        )}
      </div>

      {/* Right: Mode-Specific Telemetry (Word/Block count OR Grid X/Y & Zoom) */}
      <div className="flex items-center gap-3">
        {activePage?.mode === 'canvas' ? (
          <>
            <span className="text-accent-amber">GRID: 24PX SNAP</span>
            <span className="text-border-hairline">│</span>
            <span>
              X: {String(Math.round(telemetry.cursorX)).padStart(4, '0')} · Y:{' '}
              {String(Math.round(telemetry.cursorY)).padStart(4, '0')}
            </span>
            <span className="text-border-hairline">│</span>
            <span>ZOOM: {Math.round(telemetry.zoomPercent)}%</span>
          </>
        ) : (
          <>
            <span>
              {wordCount} WORDS · {activePage?.blocks.length || 0} BLOCKS
            </span>
            <span className="text-border-hairline">│</span>
            <span>
              X: {String(Math.round(telemetry.cursorX)).padStart(4, '0')} · Y:{' '}
              {String(Math.round(telemetry.cursorY)).padStart(4, '0')}
            </span>
            <span className="text-border-hairline">│</span>
            <span>UTF-8 · LOCAL-FIRST</span>
          </>
        )}
      </div>
    </footer>
  )
}
