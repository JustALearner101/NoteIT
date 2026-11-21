import React, { useEffect, useState } from 'react'
import {
  CalendarDays,
  Columns2,
  Database,
  FileDown,
  FilePlus,
  FolderDown,
  GanttChart,
  Globe,
  HelpCircle,
  LayoutGrid,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sun,
  X
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { Badge, Kbd } from '@renderer/components/ui'
import type { SearchResultItem } from '@shared/types/domain'

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
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

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])

  useEffect(() => {
    if (!isCommandPaletteOpen) return
    let active = true
    window.noteitAPI.searchWorkspace(query).then((res) => {
      if (active) setResults(res)
    })
    return () => {
      active = false
    }
  }, [query, isCommandPaletteOpen])

  if (!isCommandPaletteOpen) return null

  const defaultSection =
    sections.find((s) => s.notebookId === activeNotebookId) || sections[0]

  const handleQuickCreate = async (
    template: 'blank' | 'dbml' | 'roadmap' | 'canvas'
  ): Promise<void> => {
    if (!defaultSection) return
    await createPage({
      sectionId: defaultSection.id,
      title:
        template === 'dbml'
          ? 'Spesifikasi Skema DBML'
          : template === 'roadmap'
            ? 'Master Gantt & Roadmap'
            : template === 'canvas'
              ? 'Kanvas Spasial Baru'
              : 'Dokumen Spesifikasi Baru',
      template
    })
    setCommandPaletteOpen(false)
  }

  const handleOpenDailyNote = async (): Promise<void> => {
    const page = await window.noteitAPI.openDailyNote()
    await loadWorkspace()
    openPageInTab(page.id)
    setCommandPaletteOpen(false)
  }

  const handleExportPage = async (): Promise<void> => {
    if (!activePageId) {
      showToast('Tidak ada halaman aktif untuk diekspor')
      return
    }

    const result = await window.noteitAPI.exportMarkdown({ scope: 'page', pageId: activePageId })
    setCommandPaletteOpen(false)
    showToast(
      result.saved && result.filePath
        ? `Markdown tersimpan: ${result.filePath}`
        : 'Ekspor halaman dibatalkan'
    )
  }

  const handleExportWorkspace = async (): Promise<void> => {
    const result = await window.noteitAPI.exportMarkdown({ scope: 'workspace' })
    setCommandPaletteOpen(false)
    showToast(
      result.saved && result.filePath
        ? `${result.fileCount ?? 0} halaman diekspor ke ${result.filePath}`
        : 'Ekspor workspace dibatalkan'
    )
  }

  return (
    <div
      onClick={() => setCommandPaletteOpen(false)}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[3px] flex items-start justify-center pt-20 px-4 select-none"
    >
      <div
        data-command-palette
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-[12px] bg-surface-elevated border border-border-hairline shadow-popover overflow-hidden animate-popover-enter"
      >
        {/* Top Search Input */}
        <div className="px-4 py-3 bg-surface-chrome/90 border-b border-border-hairline flex items-center gap-3">
          <Search size={15} className="text-accent-cobalt shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari di SQLite FTS5 (judul halaman, isi catatan, nama tabel DBML, atau tag)..."
            autoFocus
            className="flex-1 bg-transparent text-[13.5px] text-ink-primary placeholder:text-ink-muted focus:outline-none"
          />
          <Kbd>Esc</Kbd>
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Quick Workbench Commands */}
        <div className="p-3 bg-surface-chrome/40 border-b border-border-subtle">
          <div className="px-1 pb-2 text-[11px] font-medium text-ink-muted">
            Quick actions
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickCreate('blank')}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <FilePlus size={13} className="text-accent-cobalt shrink-0" />
              <span className="truncate">Buat Dokumen Blok</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickCreate('dbml')}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <Database size={13} className="text-accent-amber shrink-0" />
              <span className="truncate">Buat Studio DBML</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickCreate('roadmap')}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <GanttChart size={13} className="text-accent-teal shrink-0" />
              <span className="truncate">Buat Gantt Chart</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickCreate('canvas')}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <LayoutGrid size={13} className="text-accent-violet shrink-0" />
              <span className="truncate">Buat Kanvas Spasial</span>
            </button>
            <button
              type="button"
              onClick={handleOpenDailyNote}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <CalendarDays size={13} className="text-accent-teal shrink-0" />
              <span className="truncate">Daily note hari ini</span>
            </button>
            <button
              type="button"
              onClick={() => {
                toggleSplitPane()
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <Columns2 size={13} className="text-accent-cobalt shrink-0" />
              <span className="truncate">Toggle Split-Pane</span>
            </button>
            <button
              type="button"
              onClick={() => {
                toggleTheme()
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun size={13} className="text-accent-amber shrink-0" />
              ) : (
                <Moon size={13} className="text-accent-cobalt shrink-0" />
              )}
              <span className="truncate">Ganti Tema ({theme === 'dark' ? 'Light' : 'Dark'})</span>
            </button>
            <button
              type="button"
              onClick={handleExportPage}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <FileDown size={13} className="text-accent-amber shrink-0" />
              <span className="truncate">Export halaman (.md)</span>
            </button>
            <button
              type="button"
              onClick={handleExportWorkspace}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <FolderDown size={13} className="text-accent-teal shrink-0" />
              <span className="truncate">Export workspace (.md)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMainView('ai-chat')
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <MessageSquare size={13} className="text-accent-cobalt shrink-0" />
              <span className="truncate">Buka AI Assistant</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMainView('browser')
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <Globe size={13} className="text-accent-teal shrink-0" />
              <span className="truncate">Buka Reference Web</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMainView('settings', 'appearance')
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <Settings size={13} className="text-accent-amber shrink-0" />
              <span className="truncate">Settings &amp; Theme Studio</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void openHelpCenter()
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-2 rounded-[8px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2 transition-colors"
            >
              <HelpCircle size={13} className="text-accent-violet shrink-0" />
              <span className="truncate">Help Center (?)</span>
            </button>
          </div>
        </div>

        {/* FTS5 Full-Text Search Results */}
        <div className="p-2 max-h-80 overflow-y-auto space-y-0.5">
          <div className="px-2.5 py-1.5 text-[11px] font-medium text-ink-muted flex items-center justify-between">
            <span className="tabular-nums">Search results ({results.length})</span>
            <span className="text-[10.5px]">Click to open · Alt+Click for split</span>
          </div>

          {results.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-secondary">
              Tidak ditemukan halaman atau skema yang cocok dengan kueri{' '}
              <span className="font-mono text-accent-amber">&quot;{query}&quot;</span>.
            </div>
          ) : (
            results.map((item) => {
              const marker = MARKER_META[item.sectionColor || 'cobalt']
              return (
                <div
                  key={item.pageId}
                  onClick={(e) => {
                    openPageInTab(item.pageId, e.altKey)
                    setCommandPaletteOpen(false)
                  }}
                  className="px-3 py-2.5 rounded-[8px] hover:bg-surface-hover cursor-pointer transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-[3px] shrink-0 ${marker.dotBg}`} />
                      <span className="text-xs">{item.icon}</span>
                      <span className="font-medium text-[13px] text-ink-primary truncate">
                        {item.title}
                      </span>
                      <Badge tone={item.sectionColor || 'cobalt'} className="font-mono text-[10px]">
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
      </div>
    </div>
  )
}
