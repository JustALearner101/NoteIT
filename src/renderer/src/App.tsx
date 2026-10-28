import React, { useEffect } from 'react'
import { Columns2, Plus, X } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { Titlebar } from '@renderer/components/layout/Titlebar'
import { IndexRailSidebar } from '@renderer/components/layout/IndexRailSidebar'
import { SpecHeader } from '@renderer/components/layout/SpecHeader'
import { TelemetryStatusBar } from '@renderer/components/layout/TelemetryStatusBar'
import { BlockEditor } from '@renderer/components/editor-block/BlockEditor'
import { SpatialCanvas } from '@renderer/components/editor-canvas/SpatialCanvas'
import { CommandPalette } from '@renderer/components/command/CommandPalette'
import type { Page } from '@shared/types/domain'

const WorkbenchPane: React.FC<{
  page: Page
  isSplitPane?: boolean
}> = ({ page, isSplitPane = false }) => {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas-primary">
      <SpecHeader page={page} />
      {page.mode === 'canvas' ? (
        <SpatialCanvas key={`canvas-${page.id}-${isSplitPane}`} page={page} />
      ) : (
        <BlockEditor key={`block-${page.id}-${isSplitPane}`} page={page} />
      )}
    </div>
  )
}

export const App: React.FC = () => {
  const {
    loadWorkspace,
    isLoading,
    pages,
    sections,
    openTabIds,
    activePageId,
    splitPageId,
    isSidebarCollapsed,
    openPageInTab,
    closeTab,
    toggleSidebar,
    setCommandPaletteOpen,
    switchPageMode,
    toggleSplitPane,
    createPage,
    toastMessage
  } = useWorkspaceStore()

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  // Global Desktop Keyboard Shortcuts (from DESIGN.md)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        const current = pages.find((p) => p.id === activePageId)
        if (current) {
          switchPageMode(current.id, current.mode === 'block' ? 'canvas' : 'block')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePageId, pages, setCommandPaletteOpen, switchPageMode, toggleSidebar])

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-canvas-primary text-ink-primary flex items-center justify-center font-mono text-xs">
        MEMUAT WORKSPACE SQLITE WAL & INDEKS FTS5...
      </div>
    )
  }

  const activePage = pages.find((p) => p.id === activePageId) || pages[0]
  const splitPage = splitPageId ? pages.find((p) => p.id === splitPageId) : null

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas-primary text-ink-primary overflow-hidden">
      {/* Custom Precision Titlebar */}
      <Titlebar />

      {/* Main Desktop Body: Index Rail Sidebar + Multi-Tab / Split-Pane Host */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {!isSidebarCollapsed && <IndexRailSidebar />}

        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Multi-Tab Bar with Section Drafting Marker Top Accent */}
          <div className="h-[34px] bg-surface-chrome border-b border-border-hairline flex items-center justify-between px-2 select-none shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
              {openTabIds.map((tabId) => {
                const tabPage = pages.find((p) => p.id === tabId)
                if (!tabPage) return null
                const sec = sections.find((s) => s.id === tabPage.sectionId)
                const marker = MARKER_META[sec?.color || 'cobalt']
                const isActive = tabPage.id === activePage?.id

                return (
                  <div
                    key={tabId}
                    onClick={() => openPageInTab(tabId)}
                    className={`group relative h-7 px-3 rounded-[5px] border flex items-center gap-2 text-xs cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-surface-elevated border-border-hairline text-ink-primary font-medium'
                        : 'bg-surface-chrome border-transparent text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                    }`}
                  >
                    {/* 2px Active Section Marker Accent Line */}
                    {isActive && (
                      <span
                        className={`absolute top-0 left-1.5 right-1.5 h-[2px] rounded-full ${marker.bgStrip}`}
                      />
                    )}
                    <span className="text-xs">{tabPage.icon}</span>
                    <span className="truncate max-w-[160px]">{tabPage.title}</span>
                    <span className="font-mono text-[10px] text-ink-muted">{tabPage.code}</span>
                    {openTabIds.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(tabId)
                        }}
                        className="opacity-60 group-hover:opacity-100 hover:text-[#EF4444]"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                )
              })}

              <button
                onClick={() => {
                  const secId = activePage?.sectionId || sections[0]?.id
                  if (secId) {
                    createPage({
                      sectionId: secId,
                      title: 'Spesifikasi Baru',
                      template: 'blank'
                    })
                  }
                }}
                title="Buka Halaman Baru"
                className="h-6 w-6 rounded hover:bg-surface-hover flex items-center justify-center text-ink-muted hover:text-ink-primary"
              >
                <Plus size={13} />
              </button>
            </div>

            {/* Right Pane Indicator when Split-Pane is active */}
            {splitPage && (
              <div className="flex items-center gap-2 font-mono text-[11px] pl-3 border-l border-border-hairline">
                <Columns2 size={12} className="text-accent-cobalt" />
                <span className="text-ink-secondary">SPLIT PANE:</span>
                <select
                  value={splitPage.id}
                  onChange={(e) => openPageInTab(e.target.value, true)}
                  className="bg-surface-elevated border border-border-hairline rounded px-2 py-0.5 text-ink-primary focus:outline-none"
                >
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => toggleSplitPane()}
                  title="Tutup Split-Pane"
                  className="p-0.5 rounded hover:bg-surface-hover text-ink-muted hover:text-[#EF4444]"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Primary & Optional Split-Pane Work Area */}
          <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-border-hairline">
            {activePage && <WorkbenchPane page={activePage} />}
            {splitPage && <WorkbenchPane page={splitPage} isSplitPane />}
          </div>
        </main>
      </div>

      {/* Bottom Monospace Telemetry Status Bar */}
      <TelemetryStatusBar />

      {/* Command Palette & FTS5 Instant Search Modal (Ctrl+K) */}
      <CommandPalette />

      {/* Consistent Active-Voice Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-9 right-4 z-50 px-3.5 py-2 rounded-[6px] bg-surface-elevated border border-accent-cobalt shadow-xl font-mono text-xs text-ink-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-cobalt" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
