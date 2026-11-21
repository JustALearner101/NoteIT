import React from 'react'
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
import noteitLogo from '@renderer/assets/noteit-logo.png'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  cn
} from '@renderer/components/ui'

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

  const allThemes = [...BUILTIN_THEMES, ...preferences.customThemes]

  return (
    <header
      aria-label="Application titlebar"
      className="h-[38px] bg-surface-chrome border-b border-border-hairline flex items-center justify-between px-2.5 select-none app-drag-region shrink-0 relative z-40"
    >
      {/* Left: Sidebar Toggle & Studio Brand Mark */}
      <div className="flex items-center gap-2 app-no-drag">
        <button
          type="button"
          onClick={toggleSidebar}
          title="Toggle sidebar (Ctrl+\)"
          aria-label="Toggle Sidebar"
          aria-expanded={!isSidebarCollapsed}
          className={cn(
            'h-7 w-7 rounded-[7px] flex items-center justify-center transition-colors',
            !isSidebarCollapsed
              ? 'text-ink-primary bg-surface-hover/80'
              : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <PanelLeft size={14} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setActiveMainView('workbench')}
          className="flex items-center gap-2 px-1 py-0.5 rounded-[6px] hover:bg-surface-hover/60 transition-colors"
          title="Back to main workbench"
          aria-label="Back to main workbench"
        >
          <img
            src={noteitLogo}
            alt=""
            aria-hidden="true"
            className="h-[19px] w-[19px] rounded-[5px] shadow-sm select-none"
          />
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
          aria-label="Search pages, DBML schemas, or run commands"
          className="w-full h-[26px] px-2.5 rounded-[7px] bg-surface-elevated/90 hover:bg-surface-hover border border-border-hairline hover:border-border-strong flex items-center justify-between text-[12px] text-ink-muted hover:text-ink-secondary transition-colors group"
        >
          <span className="flex items-center gap-2 truncate">
            <Search
              size={12}
              aria-hidden="true"
              className="text-ink-muted group-hover:text-accent-cobalt transition-colors shrink-0"
            />
            <span className="truncate">Search pages, DBML schemas, or run commands...</span>
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
          title="Toggle AI Chat (Ctrl+Shift+C)"
          aria-label="Toggle AI Chat"
          aria-pressed={activeMainView === 'ai-chat'}
          className={cn(
            'h-[26px] px-2 rounded-[6px] flex items-center gap-1.5 text-[12px] font-medium border transition-colors',
            activeMainView === 'ai-chat'
              ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]'
              : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <MessageSquare size={12.5} aria-hidden="true" />
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
          title="Open In-App Browser (Ctrl+Shift+B) · Alt+Click for Split-Pane Browser"
          aria-label="Open in-app browser"
          aria-pressed={activeMainView === 'browser' || isBrowserSplitOpen}
          className={cn(
            'h-[26px] px-2 rounded-[6px] flex items-center gap-1.5 text-[12px] font-medium border transition-colors',
            activeMainView === 'browser' || isBrowserSplitOpen
              ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]'
              : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <Globe size={12.5} aria-hidden="true" />
          <span className="hidden md:inline">Web</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMainView('workbench')
            toggleSplitPane()
          }}
          title="Toggle Split-Pane Workspace"
          aria-label="Toggle split pane"
          aria-pressed={Boolean(splitPageId)}
          className={cn(
            'h-[26px] px-2 rounded-[6px] flex items-center gap-1.5 text-[12px] font-medium border transition-colors',
            splitPageId
              ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]'
              : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <Columns2 size={12.5} aria-hidden="true" />
          <span className="hidden sm:inline">Split</span>
        </button>

        <div className="h-3.5 w-[1px] bg-border-hairline mx-0.5" />

        {/* Quick Theme Selector Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Select theme preset"
              aria-label="Select theme preset"
              className="h-[26px] w-[26px] rounded-[6px] flex items-center justify-center transition-colors text-ink-secondary hover:text-ink-primary hover:bg-surface-hover data-[state=open]:bg-surface-hover data-[state=open]:text-ink-primary"
            >
              <Palette size={13} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-60">
            <DropdownMenuLabel>Theme presets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allThemes.map((t) => {
              const active = t.id === preferences.activeThemeId
              return (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() => setActiveTheme(t.id)}
                  className={active ? 'bg-surface-hover text-ink-primary font-medium' : undefined}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      aria-hidden="true"
                      className="w-2.5 h-2.5 rounded-full border border-white/15 shrink-0"
                      style={{ backgroundColor: t.colors.accentCobalt }}
                    />
                    <span className="truncate">{t.name}</span>
                  </span>
                  {active && <Check size={12} className="text-accent-cobalt shrink-0" aria-hidden="true" />}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setActiveMainView('settings', 'appearance')}
              className="text-accent-cobalt font-medium"
            >
              <span>Theme Studio →</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={toggleTheme}
          title={
            theme === 'dark'
              ? 'Switch to Light Mode (Archival Vellum)'
              : 'Switch to Dark Mode (Obsidian Studio)'
          }
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="h-[26px] w-[26px] rounded-[6px] flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          {theme === 'dark' ? <Sun size={13} aria-hidden="true" /> : <Moon size={13} aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveMainView(activeMainView === 'settings' ? 'workbench' : 'settings')
          }
          title="Settings (Ctrl+,)"
          aria-label="Settings"
          aria-pressed={activeMainView === 'settings'}
          className={cn(
            'h-[26px] w-[26px] rounded-[6px] flex items-center justify-center transition-colors',
            activeMainView === 'settings'
              ? 'text-[var(--pill-cobalt-text)] bg-[var(--pill-cobalt-bg)]'
              : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
          )}
        >
          <Settings size={13} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => void openHelpCenter()}
          title="Open Help Center in Browser"
          aria-label="Help Center"
          className="h-[26px] w-[26px] rounded-[6px] flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          <HelpCircle size={13} aria-hidden="true" />
        </button>

        <div className="h-3.5 w-[1px] bg-border-hairline mx-1" />

        <button
          type="button"
          onClick={() => window.noteitAPI.windowMinimize()}
          title="Minimize"
          aria-label="Minimize"
          className="h-[26px] w-7 rounded-[6px] flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          <Minus size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => window.noteitAPI.windowMaximizeToggle()}
          title="Maximize / Restore"
          aria-label="Maximize"
          className="h-[26px] w-7 rounded-[6px] flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-hover transition-colors"
        >
          <Square size={10.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => window.noteitAPI.windowClose()}
          title="Close NoteIT"
          aria-label="Close NoteIT"
          className="h-[26px] w-7 rounded-[6px] flex items-center justify-center text-ink-secondary hover:bg-[#E5484D] hover:text-white transition-colors"
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
