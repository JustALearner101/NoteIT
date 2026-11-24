import React, { Suspense, useEffect, useRef, useState } from 'react'
import { Columns2, Plus, X } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { matchesShortcutEvent } from '@renderer/lib/shortcuts'
import { Titlebar } from '@renderer/components/layout/Titlebar'
import { IndexRailSidebar } from '@renderer/components/layout/IndexRailSidebar'
import { SpecHeader } from '@renderer/components/layout/SpecHeader'
import { TabContextMenu } from '@renderer/components/layout/TabContextMenu'
import { TabOverflowMenu } from '@renderer/components/layout/TabOverflowMenu'
import { TelemetryStatusBar } from '@renderer/components/layout/TelemetryStatusBar'
import { CommandPalette } from '@renderer/components/command/CommandPalette'
import { ShortcutCheatsheetModal } from '@renderer/components/command/ShortcutCheatsheetModal'
import { useTerminalStore } from '@renderer/stores/useTerminalStore'
import { resolveUndoTarget } from '@renderer/lib/undo-target'
import { SPLIT_RATIO_DEFAULT, nextTabId } from '@renderer/lib/tabs'
import type { Page } from '@shared/types/domain'

const BlockEditor = React.lazy(() =>
  import('@renderer/components/editor-block/BlockEditor').then((m) => ({
    default: m.BlockEditor
  }))
)
const SpatialCanvas = React.lazy(() =>
  import('@renderer/components/editor-canvas/SpatialCanvas').then((m) => ({
    default: m.SpatialCanvas
  }))
)
const SettingsView = React.lazy(() =>
  import('@renderer/components/settings/SettingsView').then((m) => ({
    default: m.SettingsView
  }))
)
const AIStudioView = React.lazy(() =>
  import('@renderer/components/ai-studio/AIStudioView').then((m) => ({
    default: m.AIStudioView
  }))
)
const InAppBrowserView = React.lazy(() =>
  import('@renderer/components/browser/InAppBrowserView').then((m) => ({
    default: m.InAppBrowserView
  }))
)
const AgentMissionControlView = React.lazy(() =>
  import('@renderer/components/agents/AgentMissionControlView').then((m) => ({
    default: m.AgentMissionControlView
  }))
)
const MissionBriefingDrawer = React.lazy(() =>
  import('@renderer/components/agents/MissionBriefingDrawer').then((m) => ({
    default: m.MissionBriefingDrawer
  }))
)
const BottomTerminalDrawer = React.lazy(() =>
  import('@renderer/components/terminal/BottomTerminalDrawer').then((m) => ({
    default: m.BottomTerminalDrawer
  }))
)
const RepoExplorerTree = React.lazy(() =>
  import('@renderer/components/repo/RepoExplorerTree').then((m) => ({
    default: m.RepoExplorerTree
  }))
)
const RepoDiffInspectorPane = React.lazy(() =>
  import('@renderer/components/repo/RepoDiffInspectorPane').then((m) => ({
    default: m.RepoDiffInspectorPane
  }))
)

const LazyViewFallback: React.FC<{ label?: string }> = ({ label = 'Loading view...' }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex-1 flex items-center justify-center bg-canvas-primary text-ink-muted font-mono text-xs"
  >
    {label}
  </div>
)

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
        <Suspense fallback={<LazyViewFallback label="Loading Spatial Canvas..." />}>
          <SpatialCanvas key={`canvas-${page.id}-${isSplitPane}`} page={page} />
        </Suspense>
      ) : (
        <Suspense fallback={<LazyViewFallback label="Loading Editor..." />}>
          <BlockEditor key={`block-${page.id}-${isSplitPane}`} page={page} />
        </Suspense>
      )}
    </div>
  )
}

const isInsideCommandPalette = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[data-command-palette]') !== null

export const App: React.FC = () => {
  const {
    loadWorkspace,
    isLoading,
    notebooks,
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
    rightSplitMode,
    toggleAiStudioSplitPane,
    openPageInTab,
    closeTab,
    reorderTabs,
    reopenLastClosed,
    setSplitRatio,
    toggleSidebar,
    setCommandPaletteOpen,
    setShortcutCheatsheetOpen,
    missionBriefingPageId,
    closeMissionBriefing,
    toggleMissionBriefing,
    switchPageMode,
    toggleSplitPane,
    setFocusedPane,
    createPage,
    toastMessage,
    toastTone,
    isCommandPaletteOpen,
    isShortcutCheatsheetOpen,
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
  const toggleTerminalDrawer = useTerminalStore((s) => s.toggleDrawer)

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  // Warm up BlockEditor chunk during idle so creating the first note on a clean slate is instant.
  useEffect(() => {
    if (isLoading) return
    const warmUp = (): void => {
      void import('@renderer/components/editor-block/BlockEditor')
    }
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(warmUp, { timeout: 800 })
      return () => win.cancelIdleCallback?.(id)
    }
    const timer = window.setTimeout(warmUp, 150)
    return () => window.clearTimeout(timer)
  }, [isLoading])

  // Chevron appears only when the tab strip overflows horizontally.
  useEffect(() => {
    const strip = tabStripRef.current
    if (!strip) return
    const update = (): void => setHasTabOverflow(strip.scrollWidth > strip.clientWidth + 1)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [openTabIds, isSidebarCollapsed])

  // Global Daily Note IPC navigation
  useEffect(() => {
    return window.noteitAPI.onNavigateToPage((pageId) => {
      void (async () => {
        await loadWorkspace()
        openPageInTab(pageId)
      })()
    })
  }, [loadWorkspace, openPageInTab])

  // Centralized Keyboard Shortcuts via src/renderer/src/lib/shortcuts.ts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.isComposing || e.defaultPrevented) return

      const hasDialogOpen =
        isCommandPaletteOpen ||
        isShortcutCheatsheetOpen ||
        Boolean(missionBriefingPageId) ||
        Boolean(document.querySelector('[role="dialog"]'))

      const hasBlockingDialogOpen =
        Boolean(missionBriefingPageId) ||
        (!isCommandPaletteOpen &&
          !isShortcutCheatsheetOpen &&
          Boolean(document.querySelector('[role="dialog"]')))

      if (!hasDialogOpen && !isInsideCommandPalette(e.target)) {
        const undoTarget = resolveUndoTarget({ focusedPane, activePageId, splitPageId })

        if (matchesShortcutEvent(e, 'undo')) {
          e.preventDefault()
          undo(undoTarget)
          return
        }
        if (matchesShortcutEvent(e, 'redo')) {
          e.preventDefault()
          redo(undoTarget)
          return
        }
      }

      if (matchesShortcutEvent(e, 'command-palette')) {
        if (hasBlockingDialogOpen) return
        e.preventDefault()
        setShortcutCheatsheetOpen(false)
        setCommandPaletteOpen(!isCommandPaletteOpen)
        return
      }

      if (matchesShortcutEvent(e, 'shortcut-cheatsheet')) {
        if (hasBlockingDialogOpen) return
        e.preventDefault()
        setCommandPaletteOpen(false)
        setShortcutCheatsheetOpen(!isShortcutCheatsheetOpen)
        return
      }

      if (hasDialogOpen) {
        return
      }

      if (matchesShortcutEvent(e, 'dispatch-spec')) {
        if (activeMainView === 'workbench') {
          e.preventDefault()
          const targetId = resolveUndoTarget({ focusedPane, activePageId, splitPageId })
          toggleMissionBriefing(targetId)
        }
        return
      }

      if (matchesShortcutEvent(e, 'open-daily-note')) {
        e.preventDefault()
        void (async () => {
          const page = await window.noteitAPI.openDailyNote()
          await loadWorkspace()
          openPageInTab(page.id)
        })()
        return
      }

      if (matchesShortcutEvent(e, 'close-tab')) {
        e.preventDefault()
        closeTab(activePageId)
        return
      }

      if (matchesShortcutEvent(e, 'reopen-tab')) {
        e.preventDefault()
        reopenLastClosed()
        return
      }

      if (matchesShortcutEvent(e, 'next-tab')) {
        e.preventDefault()
        const targetId = nextTabId(openTabIds, activePageId, 1)
        if (targetId) openPageInTab(targetId)
        return
      }

      if (matchesShortcutEvent(e, 'prev-tab')) {
        e.preventDefault()
        const targetId = nextTabId(openTabIds, activePageId, -1)
        if (targetId) openPageInTab(targetId)
        return
      }

      if (matchesShortcutEvent(e, 'toggle-settings')) {
        e.preventDefault()
        setActiveMainView(activeMainView === 'settings' ? 'workbench' : 'settings')
      } else if (matchesShortcutEvent(e, 'toggle-ai-chat')) {
        e.preventDefault()
        setActiveMainView(activeMainView === 'ai-chat' ? 'workbench' : 'ai-chat')
      } else if (matchesShortcutEvent(e, 'toggle-ai-split')) {
        e.preventDefault()
        toggleAiStudioSplitPane()
      } else if (matchesShortcutEvent(e, 'toggle-browser')) {
        e.preventDefault()
        setActiveMainView(activeMainView === 'browser' ? 'workbench' : 'browser')
      } else if (matchesShortcutEvent(e, 'toggle-mission-control')) {
        e.preventDefault()
        setActiveMainView(activeMainView === 'agent-board' ? 'workbench' : 'agent-board')
      } else if (matchesShortcutEvent(e, 'toggle-terminal')) {
        e.preventDefault()
        toggleTerminalDrawer()
      } else if (matchesShortcutEvent(e, 'toggle-sidebar')) {
        e.preventDefault()
        toggleSidebar()
      } else if (matchesShortcutEvent(e, 'switch-page-mode')) {
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
    setShortcutCheatsheetOpen,
    toggleMissionBriefing,
    missionBriefingPageId,
    switchPageMode,
    toggleSidebar,
    toggleAiStudioSplitPane,
    toggleTerminalDrawer,
    isCommandPaletteOpen,
    isShortcutCheatsheetOpen,
    undo,
    redo,
    closeTab,
    openTabIds,
    reopenLastClosed,
    openPageInTab,
    loadWorkspace
  ])

  // Flush pending edits on unload / hide
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
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="h-screen w-screen bg-canvas-primary text-ink-primary flex items-center justify-center font-mono text-xs"
      >
        Loading SQLite WAL workspace &amp; FTS5 index...
      </div>
    )
  }

  const activePage = pages.find((p) => p.id === activePageId) || pages[0]
  const splitPage = splitPageId ? pages.find((p) => p.id === splitPageId) : null
  const missionBriefingPage = missionBriefingPageId
    ? pages.find((p) => p.id === missionBriefingPageId) || null
    : null

  const focusTabByIndex = (idx: number): void => {
    const tabs = tabStripRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[idx]?.focus()
  }

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    tabId: string,
    index: number
  ): void => {
    const count = openTabIds.length
    if (count === 0) return

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIdx = (index + 1) % count
      openPageInTab(openTabIds[nextIdx])
      focusTabByIndex(nextIdx)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIdx = (index - 1 + count) % count
      openPageInTab(openTabIds[prevIdx])
      focusTabByIndex(prevIdx)
    } else if (e.key === 'Home') {
      e.preventDefault()
      openPageInTab(openTabIds[0])
      focusTabByIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      const lastIdx = count - 1
      openPageInTab(openTabIds[lastIdx])
      focusTabByIndex(lastIdx)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && count > 1) {
      e.preventDefault()
      closeTab(tabId)
      const fallbackIdx = Math.min(index, count - 2)
      window.requestAnimationFrame(() => focusTabByIndex(fallbackIdx))
    }
  }

  return (
      <div className="h-screen w-screen flex flex-col bg-canvas-primary text-ink-primary overflow-hidden ambient-aurora-host">
        {/* Custom Precision Titlebar */}
        <Titlebar />

        {/* Main Desktop Body: Full-View Settings OR (Index Rail Sidebar + Main View) */}
        {activeMainView === 'settings' ? (
          <Suspense fallback={<LazyViewFallback label="Loading Settings..." />}>
            <SettingsView />
          </Suspense>
        ) : (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <IndexRailSidebar collapsed={isSidebarCollapsed} />

            {activeMainView === 'ai-chat' || activeMainView === 'learn' ? (
              <Suspense fallback={<LazyViewFallback label="Loading AI Studio..." />}>
                <AIStudioView />
              </Suspense>
            ) : activeMainView === 'browser' ? (
              <Suspense fallback={<LazyViewFallback label="Loading Browser..." />}>
                <InAppBrowserView />
              </Suspense>
            ) : activeMainView === 'agent-board' ? (
              <Suspense fallback={<LazyViewFallback label="Loading Mission Control..." />}>
                <AgentMissionControlView />
              </Suspense>
            ) : (
              <main
                aria-label="Workspace"
                className="flex-1 flex flex-col min-w-0 h-full overflow-hidden animate-view-enter"
              >
                {/* Calm Multi-Tab Strip */}
                <div className="h-[38px] bg-surface-chrome/90 border-b border-border-hairline flex items-center justify-between px-2.5 select-none shrink-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <div
                      ref={tabStripRef}
                      className="flex items-center overflow-x-auto no-scrollbar py-1 min-w-0"
                    >
                      {/* display: contents keeps role="tablist" owning only role="tab" children while close buttons align cleanly */}
                      <div role="tablist" aria-label="Open pages" className="contents">
                        {openTabIds.map((tabId, idx) => {
                          const tabPage = pages.find((p) => p.id === tabId)
                          if (!tabPage) return null
                          const sec = sections.find((s) => s.id === tabPage.sectionId)
                          const marker = MARKER_META[sec?.color || 'cobalt']
                          const isActive = tabPage.id === activePage?.id
                          const isDirty = dirtyPageIds.includes(tabId)
                          const hasClose = openTabIds.length > 1

                          return (
                            <button
                              key={tabId}
                              type="button"
                              role="tab"
                              id={`workspace-tab-${tabId}`}
                              aria-selected={isActive}
                              aria-controls={activePage ? 'workbench-tabpanel' : undefined}
                              tabIndex={isActive ? 0 : -1}
                              draggable
                              style={{ order: idx * 2 }}
                              onDragStart={(e) => {
                                setDraggingTabId(tabId)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', tabId)
                              }}
                              onDragEnd={() => setDraggingTabId(null)}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                const fromId =
                                  draggingTabId || e.dataTransfer.getData('text/plain')
                                if (fromId && fromId !== tabId) reorderTabs(fromId, tabId)
                                setDraggingTabId(null)
                              }}
                              onClick={() => openPageInTab(tabId)}
                              onKeyDown={(e) => handleTabKeyDown(e, tabId, idx)}
                              onAuxClick={(e) => {
                                if (e.button !== 1) return
                                e.preventDefault()
                                closeTab(tabId)
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault()
                                setTabMenu({ pageId: tabId, x: e.clientX, y: e.clientY })
                              }}
                              className={`h-[28px] pl-2.5 border-y border-l flex items-center gap-2 text-[12px] cursor-pointer transition-colors shrink-0 ${
                                hasClose ? 'pr-1.5 rounded-l-[7px]' : 'pr-2.5 rounded-[7px] border-r mr-1'
                              } ${draggingTabId === tabId ? 'opacity-40' : ''} ${
                                isActive
                                  ? 'bg-surface-elevated border-border-hairline text-ink-primary font-medium shadow-[0_1px_2px_rgba(0,0,0,0.25)]'
                                  : 'bg-transparent border-transparent text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${marker.dotBg} ${
                                  isActive ? 'opacity-100' : 'opacity-45'
                                }`}
                              />
                              <span className="truncate max-w-[168px]">{tabPage.title}</span>
                              {isDirty && (
                                <span
                                  role="img"
                                  title="Unsaved changes"
                                  aria-label="Unsaved changes"
                                  className="w-1.5 h-1.5 rounded-full bg-accent-amber shrink-0"
                                />
                              )}
                              <span className="font-mono text-[10px] text-ink-muted tabular-nums">
                                {tabPage.code}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {openTabIds.length > 1 &&
                        openTabIds.map((tabId, idx) => {
                          const tabPage = pages.find((p) => p.id === tabId)
                          if (!tabPage) return null
                          const isActive = tabPage.id === activePage?.id
                          return (
                            <button
                              key={`${tabId}-close`}
                              type="button"
                              style={{ order: idx * 2 + 1 }}
                              onClick={() => closeTab(tabId)}
                              aria-label={`Close ${tabPage.title}`}
                              title={`Close ${tabPage.title}`}
                              className={`h-[28px] pr-2 pl-0.5 mr-1 rounded-r-[7px] border-y border-r flex items-center justify-center text-ink-muted hover:text-ink-primary transition-colors shrink-0 ${
                                draggingTabId === tabId ? 'opacity-40' : ''
                              } ${
                                isActive
                                  ? 'bg-surface-elevated border-border-hairline shadow-[0_1px_2px_rgba(0,0,0,0.25)]'
                                  : 'bg-transparent border-transparent hover:bg-surface-hover/60'
                              }`}
                            >
                              <X size={11} aria-hidden="true" />
                            </button>
                          )
                        })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const secId = activePage?.sectionId || sections[0]?.id
                        if (secId) {
                          createPage({
                            sectionId: secId,
                            title: 'New Specification',
                            template: 'blank'
                          })
                        }
                      }}
                      title="Open new page"
                      aria-label="New page"
                      className="h-7 w-7 rounded-[7px] hover:bg-surface-hover flex items-center justify-center text-ink-muted hover:text-ink-primary transition-colors shrink-0"
                    >
                      <Plus size={13} aria-hidden="true" />
                    </button>

                    {/* Chevron appears only when tab strip overflows */}
                    {hasTabOverflow && <TabOverflowMenu />}
                  </div>

                  {/* Right Pane Indicator when Split-Pane is active */}
                  {splitPage && rightSplitMode === 'page' && !isBrowserSplitOpen && (
                    <div className="flex items-center gap-2 text-xs pl-3 border-l border-border-hairline shrink-0">
                      <Columns2 size={12.5} className="text-accent-cobalt" aria-hidden="true" />
                      <span className="text-ink-muted">Split:</span>
                      <select
                        aria-label="Split pane page"
                        value={splitPage.id}
                        onChange={(e) => openPageInTab(e.target.value, true)}
                        className="h-6 bg-surface-elevated border border-border-hairline rounded-[6px] px-2 text-xs text-ink-primary focus:border-accent-cobalt"
                      >
                        {pages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} · {p.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => toggleSplitPane()}
                        title="Close split pane"
                        aria-label="Close split pane"
                        className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Primary & Optional Split-Pane Work Area */}
                <div
                  ref={workAreaRef}
                  id="workbench-tabpanel"
                  role="tabpanel"
                  aria-labelledby={activePage ? `workspace-tab-${activePage.id}` : undefined}
                  className="flex-1 flex min-h-0 overflow-hidden"
                >
                  {activePage ? (
                    <div
                      className="flex flex-col min-w-0 h-full overflow-hidden"
                      style={
                        splitPage ||
                        isBrowserSplitOpen ||
                        rightSplitMode === 'repo-explorer' ||
                        rightSplitMode === 'diff' ||
                        rightSplitMode === 'ai-studio'
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
                  ) : (
                    <div className="flex-1 flex items-center justify-center p-8 bg-canvas-primary">
                      <div className="max-w-md w-full p-6 rounded-2xl bg-surface-elevated border border-border-hairline text-center space-y-4">
                        <div className="font-display text-lg font-bold text-ink-primary">
                          {notebooks.length === 0 ? 'Welcome to NoteIT' : 'No page open'}
                        </div>
                        <p className="text-xs text-ink-secondary leading-relaxed">
                          {notebooks.length === 0
                            ? 'Your workspace is 100% clean and ready. Create your first notebook to start writing specifications, diagrams, or code plans.'
                            : 'Select a page from the sidebar or create a new specification page to begin.'}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          {notebooks.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                void (async () => {
                                  const nb = await window.noteitAPI.createNotebook({
                                    name: 'My Workspace',
                                    icon: '📐',
                                    color: 'cobalt'
                                  })
                                  const snap = await window.noteitAPI.getWorkspace()
                                  const defaultSec =
                                    snap.sections.find((s) => s.notebookId === nb.id) ??
                                    (await window.noteitAPI.createSection({
                                      notebookId: nb.id,
                                      name: 'General Specs',
                                      color: 'cobalt'
                                    }))
                                  await createPage({
                                    sectionId: defaultSec.id,
                                    title: 'Untitled Page',
                                    icon: '📄',
                                    mode: 'block'
                                  })
                                })()
                              }}
                              className="px-4 py-2 rounded-lg bg-accent-cobalt text-white text-xs font-medium hover:opacity-90 transition-opacity"
                            >
                              + Create First Notebook
                            </button>
                          ) : (
                            sections[0] && (
                              <button
                                type="button"
                                onClick={() =>
                                  void createPage({
                                    sectionId: sections[0].id,
                                    title: 'Untitled Page',
                                    icon: '📄',
                                    mode: 'block'
                                  })
                                }
                                className="px-4 py-2 rounded-lg bg-accent-cobalt text-white text-xs font-medium hover:opacity-90 transition-opacity"
                              >
                                + New Page
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveMainView('settings')}
                            className="px-4 py-2 rounded-lg bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-primary"
                          >
                            Configure AI Providers
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {(splitPage ||
                    isBrowserSplitOpen ||
                    rightSplitMode === 'repo-explorer' ||
                    rightSplitMode === 'diff' ||
                    rightSplitMode === 'ai-studio') && (
                    <>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Resize split pane"
                        tabIndex={0}
                        aria-valuenow={Math.round(splitRatio * 100)}
                        aria-valuemin={20}
                        aria-valuemax={80}
                        title="Drag to resize split pane, double-click to reset"
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft') {
                            e.preventDefault()
                            setSplitRatio(splitRatio - 0.02)
                          } else if (e.key === 'ArrowRight') {
                            e.preventDefault()
                            setSplitRatio(splitRatio + 0.02)
                          } else if (e.key === 'Home') {
                            e.preventDefault()
                            setSplitRatio(0.2)
                          } else if (e.key === 'End') {
                            e.preventDefault()
                            setSplitRatio(0.8)
                          } else if (e.key === 'Enter') {
                            e.preventDefault()
                            setSplitRatio(SPLIT_RATIO_DEFAULT)
                          }
                        }}
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
                        className={`w-1 shrink-0 cursor-col-resize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cobalt ${
                          isDividerDragging
                            ? 'bg-accent-cobalt'
                            : 'bg-border-hairline hover:bg-accent-cobalt/60'
                        }`}
                      />
                      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                        <Suspense fallback={<LazyViewFallback label="Loading Split Pane..." />}>
                          {isBrowserSplitOpen ? (
                            <InAppBrowserView isSplitMode />
                          ) : rightSplitMode === 'ai-studio' ? (
                            <AIStudioView isSplitMode />
                          ) : rightSplitMode === 'repo-explorer' ? (
                            <RepoExplorerTree isSplitMode />
                          ) : rightSplitMode === 'diff' ? (
                            <RepoDiffInspectorPane />
                          ) : splitPage ? (
                            <WorkbenchPane
                              page={splitPage}
                              isSplitPane
                              onActivate={() => setFocusedPane('split')}
                            />
                          ) : null}
                        </Suspense>
                      </div>
                    </>
                  )}
                </div>
              </main>
            )}
          </div>
        )}

        {/* Embedded ConPTY / Subprocess Terminal Drawer (Ctrl+`) */}
        <Suspense fallback={null}>
          <BottomTerminalDrawer />
        </Suspense>

        {/* Bottom Monospace Telemetry Status Bar */}
        <TelemetryStatusBar />

        {/* Command Palette & FTS5 Instant Search Modal (Ctrl+K) */}
        <CommandPalette />

        {/* Keyboard Shortcuts Cheatsheet Modal (Ctrl+/) */}
        <ShortcutCheatsheetModal />

        {/* Slide-over Mission Briefing Command Deck (Ctrl+Shift+D) */}
        {missionBriefingPage && (
          <Suspense fallback={null}>
            <MissionBriefingDrawer
              page={missionBriefingPage}
              isOpen={Boolean(missionBriefingPage)}
              onClose={closeMissionBriefing}
            />
          </Suspense>
        )}

        {/* Tab Context Menu */}
        {tabMenu && (
          <TabContextMenu
            pageId={tabMenu.pageId}
            x={tabMenu.x}
            y={tabMenu.y}
            onClose={() => setTabMenu(null)}
          />
        )}

        {/* Always-Mounted Live-Region Toast Notification */}
        <div
          role={toastTone === 'error' ? 'alert' : 'status'}
          aria-live={toastTone === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className="fixed top-12 right-4 z-50 pointer-events-none"
        >
          {toastMessage && (
            <div className="px-3.5 py-2.5 rounded-[10px] bg-surface-elevated border border-border-hairline shadow-popover text-xs font-medium text-ink-primary flex items-center gap-2.5 animate-toast-enter">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  toastTone === 'error' ? 'bg-accent-rose' : 'bg-accent-emerald'
                }`}
                aria-hidden="true"
              />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>
      </div>
  )
}
