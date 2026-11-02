import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Bug,
  Columns2,
  ExternalLink,
  Globe,
  Plus,
  RotateCw,
  Sparkles,
  X
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'

interface BrowserTab {
  id: string
  title: string
  url: string
  isLoading: boolean
}

interface WebviewElement extends HTMLElement {
  src: string
  goBack: () => void
  goForward: () => void
  reload: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  getURL: () => string
  getTitle: () => string
  openDevTools: () => void
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>
}

const QUICK_BOOKMARKS = [
  { label: 'AI SDK Docs', url: 'https://ai-sdk.dev/docs/introduction' },
  { label: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
  { label: 'GitHub', url: 'https://github.com' },
  { label: 'Localhost :3000', url: 'http://localhost:3000' },
  { label: 'DBML Docs', url: 'https://dbml.dbdiagram.io/home' }
]

function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'https://ai-sdk.dev/docs/introduction'
  if (/^https?:\/\//i.test(trimmed) || /^about:/i.test(trimmed)) {
    return trimmed
  }
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`
  }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(trimmed) && !trimmed.includes(' ')) {
    return `https://${trimmed}`
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`
}

export const InAppBrowserView: React.FC<{ isSplitMode?: boolean }> = ({ isSplitMode = false }) => {
  const {
    pages,
    activePageId,
    updatePage,
    setBrowserContextForAI,
    setActiveMainView,
    isBrowserSplitOpen,
    toggleBrowserSplitPane,
    showToast
  } = useWorkspaceStore()

  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: 'btab-1',
      title: 'AI SDK by Vercel',
      url: 'https://ai-sdk.dev/docs/introduction',
      isLoading: false
    }
  ])
  const [activeTabId, setActiveTabId] = useState('btab-1')
  const [addressInput, setAddressInput] = useState('https://ai-sdk.dev/docs/introduction')

  const webviewRefs = useRef<Record<string, WebviewElement | null>>({})

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]
  const activePage = pages.find((p) => p.id === activePageId) || pages[0]

  useEffect(() => {
    if (activeTab) {
      setAddressInput(activeTab.url)
    }
  }, [activeTabId, activeTab?.url])

  // Pasang event listener pada elemen <webview> aktif
  useEffect(() => {
    const wv = webviewRefs.current[activeTabId]
    if (!wv) return

    const onStartLoading = (): void => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, isLoading: true } : t))
      )
    }

    const onStopLoading = (): void => {
      const currentUrl = typeof wv.getURL === 'function' ? wv.getURL() : activeTab?.url || ''
      const currentTitle =
        typeof wv.getTitle === 'function' ? wv.getTitle() : activeTab?.title || 'Tab Browser'
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

    const onTitleUpdated = (e: Event & { title?: string }): void => {
      const nextTitle = e.title || (typeof wv.getTitle === 'function' ? wv.getTitle() : '')
      if (!nextTitle) return
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, title: nextTitle } : t))
      )
    }

    wv.addEventListener('did-start-loading', onStartLoading)
    wv.addEventListener('did-stop-loading', onStopLoading)
    wv.addEventListener('page-title-updated', onTitleUpdated)

    return () => {
      wv.removeEventListener('did-start-loading', onStartLoading)
      wv.removeEventListener('did-stop-loading', onStopLoading)
      wv.removeEventListener('page-title-updated', onTitleUpdated)
    }
  }, [activeTabId])

  const handleNavigate = (targetInput?: string): void => {
    const url = normalizeUrlInput(targetInput ?? addressInput)
    setAddressInput(url)
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, url, title: url } : t))
    )
    const wv = webviewRefs.current[activeTabId]
    if (wv) {
      wv.src = url
    }
  }

  const handleNewTab = (initialUrl = 'https://developer.mozilla.org'): void => {
    const newId = `btab-${Date.now()}`
    const nextTab: BrowserTab = {
      id: newId,
      title: 'New Browser Tab',
      url: initialUrl,
      isLoading: false
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

  const extractActivePageContent = async (): Promise<{
    url: string
    title: string
    excerpt: string
  }> => {
    const wv = webviewRefs.current[activeTabId]
    const fallbackUrl = activeTab?.url || addressInput
    const fallbackTitle = activeTab?.title || 'Web Reference'

    if (!wv || typeof wv.executeJavaScript !== 'function') {
      return {
        url: fallbackUrl,
        title: fallbackTitle,
        excerpt: `Referensi halaman web dari ${fallbackTitle} (${fallbackUrl}).`
      }
    }

    try {
      const extracted = (await wv.executeJavaScript(
        `(() => {
          const sel = window.getSelection ? window.getSelection().toString().trim() : '';
          const bodyText = document.body ? document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 1800) : '';
          return {
            url: location.href,
            title: document.title || location.hostname,
            excerpt: sel || bodyText
          };
        })()`
      )) as { url?: string; title?: string; excerpt?: string }

      return {
        url: extracted?.url || fallbackUrl,
        title: extracted?.title || fallbackTitle,
        excerpt:
          extracted?.excerpt || `Referensi halaman web dari ${fallbackTitle} (${fallbackUrl}).`
      }
    } catch {
      return {
        url: fallbackUrl,
        title: fallbackTitle,
        excerpt: `Referensi halaman web dari ${fallbackTitle} (${fallbackUrl}).`
      }
    }
  }

  const handleClipToActiveSpec = async (): Promise<void> => {
    if (!activePage) {
      showToast('Tidak ada halaman aktif untuk menyimpan klip')
      return
    }
    const info = await extractActivePageContent()
    const newBlocks = [
      ...activePage.blocks,
      {
        id: `blk-clip-${Date.now()}`,
        type: 'callout' as const,
        content: `🌐 Web Clip: ${info.title}\nURL: ${info.url}\n\n${info.excerpt.slice(0, 600)}`
      }
    ]
    await updatePage({ id: activePage.id, blocks: newBlocks })
    showToast(`Klip web disimpan ke halaman ${activePage.code}`)
  }

  const handleSendToAIChat = async (): Promise<void> => {
    const info = await extractActivePageContent()
    setBrowserContextForAI(info)
    if (!isSplitMode) {
      setActiveMainView('ai-chat')
    }
    showToast(`Konteks '${info.title}' dikirim ke Vercel AI SDK Chat`)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas-primary animate-view-enter">
      {/* Top Browser Tab Bar */}
      <div className="h-[34px] px-2 bg-surface-chrome border-b border-border-hairline flex items-center justify-between gap-2 select-none shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab.id
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group h-7 px-2.5 rounded-[5px] border flex items-center gap-2 text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-surface-elevated border-border-hairline text-ink-primary font-medium'
                    : 'bg-surface-chrome border-transparent text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                }`}
              >
                <Globe
                  size={11}
                  className={
                    tab.isLoading ? 'text-accent-amber animate-spin' : 'text-accent-cobalt'
                  }
                />
                <span className="truncate max-w-[140px]">{tab.title}</span>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCloseTab(tab.id)
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
            type="button"
            onClick={() => handleNewTab()}
            title="Buka Tab Browser Baru"
            className="h-6 w-6 rounded hover:bg-surface-hover flex items-center justify-center text-ink-muted hover:text-ink-primary shrink-0"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Mode Dock / Split Toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
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
                ? 'Tutup Split Browser'
                : 'Sematkan Browser di Split-Pane Kanan sambil buka Catatan'
            }
            className="h-6 px-2 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-[11px] font-mono text-ink-secondary hover:text-ink-primary flex items-center gap-1.5"
          >
            <Columns2 size={11} className="text-accent-cobalt" />
            <span>{isSplitMode ? 'Tutup Split' : 'Dock ke Split-Pane'}</span>
          </button>
        </div>
      </div>

      {/* Omnibox URL & Workbench Action Bar */}
      <div className="px-2.5 py-1.5 bg-surface-chrome/70 border-b border-border-hairline flex flex-wrap items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => webviewRefs.current[activeTabId]?.goBack?.()}
            title="Kembali"
            className="h-7 w-7 rounded hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary"
          >
            <ArrowLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => webviewRefs.current[activeTabId]?.goForward?.()}
            title="Maju"
            className="h-7 w-7 rounded hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary"
          >
            <ArrowRight size={13} />
          </button>
          <button
            type="button"
            onClick={() => webviewRefs.current[activeTabId]?.reload?.()}
            title="Muat Ulang"
            className="h-7 w-7 rounded hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary"
          >
            <RotateCw size={12} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleNavigate()
          }}
          className="flex-1 min-w-[180px]"
        >
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="Ketik URL (https://..., localhost:3000) atau kata kunci pencarian..."
            className="w-full h-7 px-3 rounded-[6px] bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-primary focus:outline-none focus:border-accent-cobalt"
          />
        </form>

        {/* NoteIT Workbench Superpowers */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleClipToActiveSpec()}
            title="Simpan teks/halaman ini sebagai blok di dokumen aktif"
            className="h-7 px-2.5 rounded-[6px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5"
          >
            <BookmarkPlus size={12} className="text-accent-amber" />
            <span className="hidden sm:inline">Clip to {activePage?.code || 'Spec'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSendToAIChat()}
            title="Kirim isi halaman web ini sebagai konteks ke Vercel AI SDK Chat"
            className="h-7 px-2.5 rounded-[6px] bg-accent-cobalt/15 hover:bg-accent-cobalt/25 border border-accent-cobalt/40 text-xs text-accent-cobalt font-medium flex items-center gap-1.5"
          >
            <Sparkles size={12} />
            <span className="hidden sm:inline">Ask AI</span>
          </button>

          <button
            type="button"
            onClick={() => webviewRefs.current[activeTabId]?.openDevTools?.()}
            title="Buka Chromium DevTools untuk tab ini"
            className="h-7 w-7 rounded-[6px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-ink-secondary hover:text-ink-primary"
          >
            <Bug size={12} />
          </button>

          <a
            href={activeTab.url}
            target="_blank"
            rel="noreferrer"
            title="Buka di Browser OS Eksternal"
            className="h-7 w-7 rounded-[6px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-ink-secondary hover:text-ink-primary"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Quick Bookmarks Bar */}
      <div className="px-3 py-1 bg-surface-chrome/40 border-b border-border-subtle flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none shrink-0">
        <span className="font-mono text-[10px] text-ink-muted uppercase mr-1">QUICK DOCS:</span>
        {QUICK_BOOKMARKS.map((bm) => (
          <button
            key={bm.label}
            type="button"
            onClick={() => handleNavigate(bm.url)}
            className="px-2 py-0.5 rounded bg-surface-elevated/70 hover:bg-surface-hover border border-border-hairline font-mono text-[10px] text-ink-secondary hover:text-ink-primary shrink-0"
          >
            {bm.label}
          </button>
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
            src={tab.url}
            partition="persist:noteit-browser"
            allowpopups={true}
            className={`w-full h-full border-0 ${
              tab.id === activeTab.id ? 'flex' : 'hidden'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
