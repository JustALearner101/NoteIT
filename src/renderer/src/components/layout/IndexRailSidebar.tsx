import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Columns2,
  Database,
  FilePlus,
  FolderPlus,
  GanttChart,
  Hash,
  LayoutGrid,
  Plus,
  Star,
  Trash2
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_COLORS, MARKER_META } from '@renderer/lib/marker-colors'
import type { MarkerColor, Page } from '@shared/types/domain'

export const IndexRailSidebar: React.FC = () => {
  const {
    notebooks,
    sections,
    pages,
    tags,
    activeNotebookId,
    activePageId,
    selectedTagFilter,
    setActiveNotebook,
    openPageInTab,
    setSelectedTagFilter,
    createNotebook,
    createSection,
    createPage,
    deletePage
  } = useWorkspaceStore()

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [isNotebookMenuOpen, setIsNotebookMenuOpen] = useState(false)
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
    setIsNotebookMenuOpen(false)
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
      blank: 'Spesifikasi Dokumen Baru',
      dbml: 'Skema DBML Baru',
      roadmap: 'Roadmap & Gantt Baru',
      canvas: 'Kanvas Spasial Baru'
    }
    await createPage({
      sectionId,
      parentPageId,
      title: defaultTitles[template],
      template
    })
    setQuickCreateSectionId(null)
  }

  const renderPageItem = (page: Page, isSubpage = false): React.ReactNode => {
    const isActive = page.id === activePageId
    const childPages = pages.filter((p) => p.parentPageId === page.id)

    return (
      <div key={page.id} className="select-none">
        <div
          onClick={(e) => openPageInTab(page.id, e.altKey)}
          className={`group flex items-center justify-between px-2 py-1.5 rounded-[5px] text-[13px] cursor-pointer transition-colors ${
            isSubpage ? 'ml-4 border-l border-border-hairline pl-2.5' : ''
          } ${
            isActive
              ? 'bg-surface-hover text-ink-primary font-medium'
              : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs shrink-0">{page.icon}</span>
            <span className="truncate">{page.title}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="font-mono text-[10px] text-ink-muted group-hover:hidden">
              {page.code}
            </span>
            <div className="hidden group-hover:flex items-center gap-0.5">
              {!isSubpage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleQuickCreatePage(page.sectionId, 'blank', page.id)
                  }}
                  title="Buat Sub-halaman"
                  className="p-0.5 rounded hover:bg-surface-elevated text-ink-muted hover:text-ink-primary"
                >
                  <Plus size={12} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openPageInTab(page.id, true)
                }}
                title="Buka di Split-Pane Kanan (Alt+Klik)"
                className="p-0.5 rounded hover:bg-surface-elevated text-ink-muted hover:text-accent-cobalt"
              >
                <Columns2 size={12} />
              </button>
              {pages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deletePage(page.id)
                  }}
                  title="Hapus Halaman"
                  className="p-0.5 rounded hover:bg-surface-elevated text-ink-muted hover:text-[#EF4444]"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {childPages.length > 0 && (
          <div className="mt-0.5 space-y-0.5">
            {childPages.map((sub) => renderPageItem(sub, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="w-[256px] shrink-0 bg-surface-chrome border-r border-border-hairline flex flex-col h-full select-none">
      {/* Top: Notebook Switcher Pill */}
      <div className="p-2.5 border-b border-border-hairline relative">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] tracking-wider uppercase text-ink-muted">
            ACTIVE NOTEBOOK
          </span>
          <button
            onClick={() => setIsCreatingNotebook(!isCreatingNotebook)}
            className="font-mono text-[10px] text-accent-cobalt hover:underline flex items-center gap-0.5"
          >
            <Plus size={11} /> Baru
          </button>
        </div>

        <button
          onClick={() => setIsNotebookMenuOpen(!isNotebookMenuOpen)}
          className="w-full px-2.5 py-1.5 rounded-[6px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-1.5 h-4 rounded-full ${
                MARKER_META[activeNotebook?.color || 'cobalt'].bgStrip
              }`}
            />
            <span className="text-sm">{activeNotebook?.icon}</span>
            <span className="font-display font-semibold text-xs text-ink-primary truncate">
              {activeNotebook?.name}
            </span>
          </div>
          <ChevronDown size={14} className="text-ink-muted shrink-0" />
        </button>

        {/* Notebook Dropdown Switcher */}
        {isNotebookMenuOpen && (
          <div className="absolute left-2.5 right-2.5 top-[68px] z-30 bg-surface-elevated border border-border-hairline rounded-[6px] shadow-xl p-1 space-y-0.5">
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                onClick={() => {
                  setActiveNotebook(nb.id)
                  setIsNotebookMenuOpen(false)
                }}
                className={`w-full px-2 py-1.5 rounded text-left text-xs flex items-center justify-between ${
                  nb.id === activeNotebook?.id
                    ? 'bg-accent-cobalt/15 text-accent-cobalt font-medium'
                    : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className={`w-1.5 h-3 rounded-full ${MARKER_META[nb.color].bgStrip}`} />
                  <span>{nb.icon}</span>
                  <span className="truncate">{nb.name}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Inline New Notebook Form */}
        {isCreatingNotebook && (
          <form
            onSubmit={handleCreateNotebookSubmit}
            className="mt-2 p-2 rounded-[6px] bg-surface-elevated border border-border-hairline space-y-2"
          >
            <input
              type="text"
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
              placeholder="Nama Notebook..."
              autoFocus
              className="w-full px-2 py-1 text-xs rounded bg-surface-chrome border border-border-hairline text-ink-primary focus:outline-none focus:border-accent-cobalt"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {MARKER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewNotebookColor(c)}
                    className={`w-3.5 h-3.5 rounded-full ${MARKER_META[c].bgStrip} ${
                      newNotebookColor === c ? 'ring-2 ring-white' : 'opacity-60'
                    }`}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-accent-cobalt text-white font-mono text-[10px]"
              >
                Buat Notebook
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Scrollable Hierarchy Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4">
        {/* Pinned / Favorites */}
        {favoritePages.length > 0 && (
          <div>
            <div className="px-2 mb-1 flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase text-ink-muted">
              <Star size={11} className="text-accent-amber" />
              <span>FAVORITES</span>
            </div>
            <div className="space-y-0.5">
              {favoritePages.map((fav) => (
                <div
                  key={`fav-${fav.id}`}
                  onClick={(e) => openPageInTab(fav.id, e.altKey)}
                  className={`flex items-center justify-between px-2 py-1 rounded-[5px] text-xs cursor-pointer transition-colors ${
                    fav.id === activePageId
                      ? 'bg-surface-hover text-ink-primary font-medium'
                      : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span>{fav.icon}</span>
                    <span className="truncate">{fav.title}</span>
                  </span>
                  <span className="font-mono text-[10px] text-ink-muted">{fav.code}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sections with 3px Vertical Drafting Marker Strip */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider uppercase text-ink-muted">
              SECTIONS ({currentSections.length})
            </span>
            <button
              onClick={() => setIsCreatingSection(!isCreatingSection)}
              title="Tambah Section Baru"
              className="text-ink-muted hover:text-accent-cobalt transition-colors flex items-center gap-1 font-mono text-[10px]"
            >
              <FolderPlus size={12} />
              <span>+SEC</span>
            </button>
          </div>

          {isCreatingSection && (
            <form
              onSubmit={handleCreateSectionSubmit}
              className="mb-2 p-2 rounded-[6px] bg-surface-elevated border border-border-hairline space-y-2"
            >
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Nama Section..."
                autoFocus
                className="w-full px-2 py-1 text-xs rounded bg-surface-chrome border border-border-hairline text-ink-primary focus:outline-none focus:border-accent-cobalt"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {MARKER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewSectionColor(c)}
                      className={`w-3.5 h-3.5 rounded-full ${MARKER_META[c].bgStrip} ${
                        newSectionColor === c ? 'ring-2 ring-white' : 'opacity-60'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  className="px-2 py-0.5 rounded bg-accent-cobalt text-white font-mono text-[10px]"
                >
                  Simpan Section
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
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
                <div key={sec.id} className="rounded-[6px] bg-surface-elevated/40 border border-border-subtle overflow-hidden">
                  {/* Section Header with 3px Drafting Marker Bar */}
                  <div className="flex items-center justify-between pr-1.5 py-1.5 bg-surface-elevated/80 border-b border-border-subtle">
                    <button
                      onClick={() => toggleSectionCollapse(sec.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <span className={`w-[3px] h-4 rounded-r ${marker.bgStrip} shrink-0`} />
                      {isCollapsed ? (
                        <ChevronRight size={13} className="text-ink-muted shrink-0" />
                      ) : (
                        <ChevronDown size={13} className="text-ink-muted shrink-0" />
                      )}
                      <span className="font-display font-semibold text-xs text-ink-primary truncate">
                        {sec.name}
                      </span>
                      <span className="font-mono text-[10px] text-ink-muted shrink-0">
                        {sec.code}
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        setQuickCreateSectionId(quickCreateSectionId === sec.id ? null : sec.id)
                      }
                      title="Buat Halaman di Section ini"
                      className="p-1 rounded hover:bg-surface-hover text-ink-secondary hover:text-accent-cobalt transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* Quick Template Bar inside Section */}
                  {quickCreateSectionId === sec.id && (
                    <div className="p-1.5 bg-surface-chrome border-b border-border-hairline grid grid-cols-2 gap-1">
                      <button
                        onClick={() => handleQuickCreatePage(sec.id, 'blank')}
                        className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-[11px] text-ink-primary flex items-center gap-1.5"
                      >
                        <FilePlus size={11} className="text-accent-cobalt" />
                        <span>Dokumen Blok</span>
                      </button>
                      <button
                        onClick={() => handleQuickCreatePage(sec.id, 'dbml')}
                        className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-[11px] text-ink-primary flex items-center gap-1.5"
                      >
                        <Database size={11} className="text-accent-amber" />
                        <span>Skema DBML</span>
                      </button>
                      <button
                        onClick={() => handleQuickCreatePage(sec.id, 'roadmap')}
                        className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-[11px] text-ink-primary flex items-center gap-1.5"
                      >
                        <GanttChart size={11} className="text-[#10B981]" />
                        <span>Gantt & Chart</span>
                      </button>
                      <button
                        onClick={() => handleQuickCreatePage(sec.id, 'canvas')}
                        className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-[11px] text-ink-primary flex items-center gap-1.5"
                      >
                        <LayoutGrid size={11} className="text-[#8B5CF6]" />
                        <span>Kanvas Spasial</span>
                      </button>
                    </div>
                  )}

                  {/* Pages inside Section */}
                  {!isCollapsed && (
                    <div className="p-1 space-y-0.5">
                      {rootPages.length === 0 ? (
                        <div className="px-2 py-2 text-[11px] text-ink-muted flex items-center justify-between">
                          <span>Section belum berisi halaman</span>
                          <button
                            onClick={() => handleQuickCreatePage(sec.id, 'blank')}
                            className="font-mono text-[10px] text-accent-cobalt hover:underline"
                          >
                            + Buat
                          </button>
                        </div>
                      ) : (
                        rootPages.map((pg) => renderPageItem(pg, false))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Global Tags Filter */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider uppercase text-ink-muted flex items-center gap-1">
              <Hash size={11} />
              <span>INDEXED TAGS</span>
            </span>
            {selectedTagFilter && (
              <button
                onClick={() => setSelectedTagFilter(null)}
                className="font-mono text-[10px] text-accent-amber hover:underline"
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
                  onClick={() => setSelectedTagFilter(t.name)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] border transition-colors flex items-center gap-1 ${
                    active
                      ? 'bg-accent-cobalt text-white border-accent-cobalt'
                      : 'bg-surface-elevated text-ink-secondary border-border-hairline hover:border-ink-muted'
                  }`}
                >
                  <span>#{t.name}</span>
                  <span className="text-[9px] opacity-70">{t.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}
