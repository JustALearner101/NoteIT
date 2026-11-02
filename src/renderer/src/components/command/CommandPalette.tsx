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
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-20 px-4 select-none"
    >
      <div
        data-command-palette
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-[8px] bg-surface-elevated border border-border-hairline shadow-2xl overflow-hidden animate-popover-enter"
      >
        {/* Top Search Input */}
        <div className="px-4 py-3 bg-surface-chrome border-b border-border-hairline flex items-center gap-3">
          <Search size={16} className="text-accent-cobalt shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari di SQLite FTS5 (judul halaman, isi catatan, nama tabel DBML, atau tag)..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-ink-primary focus:outline-none"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded hover:bg-surface-hover text-ink-muted hover:text-ink-primary"
          >
            <X size={14} />
          </button>
        </div>

        {/* Quick Workbench Commands */}
        <div className="p-2 bg-surface-chrome/40 border-b border-border-subtle">
          <div className="px-2 pb-1 font-mono text-[10px] text-ink-muted uppercase">
            PERINTAH CEPAT WORKBENCH
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            <button
              onClick={() => handleQuickCreate('blank')}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <FilePlus size={13} className="text-accent-cobalt" />
              <span>Buat Dokumen Blok</span>
            </button>
            <button
              onClick={() => handleQuickCreate('dbml')}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <Database size={13} className="text-accent-amber" />
              <span>Buat Studio DBML</span>
            </button>
            <button
              onClick={() => handleQuickCreate('roadmap')}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <GanttChart size={13} className="text-[#10B981]" />
              <span>Buat Gantt Chart</span>
            </button>
            <button
              onClick={() => handleQuickCreate('canvas')}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <LayoutGrid size={13} className="text-[#8B5CF6]" />
              <span>Buat Kanvas Spasial</span>
            </button>
            <button
              onClick={handleOpenDailyNote}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <CalendarDays size={13} className="text-[#10B981]" />
              <span>Buka daily note hari ini</span>
            </button>
            <button
              onClick={() => {
                toggleSplitPane()
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <Columns2 size={13} className="text-accent-cobalt" />
              <span>Toggle Split-Pane</span>
            </button>
            <button
              onClick={() => {
                toggleTheme()
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              {theme === 'dark' ? (
                <Sun size={13} className="text-accent-amber" />
              ) : (
                <Moon size={13} className="text-accent-cobalt" />
              )}
              <span>Ganti Tema ({theme === 'dark' ? 'Light' : 'Dark'})</span>
            </button>
            <button
              onClick={handleExportPage}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <FileDown size={13} className="text-accent-amber" />
              <span>Export halaman ini (Markdown)</span>
            </button>
            <button
              onClick={handleExportWorkspace}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <FolderDown size={13} className="text-[#10B981]" />
              <span>Export seluruh workspace (Markdown)</span>
            </button>
            <button
              onClick={() => {
                setActiveMainView('ai-chat')
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <MessageSquare size={13} className="text-accent-cobalt" />
              <span>Buka AI Chat (Free chat)</span>
            </button>
            <button
              onClick={() => {
                setActiveMainView('browser')
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <Globe size={13} className="text-[#10B981]" />
              <span>Buka In-App Browser</span>
            </button>
            <button
              onClick={() => {
                setActiveMainView('settings', 'appearance')
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <Settings size={13} className="text-accent-amber" />
              <span>Buka Settings &amp; Theme Studio</span>
            </button>
            <button
              onClick={() => {
                void openHelpCenter()
                setCommandPaletteOpen(false)
              }}
              className="px-2.5 py-1.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
            >
              <HelpCircle size={13} className="text-[#8B5CF6]" />
              <span>Buka Help Center HTML (?)</span>
            </button>
          </div>
        </div>

        {/* FTS5 Full-Text Search Results */}
        <div className="p-2 max-h-80 overflow-y-auto divide-y divide-border-subtle">
          <div className="px-2 pb-1.5 font-mono text-[10px] text-ink-muted uppercase flex items-center justify-between">
            <span>HASIL PENCARIAN SQLITE FTS5 ({results.length})</span>
            <span>KLIK UNTUK BUKA · ALT+KLIK UNTUK SPLIT-PANE</span>
          </div>

          {results.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-secondary">
              Tidak ditemukan halaman atau skema yang cocok dengan kueri{' '}
              <span className="font-mono text-accent-amber">"{query}"</span>.
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
                  className="px-3 py-2.5 hover:bg-surface-hover cursor-pointer transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-3.5 rounded-[2px] ${marker.bgStrip}`} />
                      <span>{item.icon}</span>
                      <span className="font-display font-semibold text-xs text-ink-primary">
                        {item.title}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-chrome border border-border-hairline text-accent-cobalt">
                        {item.pageCode}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-secondary line-clamp-1 font-mono">
                      {item.snippet}
                    </p>
                  </div>

                  <div className="text-right shrink-0 font-mono text-[10px] text-ink-muted">
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
