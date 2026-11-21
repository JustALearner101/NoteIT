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
import { Kbd, cn } from '@renderer/components/ui'

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
    <header className="h-[38px] bg-surface-chrome border-b border-border-hairline flex items-center justify-between px-2.5 select-none app-drag-region shrink-0 relative z-40">
      {/* Left: Sidebar Toggle & Studio Brand Mark */}
      <div className="flex items-center gap-2 app-no-drag">
        <button
          type="button"
          onClick={toggleSidebar}
          title="Buka/Tutup Sidebar (Ctrl+\)"
          aria-label="Toggle Sidebar"
          className={cn(
            'h-7 w-7 rounded-[7px] flex items-center justify-center transition-colors',
            !isSidebarCollapsed
              ? 'text-ink-primary bg-surface-hover/80'
              : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <PanelLeft size={14} />
        </button>

        <button
          type="button"
          onClick={() => setActiveMainView('workbench')}
          className="flex items-center gap-2 px-1 py-0.5 rounded-[6px] hover:bg-surface-hover/60 transition-colors"
          title="Kembali ke Workbench Utama"
        >
          <div className="h-[18px] w-[18px] rounded-[5px] bg-ink-primary text-canvas-primary flex items-center justify-center text-[10px] font-display font-bold shadow-sm">
            N
          </div>
          <span className="font-display font-semibold text-[12.5px] tracking-[-0.015em] text-ink-primary">
            NoteIT
          </span>
          <span className="text-[10.5px] px-1.5 py-[1px] rounded-[5px] bg-surface-elevated border border-border-hairline text-ink-muted font-mono">
            v2
          </span>
        </button>
      </div>

      {/* Center: Command Palette & Instant FTS5 Search Trigger */}
      <div className="app-no-drag flex-1 max-w-[420px] mx-4">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full h-[26px] px-2.5 rounded-[7px] bg-surface-elevated/90 hover:bg-surface-hover border border-border-hairline hover:border-border-strong flex items-center justify-between text-[12px] text-ink-muted hover:text-ink-secondary transition-colors group"
        >
          <span className="flex items-center gap-2 truncate">
            <Search
              size={12}
              className="text-ink-muted group-hover:text-accent-cobalt transition-colors shrink-0"
            />
            <span className="truncate">Cari halaman, skema DBML, atau jalankan perintah...</span>
          </span>
          <Kbd className="ml-2">Ctrl+K</Kbd>
        </button>
      </div>

      {/* Right: Workbench Tools, Quick Theme Picker & Native Window Controls */}
      <div className="flex items-center gap-1 app-no-drag">
        <button
          type="button"
          onClick={() =>
            setActiveMainView(activeMainView === 'ai-chat' ? 'workbench' : 'ai-chat')
          }
          title="Buka/Tutup AI Chat (Ctrl+Shift+C)"
          className={cn(
            'h-[26px] px-2 rounded-[6px] flex items-center gap-1.5 text-[12px] font-medium border transition-colors',
            activeMainView === 'ai-chat'
              ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]'
              : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <MessageSquare size={12.5} />
          <span className="hidden md:inline">Chat</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            if (e.altKey) {
              toggleBrowserSplitPane()
            } else {
              setActiveMainView(activeMainView === 'browser' ? 'workbench' : 'browser')
            }
          }}
          title="Buka In-App Browser (Ctrl+Shift+B) · Alt+Klik untuk Split-Pane Browser"
          className={cn(
            'h-[26px] px-2 rounded-[6px] flex items-center gap-1.5 text-[12px] font-medium border transition-colors',
            activeMainView === 'browser' || isBrowserSplitOpen
              ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]'
              : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <Globe size={12.5} />
          <span className="hidden md:inline">Web</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMainView('workbench')
            toggleSplitPane()
          }}
          title="Buka/Tutup Split-Pane Workspace"
          className={cn(
            'h-[26px] px-2 rounded-[6px] flex items-center gap-1.5 text-[12px] font-medium border transition-colors',
            splitPageId
              ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]'
              : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <Columns2 size={12.5} />
          <span className="hidden sm:inline">Split</span>
        </button>

        <div className="h-3.5 w-[1px] bg-border-hairline mx-0.5" />

        {/* Quick Theme Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
            title="Pilih Preset Tema / Buka Theme Studio"
            aria-label="Pilih Preset Tema"
            className={cn(
              'h-[26px] w-[26px] rounded-[6px] flex items-center justify-center transition-colors',
              isThemeDropdownOpen
                ? 'bg-surface-hover text-ink-primary'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
            )}
          >
            <Palette size={13} />
          </button>

          {isThemeDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsThemeDropdownOpen(false)}
              />
              <div className="absolute right-0 top-8 z-50 w-60 rounded-[10px] bg-surface-elevated border border-border-hairline shadow-popover p-1.5 space-y-0.5 animate-popover-enter">
                <div className="px-2 py-1.5 text-[10.5px] font-medium text-ink-muted flex items-center justify-between border-b border-border-subtle mb-1">
                  <span>Theme presets</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsThemeDropdownOpen(false)
                      setActiveMainView('settings', 'appearance')
                    }}
                    className="text-accent-cobalt hover:underline font-medium"
                  >
                    Theme Studio →
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
                      className={cn(
                        'w-full px-2 py-1.5 rounded-[7px] text-left text-xs flex items-center justify-between transition-colors',
                        active
                          ? 'bg-surface-hover text-ink-primary font-medium'
                          : 'text-ink-secondary hover:bg-surface-hover/70 hover:text-ink-primary'
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-white/15 shrink-0"
                          style={{ backgroundColor: t.colors.accentCobalt }}
                        />
                        <span className="truncate">{t.name}</span>
                      </span>
                      {active && <Check size={12} className="text-accent-cobalt shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          title={
            theme === 'dark'
              ? 'Ganti cepat ke Light Mode (Archival Vellum)'
              : 'Ganti cepat ke Dark Mode (Obsidian Studio)'
          }
          aria-label="Ganti Mode Tema"
          className="h-[26px] w-[26px] rounded-[6px] flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveMainView(activeMainView === 'settings' ? 'workbench' : 'settings')
          }
          title="Settings (Ctrl+,)"
          aria-label="Settings"
          className={cn(
            'h-[26px] w-[26px] rounded-[6px] flex items-center justify-center transition-colors',
            activeMainView === 'settings'
              ? 'text-[var(--pill-cobalt-text)] bg-[var(--pill-cobalt-bg)]'
              : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <Settings size={13} />
        </button>

        <button
          type="button"
          onClick={() => void openHelpCenter()}
          title="Buka Help Center HTML di Browser (?)"
          aria-label="Help Center"
          className="h-[26px] w-[26px] rounded-[6px] flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          <HelpCircle size={13} />
        </button>

        <div className="h-3.5 w-[1px] bg-border-hairline mx-1" />

        <button
          type="button"
          onClick={() => window.noteitAPI.windowMinimize()}
          title="Minimize"
          aria-label="Minimize"
          className="h-[26px] w-7 rounded-[6px] flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          onClick={() => window.noteitAPI.windowMaximizeToggle()}
          title="Maximize / Restore"
          aria-label="Maximize"
          className="h-[26px] w-7 rounded-[6px] flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          <Square size={10.5} />
        </button>
        <button
          type="button"
          onClick={() => window.noteitAPI.windowClose()}
          title="Tutup NoteIT"
          aria-label="Tutup NoteIT"
          className="h-[26px] w-7 rounded-[6px] flex items-center justify-center text-ink-secondary hover:bg-[#E5484D] hover:text-white transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </header>
  )
}
