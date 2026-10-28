import React from 'react'
import {
  Columns2,
  Minus,
  Moon,
  PanelLeft,
  Search,
  Square,
  Sun,
  X
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'

export const Titlebar: React.FC = () => {
  const {
    isSidebarCollapsed,
    toggleSidebar,
    setCommandPaletteOpen,
    splitPageId,
    toggleSplitPane,
    theme,
    toggleTheme
  } = useWorkspaceStore()

  return (
    <header className="h-9 bg-surface-chrome border-b border-border-hairline flex items-center justify-between px-3 select-none app-drag-region shrink-0">
      {/* Left: Brand Identity & Index Rail Toggle */}
      <div className="flex items-center gap-2.5 app-no-drag">
        <button
          onClick={toggleSidebar}
          title="Buka/Tutup Index Rail Sidebar (Ctrl+\)"
          className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
            !isSidebarCollapsed
              ? 'text-accent-cobalt bg-accent-cobalt/10'
              : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          }`}
        >
          <PanelLeft size={14} />
        </button>

        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-[3px] bg-accent-cobalt flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-sm">
            N
          </div>
          <span className="font-display font-semibold text-xs tracking-tight text-ink-primary">
            NoteIT
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border-hairline text-accent-amber tracking-wider">
            WB v2.0
          </span>
        </div>
      </div>

      {/* Center: Command Palette & Instant FTS5 Search Trigger */}
      <div className="app-no-drag flex-1 max-w-md mx-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full h-6 px-2.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-between text-xs text-ink-secondary transition-colors group"
        >
          <span className="flex items-center gap-2 truncate">
            <Search size={12} className="text-ink-muted group-hover:text-accent-cobalt transition-colors" />
            <span>Cari halaman, skema DBML, atau jalankan perintah...</span>
          </span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-chrome border border-border-hairline text-ink-muted">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Workbench Tools & Native Window Controls */}
      <div className="flex items-center gap-1 app-no-drag">
        <button
          onClick={() => toggleSplitPane()}
          title="Buka/Tutup Split-Pane Workspace"
          className={`h-6 px-2 rounded flex items-center gap-1.5 text-[11px] font-mono border transition-colors ${
            splitPageId
              ? 'bg-accent-cobalt/15 text-accent-cobalt border-accent-cobalt/40'
              : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          }`}
        >
          <Columns2 size={13} />
          <span>SPLIT</span>
        </button>

        <button
          onClick={toggleTheme}
          title={
            theme === 'dark'
              ? 'Ganti ke Light Mode (Archival Vellum)'
              : 'Ganti ke Dark Mode (Graphite Slate)'
          }
          className="h-6 w-6 rounded flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <div className="h-3.5 w-[1px] bg-border-hairline mx-1" />

        <button
          onClick={() => window.noteitAPI.windowMinimize()}
          title="Minimize"
          className="h-6 w-7 rounded flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={() => window.noteitAPI.windowMaximizeToggle()}
          title="Maximize / Restore"
          className="h-6 w-7 rounded flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.noteitAPI.windowClose()}
          title="Tutup NoteIT"
          className="h-6 w-7 rounded flex items-center justify-center text-ink-secondary hover:bg-[#EF4444] hover:text-white transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </header>
  )
}
