import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Bug,
  Columns2,
  ExternalLink,
  Globe,
  GraduationCap,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Star,
  Terminal,
  Trash2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Badge, Button } from '@renderer/components/ui'
import type { BrowserBookmark } from '@shared/types/domain'
import {
  buildClipBlocksFromExtraction,
  normalizeBrowserUrl,
  WEBVIEW_EXTRACT_SCRIPT,
  type ExtractedWebDocument
} from '@shared/web-clipper'

interface BrowserTab {
  id: string
  title: string
  /** Immutable mount URL for <webview src={...}> so React re-renders never abort in-flight navigations. */
  initialUrl: string
  url: string
  isLoading: boolean
  loadError?: { code: number; description: string; url: string } | null
}

interface ConsoleEntry {
  id: string
  level: 'log' | 'warn' | 'error'
  message: string
  sourceId: string
  line: number
  timestamp: number
}

interface WebviewElement extends HTMLElement {
  src: string
  loadURL: (url: string) => Promise<void>
  goBack: () => void
  goForward: () => void
  reload: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  getURL: () => string
  getTitle: () => string
  openDevTools: () => void
  setZoomFactor: (factor: number) => void
  findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean }) => number
  stopFindInPage: (action: 'clearSelection' | 'keepSelection' | 'activateSelection') => void
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>
}

const DEFAULT_TABS: BrowserTab[] = [
  {
    id: 'btab-1',
    title: 'AI SDK by Vercel',
    initialUrl: 'https://ai-sdk.dev/docs/introduction',
    url: 'https://ai-sdk.dev/docs/introduction',
    isLoading: false,
    loadError: null
  }
]

export const InAppBrowserView: React.FC<{ isSplitMode?: boolean }> = ({ isSplitMode = false }) => {
  const {
    pages,
    activePageId,
    activeNotebookId,
    preferences,
    updatePage,
    setBrowserContextForAI,
    setActiveMainView,
    startLearnFromSource,
    isBrowserSplitOpen,
    toggleBrowserSplitPane,
    showToast
  } = useWorkspaceStore()

  const [tabs, setTabs] = useState<BrowserTab[]>(DEFAULT_TABS)
  const [activeTabId, setActiveTabId] = useState('btab-1')
  const [addressInput, setAddressInput] = useState('https://ai-sdk.dev/docs/introduction')
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([])
  const [tabsHydrated, setTabsHydrated] = useState(false)

  // Find-in-Page & Zoom
  const [isFindOpen, setIsFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [zoomFactor, setZoomFactor] = useState(1)
  const findInputRef = useRef<HTMLInputElement>(null)

  // Localhost Dev Inspector (Console & Errors)
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([])
  const [isConsoleOpen, setIsConsoleOpen] = useState(false)

  const webviewRefs = useRef<Record<string, WebviewElement | null>>({})

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]
  const activePage = pages.find((p) => p.id === activePageId) || pages[0]
  const errorCount = consoleLogs.filter((l) => l.level === 'error').length

  // Hydrate persistent browser tabs from ui-state.json
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const uiState = await window.noteitAPI?.getUiState?.()
        if (active && uiState?.browserTabs && uiState.browserTabs.length > 0) {
          const restored: BrowserTab[] = uiState.browserTabs.map((t) => ({
            id: t.id,
            title: t.title,
            initialUrl: t.url,
            url: t.url,
            isLoading: false,
            loadError: null
          }))
          setTabs(restored)
          const targetId =
            uiState.activeBrowserTabId && restored.some((t) => t.id === uiState.activeBrowserTabId)
              ? uiState.activeBrowserTabId
              : restored[0].id
          setActiveTabId(targetId)
        }
      } catch {
        // fallback to default tab
      } finally {
        if (active) setTabsHydrated(true)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Persist browser tabs on change (debounced)
  useEffect(() => {
    if (!tabsHydrated) return
    const timer = setTimeout(() => {
      void window.noteitAPI?.saveUiState?.({
        browserTabs: tabs.map((t) => ({ id: t.id, title: t.title, url: t.url })),
        activeBrowserTabId: activeTabId
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [tabs, activeTabId, tabsHydrated])

  // Load editable & per-notebook bookmarks
  const refreshBookmarks = useCallback(async () => {
    try {
      const list = (await window.noteitAPI?.listBrowserBookmarks?.(activeNotebookId)) ?? []
      setBookmarks(list)
    } catch {
      // ignore in test env
    }
  }, [activeNotebookId])

  useEffect(() => {
    void refreshBookmarks()
  }, [refreshBookmarks])

  // Popup-to-tab handler from Electron main process
  useEffect(() => {
    if (!window.noteitAPI?.onBrowserOpenInNewTab) return
    return window.noteitAPI.onBrowserOpenInNewTab((url: string) => {
      const newId = `btab-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
      setTabs((prev) => [
        ...prev,
        { id: newId, title: url, initialUrl: url, url, isLoading: true, loadError: null }
      ])
      setActiveTabId(newId)
      setAddressInput(url)
    })
  }, [])

  // Keyboard shortcuts: Ctrl+F (Find-in-Page), Ctrl+=/Ctrl+-/Ctrl+0 (Zoom)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setIsFindOpen(true)
        setTimeout(() => findInputRef.current?.focus(), 20)
      } else if (e.key === 'Escape' && isFindOpen) {
        setIsFindOpen(false)
        webviewRefs.current[activeTabId]?.stopFindInPage?.('clearSelection')
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setZoomFactor((z) => {
          const next = Math.min(2, Number((z + 0.1).toFixed(2)))
          webviewRefs.current[activeTabId]?.setZoomFactor?.(next)
          return next
        })
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        setZoomFactor((z) => {
          const next = Math.max(0.5, Number((z - 0.1).toFixed(2)))
          webviewRefs.current[activeTabId]?.setZoomFactor?.(next)
          return next
        })
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        setZoomFactor(1)
        webviewRefs.current[activeTabId]?.setZoomFactor?.(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTabId, isFindOpen])

  useEffect(() => {
    if (activeTab) {
      setAddressInput(activeTab.url)
    }
  }, [activeTabId, activeTab?.url])

  // Attach webview event listeners (loading, title, console-message)
  useEffect(() => {
    const wv = webviewRefs.current[activeTabId]
    if (!wv) return

    const onStartLoading = (): void => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, isLoading: true, loadError: null } : t))
      )
    }

    const onStopLoading = (): void => {
      const currentUrl = typeof wv.getURL === 'function' ? wv.getURL() : activeTab?.url || ''
      const currentTitle =
        typeof wv.getTitle === 'function' ? wv.getTitle() : activeTab?.title || 'Browser Tab'
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                isLoading: false,
                url: currentUrl || t.url,
                title: currentTitle || t.title
              }
            : t
        )
      )
      if (currentUrl) setAddressInput(currentUrl)
    }

    const onNavigated = (e: Event & { url?: string }): void => {
      const nextUrl = e.url || (typeof wv.getURL === 'function' ? wv.getURL() : '')
      if (!nextUrl) return
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, url: nextUrl, loadError: null } : t
        )
      )
      setAddressInput(nextUrl)
    }

    const onDidFailLoad = (
      e: Event & { errorCode?: number; errorDescription?: string; validatedURL?: string; isMainFrame?: boolean }
    ): void => {
      // Ignore ERR_ABORTED (-3), which occurs normally on redirects or user-initiated new navigations
      if (e.errorCode === -3 || e.isMainFrame === false) return
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                isLoading: false,
                loadError: {
                  code: e.errorCode ?? -1,
                  description: e.errorDescription || 'Failed to load page',
                  url: e.validatedURL || t.url
                }
              }
            : t
        )
      )
    }

    const onTitleUpdated = (e: Event & { title?: string }): void => {
      const nextTitle = e.title || (typeof wv.getTitle === 'function' ? wv.getTitle() : '')
      if (!nextTitle) return
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, title: nextTitle } : t))
      )
    }

    const onConsoleMessage = (
      e: Event & { level?: number; message?: string; sourceId?: string; line?: number }
    ): void => {
      // Electron webview console-message levels: 0=verbose, 1=info, 2=warning, 3=error
      const lvl = e.level ?? 1
      if (lvl < 2) return
      const entry: ConsoleEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        level: lvl >= 3 ? 'error' : 'warn',
        message: String(e.message || ''),
        sourceId: String(e.sourceId || ''),
        line: Number(e.line || 0),
        timestamp: Date.now()
      }
      setConsoleLogs((prev) => [entry, ...prev].slice(0, 50))
    }

    wv.addEventListener('did-start-loading', onStartLoading)
    wv.addEventListener('did-stop-loading', onStopLoading)
    wv.addEventListener('did-navigate', onNavigated)
    wv.addEventListener('did-navigate-in-page', onNavigated)
    wv.addEventListener('did-fail-load', onDidFailLoad)
    wv.addEventListener('page-title-updated', onTitleUpdated)
    wv.addEventListener('console-message', onConsoleMessage)

    return () => {
      wv.removeEventListener('did-start-loading', onStartLoading)
      wv.removeEventListener('did-stop-loading', onStopLoading)
      wv.removeEventListener('did-navigate', onNavigated)
      wv.removeEventListener('did-navigate-in-page', onNavigated)
      wv.removeEventListener('did-fail-load', onDidFailLoad)
      wv.removeEventListener('page-title-updated', onTitleUpdated)
      wv.removeEventListener('console-message', onConsoleMessage)
    }
  }, [activeTabId])

  const handleNavigate = (targetInput?: string): void => {
    const url = normalizeBrowserUrl(
      targetInput ?? addressInput,
      preferences.browserSearchEngine || 'google'
    )
    setAddressInput(url)
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, url, title: url, isLoading: true, loadError: null } : t
      )
    )
    const wv = webviewRefs.current[activeTabId]
    if (wv) {
      if (typeof wv.loadURL === 'function') {
        void wv.loadURL(url).catch(() => {
          // ERR_ABORTED on superseded navigation is expected and handled by did-fail-load
        })
      } else {
        wv.src = url
      }
    }
  }

  const handleNewTab = (initialUrl = 'https://developer.mozilla.org'): void => {
    const newId = `btab-${Date.now()}`
    const nextTab: BrowserTab = {
      id: newId,
      title: 'New Browser Tab',
      initialUrl,
      url: initialUrl,
      isLoading: false,
      loadError: null
    }
    setTabs((prev) => [...prev, nextTab])
    setActiveTabId(newId)
    setAddressInput(initialUrl)
  }

  const handleCloseTab = (tabId: string): void => {
    if (tabs.length <= 1) return
    const filtered = tabs.filter((t) => t.id !== tabId)
    setTabs(filtered)
    if (activeTabId === tabId && filtered[0]) {
      setActiveTabId(filtered[0].id)
    }
  }

  const handleToggleBookmark = async (): Promise<void> => {
    const existing = bookmarks.find((b) => b.url === activeTab.url)
    if (existing) {
      await window.noteitAPI.deleteBrowserBookmark(existing.id)
      showToast(`Removed bookmark "${existing.title}"`)
    } else {
      await window.noteitAPI.addBrowserBookmark({
        title: activeTab.title || activeTab.url,
        url: activeTab.url,
        notebookId: activeNotebookId || null
      })
      showToast(`Bookmarked "${activeTab.title}"`)
    }
    await refreshBookmarks()
  }

  const extractStructuredDocument = async (): Promise<ExtractedWebDocument> => {
    const wv = webviewRefs.current[activeTabId]
    const fallbackUrl = activeTab?.url || addressInput
    const fallbackTitle = activeTab?.title || 'Web Reference'

    if (!wv || typeof wv.executeJavaScript !== 'function') {
      return {
        url: fallbackUrl,
        title: fallbackTitle,
        sections: [],
        plainExcerpt: `Web page reference from ${fallbackTitle} (${fallbackUrl}).`
      }
    }

    try {
      const extracted = (await wv.executeJavaScript(WEBVIEW_EXTRACT_SCRIPT)) as ExtractedWebDocument
      return {
        url: extracted?.url || fallbackUrl,
        title: extracted?.title || fallbackTitle,
        selection: extracted?.selection,
        sections: Array.isArray(extracted?.sections) ? extracted.sections : [],
        plainExcerpt: extracted?.plainExcerpt || ''
      }
    } catch {
      return {
        url: fallbackUrl,
        title: fallbackTitle,
        sections: [],
        plainExcerpt: `Web page reference from ${fallbackTitle} (${fallbackUrl}).`
      }
    }
  }

  const handleClipToActiveSpec = async (): Promise<void> => {
    if (!activePage) {
      showToast('No active page to save the clip')
      return
    }
    const doc = await extractStructuredDocument()
    const clippedBlocks = buildClipBlocksFromExtraction(doc)
    await updatePage({ id: activePage.id, blocks: [...activePage.blocks, ...clippedBlocks] })
    showToast(`Smart-clipped ${clippedBlocks.length} block(s) to ${activePage.code}`)
  }

  const handleSendToAIChat = async (): Promise<void> => {
    const doc = await extractStructuredDocument()
    setBrowserContextForAI({
      url: doc.url,
      title: doc.title,
      excerpt: doc.selection || doc.plainExcerpt
    })
    if (!isSplitMode) {
      setActiveMainView('ai-chat')
    }
    showToast(`Context '${doc.title}' sent to AI Chat`)
  }

  const handleLearnThisPage = async (): Promise<void> => {
    const doc = await extractStructuredDocument()
    startLearnFromSource({
      title: doc.title,
      goal: `Understand the key concepts from "${doc.title}"`,
      sourceType: 'web',
      url: doc.url,
      contentExcerpt: (doc.selection || doc.plainExcerpt).slice(0, 6000)
    })
    showToast(`Loaded "${doc.title}" into Learn Workbench`)
  }

  const handleSendConsoleErrorsToAI = (): void => {
    const summary = consoleLogs
      .slice(0, 15)
      .map((l) => `[${l.level.toUpperCase()}] ${l.message} (${l.sourceId}:${l.line})`)
      .join('\n')
    setBrowserContextForAI({
      url: activeTab.url,
      title: `Console Errors · ${activeTab.title}`,
      excerpt: summary || 'No console errors captured.'
    })
    if (!isSplitMode) setActiveMainView('ai-chat')
    showToast('Console logs sent to AI Chat')
  }

  const handleFindSubmit = (forward = true): void => {
    const wv = webviewRefs.current[activeTabId]
    if (!wv || !findQuery.trim()) return
    wv.findInPage?.(findQuery.trim(), { forward, findNext: true })
  }

  const isBookmarked = bookmarks.some((b) => b.url === activeTab.url)
  const RootTag = isSplitMode ? 'section' : 'main'

  return (
    <RootTag
      aria-label="In-app browser"
      className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas-primary animate-view-enter"
    >
      {/* Top Browser Tab Bar */}
      <div className="h-[38px] px-2.5 bg-surface-chrome border-b border-border-hairline flex items-center justify-between gap-2 select-none shrink-0">
        <div role="tablist" aria-label="Browser tabs" className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab.id
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => setActiveTabId(tab.id)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setActiveTabId(tab.id)
                  }
                }}
                className={`group h-7 px-2.5 rounded-[7px] border flex items-center gap-2 text-xs cursor-pointer transition-colors shrink-0 ${
                  isActive
                    ? 'bg-surface-elevated border-border-hairline text-ink-primary font-medium'
                    : 'bg-transparent border-transparent text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                }`}
              >
                <Globe
                  size={11.5}
                  aria-hidden="true"
                  className={
                    tab.isLoading ? 'text-accent-amber animate-spin' : 'text-accent-cobalt'
                  }
                />
                <span className="truncate max-w-[140px]">{tab.title}</span>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Close ${tab.title}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCloseTab(tab.id)
                    }}
                    className="opacity-50 group-hover:opacity-100 hover:text-accent-rose"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => handleNewTab()}
            title="Open new browser tab"
            aria-label="Open new browser tab"
            className="h-7 w-7 rounded-[7px] hover:bg-surface-hover flex items-center justify-center text-ink-muted hover:text-ink-primary shrink-0 transition-colors"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </div>

        {/* Mode Dock / Split Toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => {
              if (isSplitMode) {
                toggleBrowserSplitPane()
              } else {
                setActiveMainView('workbench')
                if (!isBrowserSplitOpen) toggleBrowserSplitPane()
              }
            }}
            title={
              isSplitMode
                ? 'Close split browser'
                : 'Dock browser in right split pane beside notes'
            }
          >
            <Columns2 size={11.5} className="text-accent-cobalt" aria-hidden="true" />
            <span>{isSplitMode ? 'Close Split' : 'Dock to Split'}</span>
          </Button>
        </div>
      </div>

      {/* Omnibox URL & Workbench Action Bar */}
      <div className="px-3 py-2 bg-surface-chrome/65 border-b border-border-hairline flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => webviewRefs.current[activeTabId]?.goBack?.()}
            title="Back"
            aria-label="Navigate back"
            className="h-7 w-7 rounded-[7px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ArrowLeft size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => webviewRefs.current[activeTabId]?.goForward?.()}
            title="Forward"
            aria-label="Navigate forward"
            className="h-7 w-7 rounded-[7px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ArrowRight size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => webviewRefs.current[activeTabId]?.reload?.()}
            title="Reload"
            aria-label="Reload page"
            className="h-7 w-7 rounded-[7px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <RotateCw size={12} aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleNavigate()
          }}
          className="flex-1 min-w-[180px] relative"
        >
          <input
            type="text"
            aria-label="Browser address or search query"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="Type URL (https://..., localhost:3000) or search query..."
            className="w-full h-7 pl-3 pr-8 rounded-[7px] bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-primary placeholder:text-ink-muted focus:border-accent-cobalt"
          />
          <button
            type="button"
            onClick={() => void handleToggleBookmark()}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-surface-hover text-ink-muted hover:text-accent-amber"
          >
            <Star
              size={12}
              className={isBookmarked ? 'fill-accent-amber text-accent-amber' : ''}
              aria-hidden="true"
            />
          </button>
        </form>

        {/* NoteIT Workbench Superpowers */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleClipToActiveSpec()}
            title="Smart-clip headings, paragraphs & code blocks into the active document"
          >
            <BookmarkPlus size={12} className="text-accent-amber" aria-hidden="true" />
            <span className="hidden sm:inline">Clip to {activePage?.code || 'Spec'}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleLearnThisPage()}
            title="Start an interactive LearnHarness session from this web page"
          >
            <GraduationCap size={12} className="text-accent-teal" aria-hidden="true" />
            <span className="hidden md:inline">Learn</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSendToAIChat()}
            title="Send this web page content as context to AI Chat"
          >
            <Sparkles size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Ask AI</span>
          </Button>

          {/* Zoom & Find */}
          <button
            type="button"
            onClick={() => {
              setIsFindOpen((v) => !v)
              setTimeout(() => findInputRef.current?.focus(), 20)
            }}
            title="Find in page (Ctrl+F)"
            aria-label="Find in page"
            className="h-7 w-7 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <Search size={12} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              const next = Math.max(0.5, Number((zoomFactor - 0.1).toFixed(2)))
              setZoomFactor(next)
              webviewRefs.current[activeTabId]?.setZoomFactor?.(next)
            }}
            title="Zoom out (Ctrl+-)"
            aria-label="Zoom out"
            className="h-7 w-7 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ZoomOut size={12} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              const next = Math.min(2, Number((zoomFactor + 0.1).toFixed(2)))
              setZoomFactor(next)
              webviewRefs.current[activeTabId]?.setZoomFactor?.(next)
            }}
            title={`Zoom in (${Math.round(zoomFactor * 100)}%)`}
            aria-label="Zoom in"
            className="h-7 w-7 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ZoomIn size={12} aria-hidden="true" />
          </button>

          {/* Console Inspector Toggle */}
          <button
            type="button"
            onClick={() => setIsConsoleOpen((v) => !v)}
            title="Toggle Localhost Console & Error Inspector"
            aria-label="Toggle Console Inspector"
            className="relative h-7 px-2 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center gap-1 text-xs text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <Terminal size={12} aria-hidden="true" />
            {errorCount > 0 && (
              <span className="px-1 rounded bg-accent-rose/20 text-accent-rose font-mono text-[10px]">
                {errorCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => webviewRefs.current[activeTabId]?.openDevTools?.()}
            title="Open Chromium DevTools for this tab"
            aria-label="Open Chromium DevTools"
            className="h-7 w-7 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <Bug size={12} aria-hidden="true" />
          </button>

          <a
            href={activeTab.url}
            target="_blank"
            rel="noreferrer"
            title="Open in external OS browser"
            aria-label="Open in external browser"
            className="h-7 w-7 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Find-in-Page Bar */}
      {isFindOpen && (
        <div className="px-3 py-1.5 bg-surface-elevated border-b border-border-hairline flex items-center gap-2 shrink-0">
          <Search size={12} className="text-ink-muted" aria-hidden="true" />
          <input
            ref={findInputRef}
            type="text"
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value)
              if (e.target.value.trim()) {
                webviewRefs.current[activeTabId]?.findInPage?.(e.target.value.trim())
              } else {
                webviewRefs.current[activeTabId]?.stopFindInPage?.('clearSelection')
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleFindSubmit(!e.shiftKey)
              }
            }}
            placeholder="Find in page..."
            className="h-6 px-2 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary w-56"
          />
          <Button variant="secondary" size="xs" onClick={() => handleFindSubmit(false)}>
            Prev
          </Button>
          <Button variant="secondary" size="xs" onClick={() => handleFindSubmit(true)}>
            Next
          </Button>
          <span className="text-[10.5px] font-mono text-ink-muted ml-auto">
            Zoom {Math.round(zoomFactor * 100)}%
          </span>
          <button
            type="button"
            onClick={() => {
              setIsFindOpen(false)
              webviewRefs.current[activeTabId]?.stopFindInPage?.('clearSelection')
            }}
            className="p-1 text-ink-muted hover:text-ink-primary"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Editable Bookmarks Bar */}
      <div className="px-3 py-1.5 bg-surface-chrome/35 border-b border-border-subtle flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none shrink-0">
        <span className="text-[11px] font-medium text-ink-muted mr-1">Bookmarks:</span>
        {bookmarks.map((bm) => (
          <div
            key={bm.id}
            className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-surface-elevated/80 hover:bg-surface-hover border border-border-hairline text-[11px] text-ink-secondary hover:text-ink-primary shrink-0 transition-colors"
          >
            <button
              type="button"
              onClick={() => handleNavigate(bm.url)}
              className="truncate max-w-[140px]"
              title={bm.url}
            >
              {bm.title}
            </button>
            <button
              type="button"
              aria-label={`Remove bookmark ${bm.title}`}
              onClick={() => {
                void window.noteitAPI.deleteBrowserBookmark(bm.id).then(() => refreshBookmarks())
              }}
              className="opacity-0 group-hover:opacity-80 hover:text-accent-rose"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Chromium <webview> Host */}
      <div className="flex-1 relative bg-white overflow-hidden">
        {tabs.map((tab) => (
          <webview
            key={tab.id}
            ref={(el) => {
              webviewRefs.current[tab.id] = el as WebviewElement | null
            }}
            src={tab.initialUrl}
            partition="persist:noteit-browser"
            className={`w-full h-full border-0 ${
              tab.id === activeTab.id ? 'flex' : 'hidden'
            }`}
          />
        ))}

        {activeTab.loadError && (
          <div className="absolute inset-0 bg-canvas-primary/95 flex items-center justify-center p-6 z-10">
            <div className="max-w-md w-full p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-3">
              <div className="flex items-center gap-2 text-accent-amber">
                <AlertTriangle size={16} aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-ink-primary">
                  Page could not be loaded
                </h3>
              </div>
              <p className="text-xs text-ink-secondary font-mono break-all">
                {activeTab.loadError.description} ({activeTab.loadError.code})
                <br />
                {activeTab.loadError.url}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleNavigate(activeTab.loadError?.url || activeTab.url)}
                >
                  <RotateCw size={12} />
                  <span>Retry</span>
                </Button>
                <a
                  href={activeTab.loadError.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary inline-flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  <span>Open externally</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Localhost Console & Error Inspector Drawer */}
      {isConsoleOpen && (
        <div className="h-44 bg-surface-chrome border-t border-border-hairline flex flex-col shrink-0">
          <div className="px-3 py-1.5 border-b border-border-subtle flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={12} className="text-accent-amber" aria-hidden="true" />
              <span className="text-xs font-medium text-ink-primary">
                Browser Console Inspector
              </span>
              <Badge tone={errorCount > 0 ? 'amber' : 'neutral'} size="sm">
                {consoleLogs.length} warnings/errors
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                disabled={consoleLogs.length === 0}
                onClick={handleSendConsoleErrorsToAI}
              >
                <Sparkles size={11} />
                <span>Send to AI Chat</span>
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setConsoleLogs([])}
              >
                <Trash2 size={11} />
                <span>Clear</span>
              </Button>
              <button
                type="button"
                onClick={() => setIsConsoleOpen(false)}
                className="p-1 text-ink-muted hover:text-ink-primary"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11px]">
            {consoleLogs.length === 0 ? (
              <div className="text-ink-muted px-2 py-3">
                No console warnings or errors captured yet for this session.
              </div>
            ) : (
              consoleLogs.map((log) => (
                <div
                  key={log.id}
                  className={`px-2 py-1 rounded border ${
                    log.level === 'error'
                      ? 'bg-accent-rose/10 border-accent-rose/30 text-accent-rose'
                      : 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber'
                  }`}
                >
                  <span className="font-semibold">[{log.level.toUpperCase()}]</span> {log.message}
                  {log.sourceId && (
                    <span className="text-ink-muted ml-2">
                      ({log.sourceId.split('/').pop()}:{log.line})
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </RootTag>
  )
}
