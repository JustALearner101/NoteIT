import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Columns2,
  Database,
  FileDown,
  FilePlus,
  FolderDown,
  GanttChart,
  Globe,
  GraduationCap,
  HelpCircle,
  Keyboard,
  LayoutGrid,
  MessageSquare,
  Moon,
  Radio,
  Search,
  Settings,
  Sun,
  Terminal,
  X,
  Zap
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { useTerminalStore } from '@renderer/stores/useTerminalStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { SHORTCUT_BY_ID } from '@renderer/lib/shortcuts'
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Kbd,
  cn
} from '@renderer/components/ui'
import type { SearchResultItem } from '@shared/types/domain'

interface PaletteAction {
  id: string
  label: string
  keywords: string
  shortcut?: string
  transfersFocus?: boolean
  icon: React.ReactNode
  run: () => void | Promise<void>
}

type NavigableItem =
  | { kind: 'action'; id: string; action: PaletteAction }
  | { kind: 'page'; id: string; result: SearchResultItem }

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setShortcutCheatsheetOpen,
    openMissionBriefing,
    sections,
    activeNotebookId,
    activePageId,
    openPageInTab,
    createPage,
    loadWorkspace,
    toggleSplitPane,
    toggleTheme,
    theme,
    setActiveMainView,
    openHelpCenter,
    showToast
  } = useWorkspaceStore()

  const toggleTerminalDrawer = useTerminalStore((s) => s.toggleDrawer)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)

  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const suppressRestoreFocusRef = useRef(false)
  const optionRefs = useRef<Record<string, HTMLElement | null>>({})

  const trimmedQuery = query.trimStart()
  const isCommandMode = trimmedQuery.startsWith('>')
  const cleanQuery = (isCommandMode ? trimmedQuery.slice(1) : query).trim().toLowerCase()

  useEffect(() => {
    if (!isCommandPaletteOpen) return
    if (isCommandMode) {
      setResults([])
      return
    }
    let active = true
    window.noteitAPI.searchWorkspace(query).then((res) => {
      if (active) setResults(res)
    })
    return () => {
      active = false
    }
  }, [query, isCommandMode, isCommandPaletteOpen])

  const defaultSection =
    sections.find((s) => s.notebookId === activeNotebookId) || sections[0]

  const actions = useMemo<PaletteAction[]>(() => {
    const handleQuickCreate = async (
      template: 'blank' | 'dbml' | 'roadmap' | 'canvas'
    ): Promise<void> => {
      if (!defaultSection) return
      await createPage({
        sectionId: defaultSection.id,
        title:
          template === 'dbml'
            ? 'New DBML Schema'
            : template === 'roadmap'
              ? 'Master Gantt & Roadmap'
              : template === 'canvas'
                ? 'New Spatial Canvas'
                : 'New Specification',
        template
      })
    }

    const handleOpenDailyNote = async (): Promise<void> => {
      const page = await window.noteitAPI.openDailyNote()
      await loadWorkspace()
      openPageInTab(page.id)
    }

    const handleExportPage = async (): Promise<void> => {
      if (!activePageId) {
        showToast('No active page to export')
        return
      }
      const result = await window.noteitAPI.exportMarkdown({
        scope: 'page',
        pageId: activePageId
      })
      showToast(
        result.saved && result.filePath
          ? `Markdown saved: ${result.filePath}`
          : 'Page export canceled'
      )
    }

    const handleExportWorkspace = async (): Promise<void> => {
      const result = await window.noteitAPI.exportMarkdown({ scope: 'workspace' })
      showToast(
        result.saved && result.filePath
          ? `${result.fileCount ?? 0} pages exported to ${result.filePath}`
          : 'Workspace export canceled'
      )
    }

    return [
      {
        id: 'create-blank',
        label: 'New Block Document',
        keywords: 'create new page doc block specification',
        icon: <FilePlus size={13} className="text-accent-cobalt shrink-0" />,
        run: () => handleQuickCreate('blank')
      },
      {
        id: 'create-dbml',
        label: 'New DBML Schema',
        keywords: 'create database schema dbml table sql',
        icon: <Database size={13} className="text-accent-amber shrink-0" />,
        run: () => handleQuickCreate('dbml')
      },
      {
        id: 'create-roadmap',
        label: 'New Gantt Roadmap',
        keywords: 'create gantt chart roadmap timeline project',
        icon: <GanttChart size={13} className="text-accent-teal shrink-0" />,
        run: () => handleQuickCreate('roadmap')
      },
      {
        id: 'create-canvas',
        label: 'New Spatial Canvas',
        keywords: 'create spatial canvas diagram board',
        icon: <LayoutGrid size={13} className="text-accent-violet shrink-0" />,
        run: () => handleQuickCreate('canvas')
      },
      {
        id: 'daily-note',
        label: "Open Today's Daily Note",
        keywords: 'daily note today journal log',
        shortcut: SHORTCUT_BY_ID['open-daily-note'].keys,
        icon: <CalendarDays size={13} className="text-accent-teal shrink-0" />,
        run: handleOpenDailyNote
      },
      {
        id: 'dispatch-spec',
        label: 'Dispatch Spec to Agent',
        keywords: 'dispatch agent mission briefing cli worktree ade',
        shortcut: SHORTCUT_BY_ID['dispatch-spec'].keys,
        transfersFocus: true,
        icon: <Zap size={13} className="text-accent-cobalt shrink-0" />,
        run: () => {
          setActiveMainView('workbench')
          openMissionBriefing()
        }
      },
      {
        id: 'open-mission-control',
        label: 'Open Mission Control',
        keywords: 'agent board mission control sessions worktree',
        shortcut: SHORTCUT_BY_ID['toggle-mission-control'].keys,
        transfersFocus: true,
        icon: <Radio size={13} className="text-accent-teal shrink-0" />,
        run: () => setActiveMainView('agent-board')
      },
      {
        id: 'toggle-terminal',
        label: 'Toggle Terminal Drawer',
        keywords: 'terminal drawer shell cli ade pty',
        shortcut: SHORTCUT_BY_ID['toggle-terminal'].keys,
        transfersFocus: true,
        icon: <Terminal size={13} className="text-accent-cobalt shrink-0" />,
        run: () => toggleTerminalDrawer()
      },
      {
        id: 'toggle-split',
        label: 'Toggle Split-Pane',
        keywords: 'split pane dual view side by side',
        icon: <Columns2 size={13} className="text-accent-cobalt shrink-0" />,
        run: () => toggleSplitPane()
      },
      {
        id: 'toggle-theme',
        label: `Switch Theme (${theme === 'dark' ? 'Light' : 'Dark'})`,
        keywords: 'theme dark light appearance archival obsidian',
        icon:
          theme === 'dark' ? (
            <Sun size={13} className="text-accent-amber shrink-0" />
          ) : (
            <Moon size={13} className="text-accent-cobalt shrink-0" />
          ),
        run: () => toggleTheme()
      },
      {
        id: 'export-page',
        label: 'Export Page (.md)',
        keywords: 'export markdown file page',
        icon: <FileDown size={13} className="text-accent-amber shrink-0" />,
        run: handleExportPage
      },
      {
        id: 'export-workspace',
        label: 'Export Workspace (.md)',
        keywords: 'export markdown all pages workspace backup',
        icon: <FolderDown size={13} className="text-accent-teal shrink-0" />,
        run: handleExportWorkspace
      },
      {
        id: 'open-ai-chat',
        label: 'Open AI Assistant',
        keywords: 'ai chat assistant llm prompt',
        shortcut: SHORTCUT_BY_ID['toggle-ai-chat'].keys,
        transfersFocus: true,
        icon: <MessageSquare size={13} className="text-accent-cobalt shrink-0" />,
        run: () => setActiveMainView('ai-chat')
      },
      {
        id: 'open-browser',
        label: 'Open In-App Browser',
        keywords: 'web browser reference docs url',
        shortcut: SHORTCUT_BY_ID['toggle-browser'].keys,
        transfersFocus: true,
        icon: <Globe size={13} className="text-accent-teal shrink-0" />,
        run: () => setActiveMainView('browser')
      },
      {
        id: 'open-learn',
        label: 'Open Learn Workbench & Knowledge Graph',
        keywords: 'learn study tutor quiz practice knowledge graph learnharness',
        transfersFocus: true,
        icon: <GraduationCap size={13} className="text-accent-teal shrink-0" />,
        run: () => setActiveMainView('learn')
      },
      {
        id: 'open-ai-providers',
        label: 'AI Providers, Custom Endpoints & CLI Bridges',
        keywords: 'ai provider api key custom openai anthropic claude cli gemini codex',
        transfersFocus: true,
        icon: <Settings size={13} className="text-accent-cobalt shrink-0" />,
        run: () => setActiveMainView('settings', 'ai-providers')
      },
      {
        id: 'open-settings',
        label: 'Settings & Theme Studio',
        keywords: 'settings preferences theme studio config',
        shortcut: SHORTCUT_BY_ID['toggle-settings'].keys,
        transfersFocus: true,
        icon: <Settings size={13} className="text-accent-amber shrink-0" />,
        run: () => setActiveMainView('settings', 'appearance')
      },
      {
        id: 'keyboard-shortcuts',
        label: 'Keyboard Shortcuts',
        keywords: 'keyboard shortcuts hotkeys cheatsheet keybindings help',
        shortcut: SHORTCUT_BY_ID['shortcut-cheatsheet'].keys,
        transfersFocus: true,
        icon: <Keyboard size={13} className="text-accent-violet shrink-0" />,
        run: () => setShortcutCheatsheetOpen(true)
      },
      {
        id: 'help-center',
        label: 'Help Center',
        keywords: 'help documentation guide manual',
        icon: <HelpCircle size={13} className="text-accent-violet shrink-0" />,
        run: () => void openHelpCenter()
      }
    ]
  }, [
    activePageId,
    createPage,
    defaultSection,
    loadWorkspace,
    openHelpCenter,
    openMissionBriefing,
    openPageInTab,
    setActiveMainView,
    setShortcutCheatsheetOpen,
    showToast,
    theme,
    toggleSplitPane,
    toggleTerminalDrawer,
    toggleTheme
  ])

  const filteredActions = useMemo(() => {
    if (!cleanQuery) return actions
    return actions.filter(
      (action) =>
        action.label.toLowerCase().includes(cleanQuery) ||
        action.keywords.toLowerCase().includes(cleanQuery)
    )
  }, [actions, cleanQuery])

  const navigableItems = useMemo<NavigableItem[]>(() => {
    const items: NavigableItem[] = filteredActions.map((action) => ({
      kind: 'action',
      id: `action:${action.id}`,
      action
    }))
    if (!isCommandMode) {
      for (const result of results) {
        items.push({
          kind: 'page',
          id: `page:${result.pageId}`,
          result
        })
      }
    }
    return items
  }, [filteredActions, isCommandMode, results])

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      setQuery('')
      setActiveIndex(-1)
      return
    }
    setActiveIndex(navigableItems.length > 0 ? 0 : -1)
  }, [isCommandPaletteOpen, query, navigableItems.length])

  const activeItem = activeIndex >= 0 ? navigableItems[activeIndex] : undefined

  useEffect(() => {
    if (!activeItem) return
    optionRefs.current[activeItem.id]?.scrollIntoView({ block: 'nearest' })
  }, [activeItem])

  const closePalette = (transfersFocus = false): void => {
    suppressRestoreFocusRef.current = transfersFocus
    setCommandPaletteOpen(false)
  }

  const executeItem = (item: NavigableItem, altKey = false): void => {
    if (item.kind === 'action') {
      closePalette(Boolean(item.action.transfersFocus))
      void item.action.run()
      return
    }
    closePalette(false)
    setActiveMainView('workbench')
    openPageInTab(item.result.pageId, altKey)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (navigableItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % navigableItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? navigableItems.length - 1 : prev - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(navigableItems.length - 1)
    } else if (e.key === 'Enter' && activeItem) {
      e.preventDefault()
      executeItem(activeItem, e.altKey)
    }
  }

  const indexById = useMemo(() => {
    const map = new Map<string, number>()
    navigableItems.forEach((item, idx) => map.set(item.id, idx))
    return map
  }, [navigableItems])

  return (
    <Dialog
      open={isCommandPaletteOpen}
      onOpenChange={(open) => {
        if (!open) suppressRestoreFocusRef.current = false
        setCommandPaletteOpen(open)
      }}
    >
      <DialogContent
        data-command-palette
        showCloseButton={false}
        size="xl"
        aria-label="Command Palette"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        onCloseAutoFocus={(e) => {
          if (suppressRestoreFocusRef.current) {
            e.preventDefault()
            suppressRestoreFocusRef.current = false
          }
        }}
        className="top-[14%] translate-y-0 p-0 overflow-hidden select-none"
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search workspace pages and DBML schemas, or type &gt; to filter quick actions.
        </DialogDescription>

        {/* Top Search Combobox */}
        <div className="px-4 py-3 bg-surface-chrome/90 border-b border-border-hairline flex items-center gap-3">
          <Search size={15} className="text-accent-cobalt shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isCommandPaletteOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeItem ? `${listboxId}-${activeItem.id}` : undefined}
            aria-label="Search pages or type > for commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages, DBML tables, tags, or type > for commands..."
            className="flex-1 bg-transparent text-[13.5px] text-ink-primary placeholder:text-ink-muted focus:outline-none"
          />
          <Kbd>Esc</Kbd>
          <button
            type="button"
            onClick={() => closePalette(false)}
            aria-label="Close command palette"
            className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary transition-colors"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Listbox: Quick Actions + FTS5 Search Results */}
        <div
          id={listboxId}
          role="listbox"
          aria-label="Commands and search results"
          className="max-h-[66vh] overflow-y-auto"
        >
          {/* Quick Workbench Commands */}
          <div className="p-3 bg-surface-chrome/40 border-b border-border-subtle">
            <div className="px-1 pb-2 text-[11px] font-medium text-ink-muted flex items-center justify-between">
              <span>
                {isCommandMode
                  ? `Commands (${filteredActions.length})`
                  : `Quick actions (${filteredActions.length})`}
              </span>
              {!isCommandMode && (
                <span className="text-[10.5px] font-mono">Tip: prefix &gt; for commands only</span>
              )}
            </div>

            {filteredActions.length === 0 ? (
              <div className="py-4 text-center text-xs text-ink-muted">
                No commands match <span className="font-mono text-accent-amber">&quot;{cleanQuery}&quot;</span>.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {filteredActions.map((action) => {
                  const itemId = `action:${action.id}`
                  const flatIdx = indexById.get(itemId) ?? -1
                  const isSelected = flatIdx === activeIndex
                  return (
                    <button
                      key={action.id}
                      id={`${listboxId}-${itemId}`}
                      ref={(el) => {
                        optionRefs.current[itemId] = el
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                      onClick={() =>
                        executeItem({ kind: 'action', id: itemId, action })
                      }
                      className={cn(
                        'px-2.5 py-2 rounded-[8px] border text-xs text-ink-primary flex items-center justify-between gap-2 transition-colors text-left',
                        isSelected
                          ? 'bg-surface-hover border-accent-cobalt/60 ring-1 ring-accent-cobalt/50'
                          : 'bg-surface-elevated hover:bg-surface-hover border-border-hairline'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {action.icon}
                        <span className="truncate">{action.label}</span>
                      </span>
                      {action.shortcut && (
                        <Kbd className="text-[9.5px] px-1 py-0">{action.shortcut}</Kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* FTS5 Full-Text Search Results */}
          {!isCommandMode && (
            <div className="p-2 space-y-0.5">
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-ink-muted flex items-center justify-between">
                <span className="tabular-nums">Search results ({results.length})</span>
                <span className="text-[10.5px]">Enter / Click to open · Alt+Enter for split</span>
              </div>

              {results.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-secondary">
                  No pages or schemas match{' '}
                  <span className="font-mono text-accent-amber">&quot;{query}&quot;</span>.
                </div>
              ) : (
                results.map((item) => {
                  const marker = MARKER_META[item.sectionColor || 'cobalt']
                  const itemId = `page:${item.pageId}`
                  const flatIdx = indexById.get(itemId) ?? -1
                  const isSelected = flatIdx === activeIndex

                  return (
                    <div
                      key={item.pageId}
                      id={`${listboxId}-${itemId}`}
                      ref={(el) => {
                        optionRefs.current[itemId] = el
                      }}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                      onClick={(e) =>
                        executeItem({ kind: 'page', id: itemId, result: item }, e.altKey)
                      }
                      className={cn(
                        'px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors flex items-start justify-between gap-3',
                        isSelected
                          ? 'bg-surface-hover ring-1 ring-accent-cobalt/50'
                          : 'hover:bg-surface-hover'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-[3px] shrink-0 ${marker.dotBg}`} />
                          <span className="text-xs">{item.icon}</span>
                          <span className="font-medium text-[13px] text-ink-primary truncate">
                            {item.title}
                          </span>
                          <Badge
                            tone={item.sectionColor || 'cobalt'}
                            className="font-mono text-[10px]"
                          >
                            {item.pageCode}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11.5px] text-ink-secondary line-clamp-1">
                          {item.snippet}
                        </p>
                      </div>

                      <div className="text-right shrink-0 text-[11px] text-ink-muted">
                        <div>{item.notebookName}</div>
                        <div className={marker.text}>{item.sectionName}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
