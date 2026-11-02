import React, { useState } from 'react'
import {
  Check,
  Columns2,
  Globe,
  HelpCircle,
  MessageSquare,
  Minus,
  Moon,
  Palette,
  PanelLeft,
  Search,
  Settings,
  Square,
  Sun,
  X
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { BUILTIN_THEMES } from '@renderer/lib/themes'

export const Titlebar: React.FC = () => {
  const {
    isSidebarCollapsed,
    toggleSidebar,
    setCommandPaletteOpen,
    splitPageId,
    toggleSplitPane,
    isBrowserSplitOpen,
    toggleBrowserSplitPane,
    theme,
    toggleTheme,
    preferences,
    setActiveTheme,
    activeMainView,
    setActiveMainView,
    openHelpCenter
  } = useWorkspaceStore()

  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false)
  const allThemes = [...BUILTIN_THEMES, ...preferences.customThemes]

  return (
    <header className="h-9 bg-surface-chrome border-b border-border-hairline flex items-center justify-between px-3 select-none app-drag-region shrink-0 relative z-40">
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

        <button
          type="button"
          onClick={() => setActiveMainView('workbench')}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          title="Kembali ke Workbench Utama"
        >
          <div className="h-4 w-4 rounded-[3px] bg-accent-cobalt flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-sm">
            N
          </div>
          <span className="font-display font-semibold text-xs tracking-tight text-ink-primary">
            NoteIT
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border-hairline text-accent-amber tracking-wider">
            WB v2.0
          </span>
        </button>
      </div>

      {/* Center: Command Palette & Instant FTS5 Search Trigger */}
      <div className="app-no-drag flex-1 max-w-md mx-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full h-6 px-2.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-between text-xs text-ink-secondary transition-colors group"
        >
          <span className="flex items-center gap-2 truncate">
            <Search
              size={12}
              className="text-ink-muted group-hover:text-accent-cobalt transition-colors"
            />
            <span>Cari halaman, skema DBML, atau jalankan perintah...</span>
          </span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-chrome border border-border-hairline text-ink-muted">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Workbench Tools, Quick Theme Picker & Native Window Controls */}
      <div className="flex items-center gap-1 app-no-drag">
        <button
          onClick={() =>
            setActiveMainView(activeMainView === 'ai-chat' ? 'workbench' : 'ai-chat')
          }
          title="Buka/Tutup AI Chat (Ctrl+Shift+C)"
          className={`h-6 px-2 rounded flex items-center gap-1.5 text-[11px] font-mono border transition-colors ${
            activeMainView === 'ai-chat'
              ? 'bg-accent-cobalt/15 text-accent-cobalt border-accent-cobalt/40'
              : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          }`}
        >
          <MessageSquare size={12} />
          <span className="hidden md:inline">CHAT</span>
        </button>

        <button
          onClick={(e) => {
            if (e.altKey) {
              toggleBrowserSplitPane()
            } else {
              setActiveMainView(activeMainView === 'browser' ? 'workbench' : 'browser')
            }
          }}
          title="Buka In-App Browser (Ctrl+Shift+B) · Alt+Klik untuk Split-Pane Browser"
          className={`h-6 px-2 rounded flex items-center gap-1.5 text-[11px] font-mono border transition-colors ${
            activeMainView === 'browser' || isBrowserSplitOpen
              ? 'bg-accent-cobalt/15 text-accent-cobalt border-accent-cobalt/40'
              : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          }`}
        >
          <Globe size={12} />
          <span className="hidden md:inline">WEB</span>
        </button>

        <button
          onClick={() => {
            setActiveMainView('workbench')
            toggleSplitPane()
          }}
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

        {/* Quick Theme Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
            title="Pilih Preset Tema / Buka Theme Studio"
            className="h-6 px-1.5 rounded flex items-center gap-1 text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
          >
            <Palette size={13} />
          </button>

          {isThemeDropdownOpen && (
            <div className="absolute right-0 top-7 z-50 w-56 rounded-lg bg-surface-elevated border border-border-hairline shadow-2xl p-1.5 space-y-0.5 animate-popover-enter">
              <div className="px-2 py-1 font-mono text-[10px] text-ink-muted uppercase flex items-center justify-between">
                <span>PRESET TEMA</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsThemeDropdownOpen(false)
                    setActiveMainView('settings', 'appearance')
                  }}
                  className="text-accent-cobalt hover:underline"
                >
                  Studio →
                </button>
              </div>
              {allThemes.map((t) => {
                const active = t.id === preferences.activeThemeId
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTheme(t.id)
                      setIsThemeDropdownOpen(false)
                    }}
                    className={`w-full px-2 py-1.5 rounded text-left text-xs flex items-center justify-between ${
                      active
                        ? 'bg-accent-cobalt/15 text-accent-cobalt font-medium'
                        : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: t.colors.accentCobalt }}
                      />
                      <span className="truncate">{t.name}</span>
                    </span>
                    {active && <Check size={12} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          title={
            theme === 'dark'
              ? 'Ganti cepat ke Light Mode (Archival Vellum)'
              : 'Ganti cepat ke Dark Mode (Graphite Slate)'
          }
          className="h-6 w-6 rounded flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <button
          onClick={() =>
            setActiveMainView(activeMainView === 'settings' ? 'workbench' : 'settings')
          }
          title="Settings (Ctrl+,)"
          className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
            activeMainView === 'settings'
              ? 'text-accent-cobalt bg-accent-cobalt/15'
              : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          }`}
        >
          <Settings size={13} />
        </button>

        <button
          onClick={() => void openHelpCenter()}
          title="Buka Help Center HTML di Browser (?)"
          className="h-6 w-6 rounded flex items-center justify-center text-ink-secondary hover:text-accent-cobalt hover:bg-surface-hover transition-colors"
        >
          <HelpCircle size={13} />
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
