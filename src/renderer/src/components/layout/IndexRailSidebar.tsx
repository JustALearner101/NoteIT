import React, { useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Columns2,
  Database,
  FilePlus,
  FileText,
  FolderPlus,
  GanttChart,
  Globe,
  GraduationCap,
  Hash,
  HelpCircle,
  LayoutGrid,
  MessageSquare,
  PanelLeftOpen,
  Plus,
  Radio,
  Search,
  Settings,
  Star,
  Trash2
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { useAgentStore } from '@renderer/stores/useAgentStore'
import { MARKER_COLORS, MARKER_META } from '@renderer/lib/marker-colors'
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
import type { MarkerColor, Page } from '@shared/types/domain'

interface IndexRailSidebarProps {
  collapsed?: boolean
}

export const IndexRailSidebar: React.FC<IndexRailSidebarProps> = ({ collapsed = false }) => {
  const {
    notebooks,
    sections,
    pages,
    tags,
    activeNotebookId,
    activePageId,
    activeMainView,
    selectedTagFilter,
    setActiveNotebook,
    openPageInTab,
    setSelectedTagFilter,
    setActiveMainView,
    setCommandPaletteOpen,
    toggleSidebar,
    openHelpCenter,
    createNotebook,
    createSection,
    createPage,
    deletePage
  } = useWorkspaceStore()

  const { sessions } = useAgentStore()
  const activeMissionCount = sessions.filter((s) =>
    ['thinking', 'running_tests', 'waiting_approval', 'idle'].includes(s.status)
  ).length
  const waitingApprovalCount = sessions.filter((s) => s.status === 'waiting_approval').length

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [newNotebookColor, setNewNotebookColor] = useState<MarkerColor>('cobalt')

  const [isCreatingSection, setIsCreatingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionColor, setNewSectionColor] = useState<MarkerColor>('teal')

  const [quickCreateSectionId, setQuickCreateSectionId] = useState<string | null>(null)

  const activeNotebook = notebooks.find((n) => n.id === activeNotebookId) || notebooks[0]
  const currentSections = sections.filter((s) => s.notebookId === activeNotebook?.id)
  const favoritePages = pages.filter((p) => p.isFavorite)
  const notebookPageCount = pages.filter((p) =>
    currentSections.some((s) => s.id === p.sectionId)
  ).length

  const toggleSectionCollapse = (secId: string): void => {
    setCollapsedSections((prev) => ({ ...prev, [secId]: !prev[secId] }))
  }

  const handleCreateNotebookSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newNotebookName.trim()) return
    await createNotebook({
      name: newNotebookName,
      icon: '📐',
      color: newNotebookColor
    })
    setNewNotebookName('')
    setIsCreatingNotebook(false)
  }

  const handleCreateSectionSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newSectionName.trim() || !activeNotebook) return
    await createSection({
      notebookId: activeNotebook.id,
      name: newSectionName,
      color: newSectionColor
    })
    setNewSectionName('')
    setIsCreatingSection(false)
  }

  const handleQuickCreatePage = async (
    sectionId: string,
    template: 'blank' | 'dbml' | 'roadmap' | 'canvas',
    parentPageId: string | null = null
  ): Promise<void> => {
    const defaultTitles: Record<typeof template, string> = {
      blank: 'New Specification',
      dbml: 'New DBML Schema',
      roadmap: 'New Roadmap & Gantt',
      canvas: 'New Spatial Canvas'
    }
    await createPage({
      sectionId,
      parentPageId,
      title: defaultTitles[template],
      template
    })
    setQuickCreateSectionId(null)
  }

  // Collapsed 48px Icon-Only Rail
  if (collapsed) {
    return (
      <aside
        aria-label="Collapsed workspace navigation"
        className="w-[48px] shrink-0 bg-surface-chrome border-r border-border-hairline flex flex-col items-center justify-between py-2.5 select-none"
      >
        <div className="flex flex-col items-center gap-1.5">
          {/* Active Notebook Emblem */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={`${activeNotebook?.name || 'Workspace'} — Expand sidebar (Ctrl+\\)`}
            aria-label="Expand Sidebar"
            aria-expanded={!collapsed}
            className="w-8 h-8 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-sm mb-1 transition-colors"
          >
            <span aria-hidden="true">{activeNotebook?.icon || '📐'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            title="Search & Command Palette (Ctrl+K)"
            aria-label="Search"
            className="w-8 h-8 rounded-[7px] text-ink-secondary hover:text-ink-primary hover:bg-surface-hover flex items-center justify-center transition-colors"
          >
            <Search size={15} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setActiveMainView('workbench')}
            title="Workbench & Documents"
            aria-label="Workbench"
            aria-current={activeMainView === 'workbench' ? 'page' : undefined}
            className={cn(
              'w-8 h-8 rounded-[7px] flex items-center justify-center transition-colors',
              activeMainView === 'workbench'
                ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border border-[var(--pill-cobalt-border)]'
                : 'text-[var(--marker-cobalt)] hover:bg-surface-hover'
            )}
          >
            <FileText size={15} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveMainView(activeMainView === 'ai-chat' ? 'workbench' : 'ai-chat')
            }
            title="AI Studio · Chat, Active Learn & Knowledge Graph (Ctrl+Shift+C)"
            aria-label="AI Studio"
            aria-current={activeMainView === 'ai-chat' ? 'page' : undefined}
            className={cn(
              'w-8 h-8 rounded-[7px] flex items-center justify-center transition-colors',
              activeMainView === 'ai-chat'
                ? 'bg-[var(--pill-violet-bg)] text-[var(--pill-violet-text)] border border-[var(--pill-violet-border)]'
                : 'text-[var(--marker-violet)] hover:bg-surface-hover'
            )}
          >
            <MessageSquare size={15} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveMainView(activeMainView === 'agent-board' ? 'workbench' : 'agent-board')
            }
            title="Agent Mission Control (Ctrl+Shift+A)"
            aria-label="Agent Mission Control"
            aria-current={activeMainView === 'agent-board' ? 'page' : undefined}
            className={cn(
              'relative w-8 h-8 rounded-[7px] flex items-center justify-center transition-colors',
              activeMainView === 'agent-board'
                ? 'bg-[var(--pill-amber-bg)] text-[var(--pill-amber-text)] border border-[var(--pill-amber-border)]'
                : activeMissionCount > 0
                  ? 'text-accent-emerald hover:bg-surface-hover'
                  : 'text-[var(--marker-amber)] hover:bg-surface-hover'
            )}
          >
            <Radio size={15} aria-hidden="true" />
            {activeMissionCount > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full',
                  waitingApprovalCount > 0 ? 'bg-accent-amber animate-ping' : 'bg-accent-emerald'
                )}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveMainView(activeMainView === 'browser' ? 'workbench' : 'browser')
            }
            title="In-App Browser (Ctrl+Shift+B)"
            aria-label="Browser"
            aria-current={activeMainView === 'browser' ? 'page' : undefined}
            className={cn(
              'w-8 h-8 rounded-[7px] flex items-center justify-center transition-colors',
              activeMainView === 'browser'
                ? 'bg-[var(--pill-teal-bg)] text-accent-emerald border border-[var(--pill-teal-border)]'
                : 'text-accent-emerald hover:bg-surface-hover'
            )}
          >
            <Globe size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveMainView('settings')}
            title="Settings (Ctrl+,)"
            aria-label="Settings"
            className="w-8 h-8 rounded-[7px] text-ink-secondary hover:text-ink-primary hover:bg-surface-hover flex items-center justify-center transition-colors"
          >
            <Settings size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void openHelpCenter()}
            title="Help Center"
            aria-label="Help Center"
            className="w-8 h-8 rounded-[7px] text-ink-secondary hover:text-ink-primary hover:bg-surface-hover flex items-center justify-center transition-colors"
          >
            <HelpCircle size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand Sidebar (Ctrl+\)"
            aria-label="Expand Sidebar"
            aria-expanded={!collapsed}
            className="w-8 h-8 rounded-[7px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover flex items-center justify-center transition-colors"
          >
            <PanelLeftOpen size={14} aria-hidden="true" />
          </button>
        </div>
      </aside>
    )
  }

  const renderPageItem = (page: Page, isSubpage = false): React.ReactNode => {
    const isActive = page.id === activePageId && activeMainView === 'workbench'
    const childPages = pages.filter((p) => p.parentPageId === page.id)

    return (
      <li key={page.id} className="select-none">
        <div
          className={cn(
            'group flex items-center justify-between rounded-[7px] text-[12.5px] transition-colors',
            isSubpage && 'ml-3.5 border-l border-border-hairline pl-1 rounded-l-none',
            isActive
              ? 'bg-surface-hover text-ink-primary font-medium'
              : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              setActiveMainView('workbench')
              openPageInTab(page.id, e.altKey)
            }}
            aria-current={isActive ? 'page' : undefined}
            className="flex items-center gap-2 min-w-0 flex-1 text-left px-2 py-[6px] rounded-l-[7px]"
          >
            <span className="text-[12px] shrink-0 opacity-90" aria-hidden="true">
              {page.icon}
            </span>
            <span className="truncate">{page.title}</span>
          </button>

          <div className="flex items-center gap-1 shrink-0 pr-1.5 ml-1">
            <span className="font-mono text-[10px] text-ink-muted tabular-nums group-hover:hidden group-focus-within:hidden">
              {page.code}
            </span>
            <div className="hidden group-hover:flex group-focus-within:flex items-center gap-0.5">
              {!isSubpage && (
                <button
                  type="button"
                  onClick={() => void handleQuickCreatePage(page.sectionId, 'blank', page.id)}
                  title="Create subpage"
                  aria-label={`Create subpage under ${page.title}`}
                  className="p-0.5 rounded-[5px] hover:bg-surface-elevated text-ink-muted hover:text-ink-primary"
                >
                  <Plus size={12} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => openPageInTab(page.id, true)}
                title="Open in right split pane (Alt+Click)"
                aria-label={`Open ${page.title} in split pane`}
                className="p-0.5 rounded-[5px] hover:bg-surface-elevated text-ink-muted hover:text-accent-cobalt"
              >
                <Columns2 size={12} aria-hidden="true" />
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={() => void deletePage(page.id)}
                  title="Delete page"
                  aria-label={`Delete ${page.title}`}
                  className="p-0.5 rounded-[5px] hover:bg-surface-elevated text-ink-muted hover:text-accent-rose"
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {childPages.length > 0 && (
          <ul className="mt-0.5 space-y-0.5">
            {childPages.map((sub) => renderPageItem(sub, true))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <aside
      aria-label="Workspace navigation"
      className="w-[240px] shrink-0 bg-surface-chrome border-r border-border-hairline flex flex-col h-full select-none"
    >
      {/* Top: Studio Workspace Switcher Card */}
      <div className="p-2.5 pb-2 space-y-2 relative">
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Switch notebook (current: ${activeNotebook?.name || 'Workspace'})`}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-[8px] hover:bg-surface-hover/80 flex items-center justify-between gap-2 transition-colors text-left data-[state=open]:bg-surface-hover/80"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-[7px] bg-surface-elevated border border-border-hairline flex items-center justify-center text-sm shrink-0 relative">
                    <span aria-hidden="true">{activeNotebook?.icon || '📐'}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-surface-chrome',
                        MARKER_META[activeNotebook?.color || 'cobalt'].dotBg
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-[13px] leading-tight text-ink-primary truncate">
                      {activeNotebook?.name || 'Workspace'}
                    </div>
                    <div className="text-[11px] text-ink-muted truncate tabular-nums">
                      {currentSections.length} sections · {notebookPageCount} pages
                    </div>
                  </div>
                </div>
                <ChevronsUpDown size={13} className="text-ink-muted shrink-0" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" sideOffset={6} className="w-[220px]">
              <DropdownMenuLabel>Workspaces &amp; Notebooks</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notebooks.map((nb) => {
                const isSelected = nb.id === activeNotebook?.id
                return (
                  <DropdownMenuItem
                    key={nb.id}
                    onSelect={() => setActiveNotebook(nb.id)}
                    className={
                      isSelected ? 'bg-surface-hover text-ink-primary font-medium' : undefined
                    }
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        aria-hidden="true"
                        className={cn('w-2 h-2 rounded-[3px] shrink-0', MARKER_META[nb.color].dotBg)}
                      />
                      <span aria-hidden="true">{nb.icon}</span>
                      <span className="truncate">{nb.name}</span>
                    </span>
                    {isSelected && (
                      <Check size={12} className="text-accent-cobalt shrink-0" aria-hidden="true" />
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => setIsCreatingNotebook(!isCreatingNotebook)}
            title="Create new notebook"
            aria-label="Create new notebook"
            aria-expanded={isCreatingNotebook}
            className="w-7 h-7 rounded-[7px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover flex items-center justify-center transition-colors shrink-0"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Embedded Quick Search Trigger */}
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette and search"
          className="w-full h-8 px-2.5 rounded-[8px] bg-surface-elevated/80 hover:bg-surface-hover border border-border-hairline flex items-center justify-between text-xs text-ink-muted hover:text-ink-secondary transition-colors"
        >
          <span className="flex items-center gap-2">
            <Search size={13} className="text-ink-muted" aria-hidden="true" />
            <span>Search</span>
          </span>
          <Kbd>Ctrl K</Kbd>
        </button>

        {/* Inline New Notebook Form */}
        {isCreatingNotebook && (
          <form
            onSubmit={handleCreateNotebookSubmit}
            className="p-2.5 rounded-[9px] bg-surface-elevated border border-border-hairline space-y-2 animate-popover-enter"
          >
            <input
              type="text"
              aria-label="New notebook name"
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
              placeholder="Notebook name..."
              autoFocus
              className="w-full h-7 px-2 text-xs rounded-[6px] bg-surface-chrome border border-border-hairline text-ink-primary placeholder:text-ink-muted focus:border-accent-cobalt"
            />
            <div className="flex items-center justify-between">
              <div role="group" aria-label="Notebook marker color" className="flex items-center gap-1.5">
                {MARKER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Select ${MARKER_META[c].label} color`}
                    aria-pressed={newNotebookColor === c}
                    onClick={() => setNewNotebookColor(c)}
                    className={cn(
                      'w-3.5 h-3.5 rounded-full transition-transform',
                      MARKER_META[c].dotBg,
                      newNotebookColor === c
                        ? 'ring-2 ring-ink-primary scale-110'
                        : 'opacity-55 hover:opacity-100'
                    )}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="h-6 px-2.5 rounded-[6px] btn-primary-sheen text-[11px] font-medium"
              >
                Create
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Scrollable Hierarchy Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-4">
        {/* Primary Workspace Navigation */}
        <nav aria-label="Primary views" className="space-y-0.5">
          <button
            type="button"
            onClick={() => setActiveMainView('workbench')}
            aria-current={activeMainView === 'workbench' ? 'page' : undefined}
            className={cn(
              'w-full px-2 py-[6px] rounded-[7px] text-[12.5px] flex items-center justify-between transition-colors',
              activeMainView === 'workbench'
                ? 'bg-surface-hover text-ink-primary font-medium'
                : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
            )}
          >
            <span className="flex items-center gap-2.5">
              <FileText size={14} className="text-[var(--marker-cobalt)]" aria-hidden="true" />
              <span>Notes &amp; Specs</span>
            </span>
            <span className="px-1.5 py-[1px] rounded-[5px] bg-surface-elevated border border-border-subtle font-mono text-[10px] text-ink-muted tabular-nums">
              {pages.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveMainView(activeMainView === 'agent-board' ? 'workbench' : 'agent-board')
            }
            aria-current={activeMainView === 'agent-board' ? 'page' : undefined}
            className={cn(
              'w-full px-2 py-[6px] rounded-[7px] text-[12.5px] flex items-center justify-between transition-colors',
              activeMainView === 'agent-board'
                ? 'bg-surface-hover text-ink-primary font-medium'
                : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
            )}
          >
            <span className="flex items-center gap-2.5">
              <Radio
                size={14}
                aria-hidden="true"
                className={activeMissionCount > 0 ? 'text-accent-emerald' : 'text-[var(--marker-amber)]'}
              />
              <span>Mission Control</span>
            </span>
            {activeMissionCount > 0 ? (
              <span
                className={cn(
                  'px-1.5 py-[1px] rounded-[5px] font-mono text-[10px] tabular-nums border',
                  waitingApprovalCount > 0
                    ? 'bg-[var(--pill-amber-bg)] text-[var(--pill-amber-text)] border-[var(--pill-amber-border)]'
                    : 'bg-[var(--pill-teal-bg)] text-[var(--pill-teal-text)] border-[var(--pill-teal-border)]'
                )}
              >
                {activeMissionCount}
              </span>
            ) : (
              <span className="px-1.5 py-[1px] rounded-[5px] bg-surface-elevated border border-border-subtle font-mono text-[10px] text-ink-muted tabular-nums">
                {sessions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveMainView(activeMainView === 'ai-chat' ? 'workbench' : 'ai-chat')
            }
            aria-current={activeMainView === 'ai-chat' ? 'page' : undefined}
            className={cn(
              'w-full px-2 py-[6px] rounded-[7px] text-[12.5px] flex items-center justify-between transition-colors',
              activeMainView === 'ai-chat'
                ? 'bg-surface-hover text-ink-primary font-medium'
                : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
            )}
          >
            <span className="flex items-center gap-2.5">
              <MessageSquare size={14} className="text-[var(--marker-violet)]" aria-hidden="true" />
              <span>AI Studio</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveMainView(activeMainView === 'browser' ? 'workbench' : 'browser')
            }
            aria-current={activeMainView === 'browser' ? 'page' : undefined}
            className={cn(
              'w-full px-2 py-[6px] rounded-[7px] text-[12.5px] flex items-center justify-between transition-colors',
              activeMainView === 'browser'
                ? 'bg-surface-hover text-ink-primary font-medium'
                : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
            )}
          >
            <span className="flex items-center gap-2.5">
              <Globe size={14} className="text-accent-emerald" aria-hidden="true" />
              <span>Reference Web</span>
            </span>
          </button>
        </nav>

        {/* Favorites / Shortcuts */}
        {favoritePages.length > 0 && (
          <div>
            <div className="px-2 mb-1 flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
              <Star size={11} className="text-accent-amber" aria-hidden="true" />
              <span>Favorites</span>
            </div>
            <ul aria-label="Favorite pages" className="space-y-0.5">
              {favoritePages.map((fav) => {
                const isActive = fav.id === activePageId && activeMainView === 'workbench'
                return (
                  <li key={`fav-${fav.id}`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        setActiveMainView('workbench')
                        openPageInTab(fav.id, e.altKey)
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full text-left flex items-center justify-between px-2 py-[5px] rounded-[7px] text-[12.5px] transition-colors',
                        isActive
                          ? 'bg-surface-hover text-ink-primary font-medium'
                          : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs shrink-0" aria-hidden="true">
                          {fav.icon}
                        </span>
                        <span className="truncate">{fav.title}</span>
                      </span>
                      <span className="font-mono text-[10px] text-ink-muted tabular-nums whitespace-nowrap shrink-0 ml-1.5">
                        {fav.code}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Sections */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-ink-muted">Sections</span>
            <button
              type="button"
              onClick={() => setIsCreatingSection(!isCreatingSection)}
              title="Create new section"
              aria-label="Create new section"
              aria-expanded={isCreatingSection}
              className="text-ink-muted hover:text-ink-primary transition-colors p-0.5 rounded-[5px] hover:bg-surface-hover"
            >
              <FolderPlus size={13} aria-hidden="true" />
            </button>
          </div>

          {isCreatingSection && (
            <form
              onSubmit={handleCreateSectionSubmit}
              className="mb-2 p-2.5 rounded-[9px] bg-surface-elevated border border-border-hairline space-y-2 animate-popover-enter"
            >
              <input
                type="text"
                aria-label="New section name"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Section name..."
                autoFocus
                className="w-full h-7 px-2 text-xs rounded-[6px] bg-surface-chrome border border-border-hairline text-ink-primary placeholder:text-ink-muted focus:border-accent-cobalt"
              />
              <div className="flex items-center justify-between">
                <div role="group" aria-label="Section marker color" className="flex items-center gap-1.5">
                  {MARKER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Select ${MARKER_META[c].label} color`}
                      aria-pressed={newSectionColor === c}
                      onClick={() => setNewSectionColor(c)}
                      className={cn(
                        'w-3.5 h-3.5 rounded-full transition-transform',
                        MARKER_META[c].dotBg,
                        newSectionColor === c
                          ? 'ring-2 ring-ink-primary scale-110'
                          : 'opacity-55 hover:opacity-100'
                      )}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  className="h-6 px-2.5 rounded-[6px] btn-primary-sheen text-[11px] font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5">
            {currentSections.map((sec) => {
              const isCollapsed = Boolean(collapsedSections[sec.id])
              const rootPages = pages.filter(
                (p) =>
                  p.sectionId === sec.id &&
                  !p.parentPageId &&
                  (!selectedTagFilter || p.tags.includes(selectedTagFilter))
              )
              const marker = MARKER_META[sec.color]

              return (
                <div key={sec.id}>
                  {/* Section Header */}
                  <div className="group flex items-center justify-between px-1.5 py-1 rounded-[7px] hover:bg-surface-hover/50 transition-colors">
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      aria-controls={`section-pages-${sec.id}`}
                      onClick={() => toggleSectionCollapse(sec.id)}
                      className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                    >
                      {isCollapsed ? (
                        <ChevronRight size={12} className="text-ink-muted shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronDown size={12} className="text-ink-muted shrink-0" aria-hidden="true" />
                      )}
                      <span
                        aria-hidden="true"
                        className={cn('w-2 h-2 rounded-[3px] shrink-0', marker.dotBg)}
                      />
                      <span className="font-medium text-[12px] text-ink-primary truncate">
                        {sec.name}
                      </span>
                      <span className="font-mono text-[10px] text-ink-muted shrink-0 tabular-nums">
                        {rootPages.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setQuickCreateSectionId(quickCreateSectionId === sec.id ? null : sec.id)
                      }
                      title={`Create page in ${sec.name}`}
                      aria-label={`Create page in ${sec.name}`}
                      aria-expanded={quickCreateSectionId === sec.id}
                      className="p-0.5 rounded-[5px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary opacity-70 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
                    >
                      <Plus size={13} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Quick Template Bar inside Section */}
                  {quickCreateSectionId === sec.id && (
                    <div className="my-1.5 p-1.5 rounded-[8px] bg-surface-elevated border border-border-hairline grid grid-cols-2 gap-1 animate-popover-enter">
                      <button
                        type="button"
                        onClick={() => void handleQuickCreatePage(sec.id, 'blank')}
                        className="px-2 py-1.5 rounded-[6px] hover:bg-surface-hover text-[11px] text-ink-primary flex items-center gap-1.5 transition-colors"
                      >
                        <FilePlus size={11.5} className="text-accent-cobalt shrink-0" aria-hidden="true" />
                        <span className="truncate">Block Doc</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleQuickCreatePage(sec.id, 'dbml')}
                        className="px-2 py-1.5 rounded-[6px] hover:bg-surface-hover text-[11px] text-ink-primary flex items-center gap-1.5 transition-colors"
                      >
                        <Database size={11.5} className="text-accent-amber shrink-0" aria-hidden="true" />
                        <span className="truncate">DBML Schema</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleQuickCreatePage(sec.id, 'roadmap')}
                        className="px-2 py-1.5 rounded-[6px] hover:bg-surface-hover text-[11px] text-ink-primary flex items-center gap-1.5 transition-colors"
                      >
                        <GanttChart size={11.5} className="text-accent-teal shrink-0" aria-hidden="true" />
                        <span className="truncate">Roadmap</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleQuickCreatePage(sec.id, 'canvas')}
                        className="px-2 py-1.5 rounded-[6px] hover:bg-surface-hover text-[11px] text-ink-primary flex items-center gap-1.5 transition-colors"
                      >
                        <LayoutGrid size={11.5} className="text-accent-violet shrink-0" aria-hidden="true" />
                        <span className="truncate">Canvas</span>
                      </button>
                    </div>
                  )}

                  {/* Pages inside Section */}
                  {!isCollapsed && (
                    <ul
                      id={`section-pages-${sec.id}`}
                      aria-label={`${sec.name} pages`}
                      className="mt-0.5 pl-1.5 space-y-0.5"
                    >
                      {rootPages.length === 0 ? (
                        <li className="px-2 py-1.5 text-[11px] text-ink-muted flex items-center justify-between">
                          <span>No pages yet</span>
                          <button
                            type="button"
                            onClick={() => void handleQuickCreatePage(sec.id, 'blank')}
                            className="text-[11px] text-accent-cobalt hover:underline font-medium"
                          >
                            + Create
                          </button>
                        </li>
                      ) : (
                        rootPages.map((pg) => renderPageItem(pg, false))
                      )}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Global Tags Filter */}
        {tags.length > 0 && (
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-muted flex items-center gap-1">
                <Hash size={11} aria-hidden="true" />
                <span>Tags</span>
              </span>
              {selectedTagFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter(null)}
                  className="text-[11px] text-accent-amber hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="px-1.5 flex flex-wrap gap-1">
              {tags.map((t) => {
                const active = selectedTagFilter === t.name
                return (
                  <button
                    key={t.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedTagFilter(t.name)}
                    className={cn(
                      'px-2 py-[3px] rounded-[6px] text-[11px] border transition-colors inline-flex items-center gap-1 whitespace-nowrap',
                      active
                        ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)] font-medium'
                        : 'bg-surface-elevated/80 text-ink-secondary border-border-hairline hover:bg-surface-hover hover:text-ink-primary'
                    )}
                  >
                    <span>#{t.name}</span>
                    <span className="font-mono text-[9.5px] opacity-65 tabular-nums">{t.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pinned Quiet Footer Links */}
      <div className="p-2 border-t border-border-hairline space-y-0.5">
        <button
          type="button"
          onClick={() => setActiveMainView('settings')}
          title="Settings (Ctrl+,)"
          className="w-full px-2 py-1.5 rounded-[7px] text-[12px] text-ink-secondary hover:text-ink-primary hover:bg-surface-hover/70 flex items-center justify-between transition-colors group"
        >
          <span className="flex items-center gap-2">
            <Settings
              size={13.5}
              aria-hidden="true"
              className="text-ink-muted group-hover:text-ink-primary transition-transform duration-200 group-hover:rotate-45"
            />
            <span>Workspace settings</span>
          </span>
          <Kbd>Ctrl ,</Kbd>
        </button>

        <button
          type="button"
          onClick={() => void openHelpCenter()}
          title="Open NoteIT Help Center in Browser"
          className="w-full px-2 py-1.5 rounded-[7px] text-[12px] text-ink-secondary hover:text-ink-primary hover:bg-surface-hover/70 flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-2">
            <HelpCircle size={13.5} className="text-ink-muted" aria-hidden="true" />
            <span>Help &amp; docs</span>
          </span>
          <span className="font-mono text-[10px] text-ink-muted">SQLite WAL</span>
        </button>
      </div>
    </aside>
  )
}
