import React, { useEffect, useRef, useState } from 'react'
import { Columns2, Plus, X } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { Titlebar } from '@renderer/components/layout/Titlebar'
import { IndexRailSidebar } from '@renderer/components/layout/IndexRailSidebar'
import { SpecHeader } from '@renderer/components/layout/SpecHeader'
import { TabContextMenu } from '@renderer/components/layout/TabContextMenu'
import { TabOverflowMenu } from '@renderer/components/layout/TabOverflowMenu'
import { TelemetryStatusBar } from '@renderer/components/layout/TelemetryStatusBar'
import { BlockEditor } from '@renderer/components/editor-block/BlockEditor'
import { SpatialCanvas } from '@renderer/components/editor-canvas/SpatialCanvas'
import { CommandPalette } from '@renderer/components/command/CommandPalette'
import { SettingsView } from '@renderer/components/settings/SettingsView'
import { AIChatView } from '@renderer/components/chat/AIChatView'
import { InAppBrowserView } from '@renderer/components/browser/InAppBrowserView'
import { resolveUndoTarget } from '@renderer/lib/undo-target'
import { SPLIT_RATIO_DEFAULT, nextTabId } from '@renderer/lib/tabs'
import type { Page } from '@shared/types/domain'

const WorkbenchPane: React.FC<{
  page: Page
  isSplitPane?: boolean
  onActivate: () => void
}> = ({ page, isSplitPane = false, onActivate }) => {
  return (
    <div
      onMouseDown={onActivate}
      onFocusCapture={onActivate}
      className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas-primary"
    >
      <SpecHeader page={page} />
      {page.mode === 'canvas' ? (
        <SpatialCanvas key={`canvas-${page.id}-${isSplitPane}`} page={page} />
      ) : (
        <BlockEditor key={`block-${page.id}-${isSplitPane}`} page={page} />
      )}
    </div>
  )
}

/**
 * Undo/redo aplikasi menggantikan undo native, termasuk saat fokus di textarea/input
 * editor: input-nya controlled React, jadi Ctrl+Z native tidak mengubah state apa pun.
 * Konsekuensinya satu langkah undo = satu grup edit hasil coalescing 500ms, bukan per
 * karakter. Satu-satunya pengecualian: Command Palette yang punya input pencarian sendiri.
 */
const isInsideCommandPalette = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[data-command-palette]') !== null

export const App: React.FC = () => {
  const {
    loadWorkspace,
    isLoading,
    pages,
    sections,
    openTabIds,
    activePageId,
    splitPageId,
    splitRatio,
    dirtyPageIds,
    focusedPane,
    isSidebarCollapsed,
    activeMainView,
    setActiveMainView,
    isBrowserSplitOpen,
    openPageInTab,
    closeTab,
    reorderTabs,
    reopenLastClosed,
    setSplitRatio,
    toggleSidebar,
    setCommandPaletteOpen,
    switchPageMode,
    toggleSplitPane,
    setFocusedPane,
    createPage,
    toastMessage,
    isCommandPaletteOpen,
    flushSaves,
    undo,
    redo
  } = useWorkspaceStore()

  // --- Multi-tab UI state ---
  const tabStripRef = useRef<HTMLDivElement>(null)
  const workAreaRef = useRef<HTMLDivElement>(null)
  const [hasTabOverflow, setHasTabOverflow] = useState(false)
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [tabMenu, setTabMenu] = useState<{ pageId: string; x: number; y: number } | null>(null)
  const [isDividerDragging, setIsDividerDragging] = useState(false)

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  // Chevron hanya muncul kalau strip tab benar-benar tidak muat. ResizeObserver
  // dipakai supaya jendela yang dilebarkan langsung menyembunyikan chevron lagi.
  useEffect(() => {
    const strip = tabStripRef.current
    if (!strip) return
    const update = (): void => setHasTabOverflow(strip.scrollWidth > strip.clientWidth + 1)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [openTabIds, isSidebarCollapsed])

  // Hotkey global daily note: page dibuat di main process, jadi store dimuat ulang
  // dulu supaya openPageInTab menemukan halamannya. Listener dibersihkan saat unmount.
  useEffect(() => {
    return window.noteitAPI.onNavigateToPage((pageId) => {
      void (async () => {
        await loadWorkspace()
        openPageInTab(pageId)
      })()
    })
  }, [loadWorkspace, openPageInTab])

  // Global Desktop Keyboard Shortcuts (from DESIGN.md)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      // Undo/redo halaman. Input editor tidak dikecualikan karena controlled:
      // undo native tidak berefek di sana, undo aplikasi yang dipakai.
      if (mod && !isCommandPaletteOpen && !isInsideCommandPalette(e.target)) {
        // Undo mengikuti pane yang fokus: saat split pane aktif, pane kanan bisa
        // sedang diedit walau activePageId masih menunjuk pane kiri.
        const undoTarget = resolveUndoTarget({ focusedPane, activePageId, splitPageId })

        if (key === 'z' && !e.shiftKey) {
          e.preventDefault()
          undo(undoTarget)
          return
        }
        if ((key === 'z' && e.shiftKey) || key === 'y') {
          e.preventDefault()
          redo(undoTarget)
          return
        }
      }

      // Tab: tutup, siklus, dan buka ulang. Ctrl+Tab sengaja hanya ctrlKey
      // (Cmd+Tab di macOS milik OS, bukan aplikasi).
      if (mod && key === 'w') {
        e.preventDefault()
        closeTab(activePageId)
        return
      }
      if (mod && e.shiftKey && key === 't') {
        e.preventDefault()
        reopenLastClosed()
        return
      }
      if (e.ctrlKey && key === 'tab') {
        e.preventDefault()
        const targetId = nextTabId(openTabIds, activePageId, e.shiftKey ? -1 : 1)
        if (targetId) openPageInTab(targetId)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setActiveMainView(activeMainView === 'settings' ? 'workbench' : 'settings')
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        setActiveMainView(activeMainView === 'ai-chat' ? 'workbench' : 'ai-chat')
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setActiveMainView(activeMainView === 'browser' ? 'workbench' : 'browser')
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
  }, [
    activePageId,
    splitPageId,
    focusedPane,
    pages,
    activeMainView,
    setActiveMainView,
    setCommandPaletteOpen,
    switchPageMode,
    toggleSidebar,
    isCommandPaletteOpen,
    undo,
    redo,
    closeTab,
    openTabIds,
    reopenLastClosed,
    openPageInTab
  ])

  // Durability: jangan biarkan edit terakhir hanya hidup di memori renderer.
  useEffect(() => {
    const flush = (): void => {
      flushSaves()
    }
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') flushSaves()
    }

    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [flushSaves])

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
    <div className="h-screen w-screen flex flex-col bg-canvas-primary text-ink-primary overflow-hidden ambient-aurora-host">
      {/* Custom Precision Titlebar */}
      <Titlebar />

      {/* Main Desktop Body: Full-View Settings OR (Index Rail Sidebar + Workbench / AI Chat) */}
      {activeMainView === 'settings' ? (
        <SettingsView />
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {!isSidebarCollapsed && <IndexRailSidebar />}

          {activeMainView === 'ai-chat' ? (
            <AIChatView />
          ) : activeMainView === 'browser' ? (
            <InAppBrowserView />
          ) : (
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden animate-view-enter">
              {/* Multi-Tab Bar with Section Drafting Marker Top Accent */}
          <div className="h-[34px] bg-surface-chrome border-b border-border-hairline flex items-center justify-between px-2 select-none shrink-0">
            <div className="flex items-center gap-1 min-w-0">
              <div
                ref={tabStripRef}
                className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 min-w-0"
              >
                {openTabIds.map((tabId) => {
                  const tabPage = pages.find((p) => p.id === tabId)
                  if (!tabPage) return null
                  const sec = sections.find((s) => s.id === tabPage.sectionId)
                  const marker = MARKER_META[sec?.color || 'cobalt']
                  const isActive = tabPage.id === activePage?.id
                  const isDirty = dirtyPageIds.includes(tabId)

                  return (
                    <div
                      key={tabId}
                      draggable
                      onDragStart={(e) => {
                        setDraggingTabId(tabId)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', tabId)
                      }}
                      onDragEnd={() => setDraggingTabId(null)}
                      onDragOver={(e) => {
                        // preventDefault wajib, kalau tidak drop tidak pernah terjadi.
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        const fromId = draggingTabId || e.dataTransfer.getData('text/plain')
                        if (fromId && fromId !== tabId) reorderTabs(fromId, tabId)
                        setDraggingTabId(null)
                      }}
                      onClick={() => openPageInTab(tabId)}
                      onAuxClick={(e) => {
                        // Middle-click = close, sama seperti browser.
                        if (e.button !== 1) return
                        e.preventDefault()
                        closeTab(tabId)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setTabMenu({ pageId: tabId, x: e.clientX, y: e.clientY })
                      }}
                      className={`group relative h-7 px-3 rounded-[5px] border flex items-center gap-2 text-xs cursor-pointer transition-colors ${
                        draggingTabId === tabId ? 'opacity-40' : ''
                      } ${
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
                      {isDirty && (
                        <span
                          title="Perubahan belum tersimpan"
                          aria-label="Perubahan belum tersimpan"
                          className="w-1.5 h-1.5 rounded-full bg-accent-amber shrink-0"
                        />
                      )}
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

              {/* Chevron hanya ada saat strip tab overflow */}
              {hasTabOverflow && <TabOverflowMenu />}
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

          {/* Primary & Optional Split-Pane Work Area (Supports Page Split OR In-App Browser Split) */}
          <div ref={workAreaRef} className="flex-1 flex min-h-0 overflow-hidden">
            {activePage && (
              <div
                className="flex flex-col min-w-0 h-full overflow-hidden"
                style={
                  splitPage || isBrowserSplitOpen
                    ? {
                        flexBasis: `${splitRatio * 100}%`,
                        flexGrow: 0,
                        flexShrink: 0
                      }
                    : { flex: '1 1 0%' }
                }
              >
                <WorkbenchPane page={activePage} onActivate={() => setFocusedPane('primary')} />
              </div>
            )}
            {(splitPage || isBrowserSplitOpen) && (
              <>
                {/* Divider split: pointer events (bukan drag HTML5) supaya
                    pergerakan mengikuti kursor tanpa ghost image. */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  title="Geser untuk mengubah lebar split, double-click untuk reset"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    setIsDividerDragging(true)
                  }}
                  onPointerMove={(e) => {
                    if (!isDividerDragging) return
                    const rect = workAreaRef.current?.getBoundingClientRect()
                    if (!rect || rect.width === 0) return
                    setSplitRatio((e.clientX - rect.left) / rect.width)
                  }}
                  onPointerUp={(e) => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId)
                    }
                    setIsDividerDragging(false)
                  }}
                  onPointerCancel={() => setIsDividerDragging(false)}
                  onDoubleClick={() => setSplitRatio(SPLIT_RATIO_DEFAULT)}
                  className={`w-1 shrink-0 cursor-col-resize transition-colors ${
                    isDividerDragging ? 'bg-accent-cobalt' : 'bg-border-hairline hover:bg-accent-cobalt/60'
                  }`}
                />
                <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                  {isBrowserSplitOpen ? (
                    <InAppBrowserView isSplitMode />
                  ) : splitPage ? (
                    <WorkbenchPane
                      page={splitPage}
                      isSplitPane
                      onActivate={() => setFocusedPane('split')}
                    />
                  ) : null}
                </div>
              </>
            )}
          </div>
            </main>
          )}
        </div>
      )}

      {/* Bottom Monospace Telemetry Status Bar */}
      <TelemetryStatusBar />

      {/* Command Palette & FTS5 Instant Search Modal (Ctrl+K) */}
      <CommandPalette />

      {/* Tab Context Menu (klik kanan tab) */}
      {tabMenu && (
        <TabContextMenu
          pageId={tabMenu.pageId}
          x={tabMenu.x}
          y={tabMenu.y}
          onClose={() => setTabMenu(null)}
        />
      )}

      {/* Consistent Active-Voice Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-9 right-4 z-50 px-3.5 py-2 rounded-[6px] bg-surface-elevated border border-accent-cobalt shadow-xl font-mono text-xs text-ink-primary flex items-center gap-2 animate-toast-enter">
          <span className="w-2 h-2 rounded-full bg-accent-cobalt" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
