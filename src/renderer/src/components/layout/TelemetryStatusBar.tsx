import React from 'react'
import { Code2, Terminal } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { useTerminalStore } from '@renderer/stores/useTerminalStore'
import { cn } from '@renderer/components/ui'

export const TelemetryStatusBar: React.FC = () => {
  const { pages, activePageId, stats, telemetry } = useWorkspaceStore()
  const { isOpen, toggleDrawer, tabs, activeTabId } = useTerminalStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const activePage = pages.find((p) => p.id === activePageId)

  const wordCount = React.useMemo(() => {
    if (!activePage) return 0
    const allText = activePage.blocks.map((b) => b.content).join(' ')
    const words = allText.trim().split(/\s+/).filter(Boolean)
    return words.length
  }, [activePage])

  return (
    <footer className="h-[28px] bg-surface-chrome border-t border-border-hairline px-3 flex items-center justify-between text-[11px] text-ink-muted select-none shrink-0 tabular-nums">
      {/* Left: Terminal & Active Spec Indicator (mirrors Image 3 footer left: Run log / Code) */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleDrawer}
          title="Toggle ADE Terminal Drawer (Ctrl+`)"
          className={cn(
            'h-5 px-2 rounded-[5px] flex items-center gap-1.5 transition-colors font-medium',
            isOpen
              ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)]'
              : 'hover:bg-surface-hover text-ink-secondary hover:text-ink-primary'
          )}
        >
          <Terminal size={11.5} className={isOpen ? 'text-accent-cobalt' : 'text-ink-muted'} />
          <span>
            {tabs.length > 0 ? `${activeTab?.title || 'Terminal'} (${tabs.length})` : 'Terminal'}
          </span>
        </button>

        {activePage && (
          <span className="hidden sm:flex items-center gap-1.5 text-ink-secondary truncate">
            <Code2 size={11.5} className="text-ink-muted shrink-0" />
            <span className="font-mono text-[10.5px] text-ink-primary">{activePage.code}</span>
            <span className="text-ink-muted">·</span>
            <span>{activePage.mode === 'canvas' ? 'Spatial canvas' : 'Block document'}</span>
          </span>
        )}
      </div>

      {/* Center: Quiet Telemetry */}
      <div className="hidden md:flex items-center gap-2 text-ink-muted">
        {activePage?.mode === 'canvas' ? (
          <>
            <span>Grid 20px</span>
            <span>·</span>
            <span className="font-mono text-[10.5px]">
              X {Math.round(telemetry.cursorX)} · Y {Math.round(telemetry.cursorY)}
            </span>
            <span>·</span>
            <span className="font-mono text-[10.5px]">{Math.round(telemetry.zoomPercent)}%</span>
          </>
        ) : (
          <>
            <span>
              {wordCount} words · {activePage?.blocks.length || 0} blocks
            </span>
            <span>·</span>
            <span>FTS5 {stats.ftsIndexedPages} pages</span>
          </>
        )}
      </div>

      {/* Right: Auto-Save & Local SQLite Live Status (mirrors Image 3 right green dot) */}
      <div className="flex items-center gap-2 text-ink-secondary shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald" />
          <span>SQLite WAL {stats.sqliteWalActive ? 'online' : 'ready'}</span>
        </span>
      </div>
    </footer>
  )
}
