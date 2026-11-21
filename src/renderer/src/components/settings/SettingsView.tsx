import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Database,
  Globe,
  Keyboard,
  Palette,
  Plug,
  Search,
  Settings2,
  Sparkles,
  Cpu
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { matchesShortcutEvent } from '@renderer/lib/shortcuts'
import { Badge, Kbd, cn } from '@renderer/components/ui'
import { GeneralEditorTab } from './tabs/GeneralEditorTab'
import { AppearanceThemesTab } from './tabs/AppearanceThemesTab'
import { AiProvidersTab } from './tabs/AiProvidersTab'
import { McpServersTab } from './tabs/McpServersTab'
import { StorageBackupTab } from './tabs/StorageBackupTab'
import { BrowserTab } from './tabs/BrowserTab'
import { ShortcutsTab } from './tabs/ShortcutsTab'
import { WorkspaceStatsTab } from './tabs/WorkspaceStatsTab'
import { NotebookSettingsTab } from './tabs/NotebookSettingsTab'

interface NavItem {
  id: string
  label: string
  badge?: 'Beta'
  keywords: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'general',
    label: 'General',
    keywords: 'general editor onboarding spellcheck default page mode checklist help',
    icon: <Settings2 size={14} aria-hidden="true" />
  },
  {
    id: 'appearance',
    label: 'Appearance',
    keywords: 'appearance theme color preset custom dark light motion font grid',
    icon: <Palette size={14} aria-hidden="true" />
  },
  {
    id: 'ai-providers',
    label: 'AI providers',
    keywords: 'ai api key openai gemini anthropic claude ollama model approval chat',
    icon: <Sparkles size={14} aria-hidden="true" />
  },
  {
    id: 'mcp-servers',
    label: 'MCP servers',
    badge: 'Beta',
    keywords: 'mcp model context protocol servers tools stdio sse http',
    icon: <Plug size={14} aria-hidden="true" />
  },
  {
    id: 'storage-backup',
    label: 'Storage & backup',
    keywords: 'sqlite wal database backup vacuum export folder assets gc logs',
    icon: <Database size={14} aria-hidden="true" />
  },
  {
    id: 'browser',
    label: 'Browser',
    badge: 'Beta',
    keywords: 'browser web in-app reference webview',
    icon: <Globe size={14} aria-hidden="true" />
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    keywords: 'shortcuts keyboard hotkey ctrl',
    icon: <Keyboard size={14} aria-hidden="true" />
  },
  {
    id: 'stats-usage',
    label: 'Stats & usage',
    keywords: 'stats usage pages blocks words fts5',
    icon: <Cpu size={14} aria-hidden="true" />
  }
]

/** Legacy deep-link ids (older callers) mapped onto the consolidated tabs. */
const SECTION_ALIASES: Record<string, string> = {
  onboarding: 'general',
  integrations: 'general',
  automations: 'general',
  artifacts: 'general',
  'quick-commands': 'general',
  'input-editing': 'general',
  privacy: 'general',
  advanced: 'storage-backup',
  plugins: 'general',
  'mockup-studio': 'general',
  chat: 'ai-providers',
  'ai-agents': 'ai-providers',
  'ai-orchestration': 'ai-providers',
  'ai-computer-use': 'ai-providers',
  'ai-voice': 'ai-providers'
}

export const SettingsView: React.FC = () => {
  const {
    notebooks,
    activeSettingsSection,
    setActiveSettingsSection,
    setActiveMainView,
    isCommandPaletteOpen,
    isShortcutCheatsheetOpen
  } = useWorkspaceStore()

  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const section = SECTION_ALIASES[activeSettingsSection] ?? activeSettingsSection

  // Ctrl+F focuses settings search; Esc returns to the workbench when no modal is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || isCommandPaletteOpen || isShortcutCheatsheetOpen) return
      if (matchesShortcutEvent(e, 'settings-search')) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setActiveMainView('workbench')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveMainView, isCommandPaletteOpen, isShortcutCheatsheetOpen])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return NAV_ITEMS
    return NAV_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.keywords.includes(q)
    )
  }, [searchQuery])

  const navButtonCls = (active: boolean): string =>
    cn(
      'w-full px-2.5 py-[6px] rounded-[7px] text-[12.5px] flex items-center justify-between transition-colors',
      active
        ? 'bg-surface-hover text-ink-primary font-medium'
        : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
    )

  const renderPanel = (): React.ReactNode => {
    if (section.startsWith('notebook:')) {
      return <NotebookSettingsTab notebookId={section.replace('notebook:', '')} />
    }
    switch (section) {
      case 'general':
        return <GeneralEditorTab />
      case 'ai-providers':
        return <AiProvidersTab />
      case 'mcp-servers':
        return <McpServersTab />
      case 'storage-backup':
        return <StorageBackupTab />
      case 'browser':
        return <BrowserTab />
      case 'shortcuts':
        return <ShortcutsTab />
      case 'stats-usage':
        return <WorkspaceStatsTab />
      case 'appearance':
      default:
        return <AppearanceThemesTab />
    }
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden bg-canvas-primary ambient-aurora-host animate-view-enter">
      <aside
        aria-label="Settings navigation"
        className="w-[252px] shrink-0 bg-surface-chrome border-r border-border-hairline flex flex-col h-full select-none"
      >
        <div className="p-3 space-y-2.5 border-b border-border-hairline">
          <button
            type="button"
            onClick={() => setActiveMainView('workbench')}
            className="flex items-center gap-2 text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors px-1 py-0.5"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to app</span>
          </button>

          <div className="relative">
            <Search
              size={13}
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search settings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings"
              className="w-full h-8 pl-8 pr-14 rounded-[8px] bg-surface-elevated border border-border-hairline text-xs text-ink-primary placeholder:text-ink-muted focus:border-accent-cobalt"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
              <Kbd>Ctrl F</Kbd>
            </div>
          </div>
        </div>

        <nav aria-label="Settings sections" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          <ul className="space-y-0.5">
            {filteredItems.map((item) => {
              const isActive = section === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setActiveSettingsSection(item.id)}
                    className={navButtonCls(isActive)}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <span className={isActive ? 'text-accent-cobalt' : 'text-ink-muted'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && <Badge tone="cobalt">{item.badge}</Badge>}
                  </button>
                </li>
              )
            })}
            {filteredItems.length === 0 && (
              <li className="px-2.5 py-2 text-[11.5px] text-ink-muted">No matching settings.</li>
            )}
          </ul>

          <div className="space-y-0.5 pt-2 border-t border-border-subtle">
            <div className="px-2 pb-1 text-[11px] font-medium text-ink-muted">
              Projects &amp; notebooks
            </div>
            <ul className="space-y-0.5">
              {notebooks.map((nb) => {
                const secKey = `notebook:${nb.id}`
                const isActive = section === secKey
                return (
                  <li key={nb.id}>
                    <button
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setActiveSettingsSection(secKey)}
                      className={navButtonCls(isActive)}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          aria-hidden="true"
                          className={`w-2 h-2 rounded-[3px] ${MARKER_META[nb.color].dotBg}`}
                        />
                        <span className="truncate">{nb.name}</span>
                      </span>
                      <span className="text-[11px] opacity-75" aria-hidden="true">
                        {nb.icon}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-7">
        <div className="max-w-4xl mx-auto">{renderPanel()}</div>
      </main>
    </div>
  )
}
