import React, { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  Plus,
  Radio,
  Terminal as TerminalIcon,
  X,
  Zap
} from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '@renderer/stores/useTerminalStore'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui'
import type { BlockType, DocumentBlock } from '@shared/types/domain'

export const BottomTerminalDrawer: React.FC = () => {
  const {
    isOpen,
    height,
    tabs,
    activeTabId,
    presets,
    closeDrawer,
    setHeight,
    createSession,
    closeSession,
    setActiveTabId,
    loadPresets,
    appendBuffer,
    updateDetectedState
  } = useTerminalStore()

  const { activePageId, pages, updatePage, showToast, notebooks, activeNotebookId, sections } =
    useWorkspaceStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const skipTermFocusRef = useRef(false)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const termInstanceRef = useRef<{
    term: Terminal
    fit: FitAddon
    sessionId: string | null
  } | null>(null)

  const [isResizing, setIsResizing] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  // Ambil CWD saat ini berdasarkan notebook yang aktif
  const currentNotebook = notebooks.find((nb) => nb.id === activeNotebookId) || notebooks[0]
  const activePage = pages.find((p) => p.id === activePageId)
  const activeSection = sections.find((s) => s.id === activePage?.sectionId)
  const currentRepoPath = activeSection?.repoPathOverride || currentNotebook?.repoPath || ''

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  // Inisialisasi xterm instance tunggal yang di-reuse antar tab
  // Background PTY listeners live independently of the drawer so output keeps buffering while closed.
  useEffect(() => {
    const unsubData = window.noteitAPI.onTerminalData(({ sessionId, data }) => {
      appendBuffer(sessionId, data)
      const inst = termInstanceRef.current
      if (inst && useTerminalStore.getState().activeTabId === sessionId) {
        inst.term.write(data)
      }
    })
    const unsubExit = window.noteitAPI.onTerminalExit(({ sessionId, exitCode }) => {
      const inst = termInstanceRef.current
      if (inst && useTerminalStore.getState().activeTabId === sessionId) {
        inst.term.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
      }
    })
    const unsubState = window.noteitAPI.onTerminalStateChange(({ sessionId, state }) => {
      updateDetectedState(sessionId, state)
    })
    return () => {
      unsubData()
      unsubExit()
      unsubState()
    }
  }, [appendBuffer, updateDetectedState])

  // The xterm instance is created when the drawer opens and disposed when it closes.
  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    const term = new Terminal({
      theme: {
        background: '#0E0E11',
        foreground: '#EDEDEF',
        cursor: '#6E7BF2',
        cursorAccent: '#0E0E11',
        selectionBackground: 'rgba(110, 123, 242, 0.30)',
        black: '#141417',
        red: '#F87171',
        green: '#2DD4BF',
        yellow: '#E5A93C',
        blue: '#6E7BF2',
        magenta: '#A78BFA',
        cyan: '#5EEAD4',
        white: '#EDEDEF',
        brightBlack: '#787886',
        brightRed: '#FCA5A5',
        brightGreen: '#5EEAD4',
        brightYellow: '#F2C46D',
        brightBlue: '#A2ACFA',
        brightMagenta: '#C4B5FD',
        brightCyan: '#99F6E4',
        brightWhite: '#FFFFFF'
      },
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      cursorBlink: true,
      allowTransparency: true,
      convertEol: true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    // Coba pasang WebGL addon untuk akselerasi GPU 60fps
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => webglAddon.dispose())
      term.loadAddon(webglAddon)
    } catch {
      // Fallback ke canvas bawaan xterm
    }

    termInstanceRef.current = {
      term,
      fit: fitAddon,
      sessionId: null
    }

    // Sambungkan input keyboard terminal ke IPC main process
    term.onData((data) => {
      const currentSessId = useTerminalStore.getState().activeTabId
      if (currentSessId) {
        window.noteitAPI.writeTerminal({ sessionId: currentSessId, data })
      }
    })

    // Resize observer untuk container
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        const currentSessId = useTerminalStore.getState().activeTabId
        if (currentSessId && term.cols > 0 && term.rows > 0) {
          window.noteitAPI.resizeTerminal({
            sessionId: currentSessId,
            cols: term.cols,
            rows: term.rows
          })
        }
      } catch {
        // Ignored
      }
    })

    resizeObserver.observe(containerRef.current)

    // Replay the active tab's buffer into the freshly created terminal.
    const currentActive = useTerminalStore.getState().activeTabId
    if (currentActive) {
      termInstanceRef.current.sessionId = currentActive
      const tab = tabsRef.current.find((t) => t.id === currentActive)
      if (tab?.bufferText) term.write(tab.bufferText)
      setTimeout(() => {
        try {
          fitAddon.fit()
          if (skipTermFocusRef.current) skipTermFocusRef.current = false
          else term.focus()
        } catch {
          // Ignored
        }
      }, 50)
    }

    return () => {
      resizeObserver.disconnect()
      term.dispose()
      termInstanceRef.current = null
    }
  }, [isOpen])

  // Saat activeTabId berubah, muat ulang buffer teks ke xterm
  useEffect(() => {
    const inst = termInstanceRef.current
    if (!activeTabId || !isOpen) skipTermFocusRef.current = false
    if (!inst) return

    inst.sessionId = activeTabId
    inst.term.reset()

    if (!activeTabId) return

    const activeTab = tabsRef.current.find((t) => t.id === activeTabId)
    if (activeTab && activeTab.bufferText) {
      inst.term.write(activeTab.bufferText)
    }

    const timer = setTimeout(() => {
      try {
        inst.fit.fit()
        if (skipTermFocusRef.current) {
          skipTermFocusRef.current = false
        } else {
          inst.term.focus()
        }
        if (inst.term.cols > 0 && inst.term.rows > 0) {
          window.noteitAPI.resizeTerminal({
            sessionId: activeTabId,
            cols: inst.term.cols,
            rows: inst.term.rows
          })
        }
      } catch {
        // Ignored
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [activeTabId, isOpen])

  // Handle Resize Bar via pointer capture
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsResizing(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isResizing) return
    const newHeight = window.innerHeight - e.clientY
    setHeight(newHeight)
    termInstanceRef.current?.fit.fit()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setIsResizing(false)
  }

  // Aksi: Capture Error to Spec (mengambil error log terakhir & masukkan sebagai callout di active page)
  const handleCaptureErrorToSpec = async (): Promise<void> => {
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab || !activeTab.bufferText) {
      showToast('Tidak ada buffer teks terminal untuk disalin.')
      return
    }

    const currentPage = pages.find((p) => p.id === activePageId)
    if (!currentPage) {
      showToast('Buka halaman dokumen terlebih dahulu.')
      return
    }

    // Ambil baris-baris terakhir (maks 40 baris)
    const lines = activeTab.bufferText.split(/\r?\n/)
    const tailLines = lines.slice(-40).filter((l) => l.trim().length > 0)
    const cleanContent = tailLines.join('\n').slice(-2500)

    const newBlock: DocumentBlock = {
      id: `blk-err-${Date.now()}`,
      type: 'callout' as BlockType,
      calloutTitle: `Terminal Trace (${activeTab.title})`,
      calloutColor: 'red',
      content: cleanContent || 'Tidak ada error teks yang tertangkap.'
    }

    const nextBlocks = [...currentPage.blocks, newBlock]
    await updatePage({ id: currentPage.id, blocks: nextBlocks })
    showToast('Cuplikan error terminal disematkan ke halaman spesifikasi!')
  }

  // Helper membuat tab baru
  const handleLaunchPreset = async (command?: string, args?: string[], title?: string, presetId?: string) => {
    skipTermFocusRef.current = false
    await createSession({
      cwd: currentRepoPath || process.cwd(),
      command,
      args,
      title,
      cliPresetId: presetId
    })
  }

  if (!isOpen) return null

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number): void => {
    if (tabs.length === 0) return
    let nextIdx: number | null = null

    if (e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % tabs.length
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      nextIdx = 0
    } else if (e.key === 'End') {
      nextIdx = tabs.length - 1
    }

    if (nextIdx !== null) {
      e.preventDefault()
      const nextTab = tabs[nextIdx]
      if (nextTab && nextTab.id !== activeTabId) {
        skipTermFocusRef.current = true
        setActiveTabId(nextTab.id)
      }
      tabRefs.current[nextIdx]?.focus()
    }
  }

  return (
    <aside
      id="ade-terminal-drawer"
      aria-label="Terminal Drawer ADE"
      style={{ height: isMaximized ? 'calc(100vh - 72px)' : `${height}px` }}
      className="w-full bg-surface-chrome border-t border-border-hairline flex flex-col shrink-0 z-40 select-none transition-[height] duration-75 relative shadow-popover"
    >
      {/* Draggable Top Resize Handle */}
      <div
        role="separator"
        aria-orientation="horizontal"
        title="Geser untuk mengubah tinggi terminal, double-click untuk reset (280px)"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setIsResizing(false)}
        onDoubleClick={() => setHeight(280)}
        className={`h-1.5 w-full cursor-row-resize flex items-center justify-center transition-colors ${
          isResizing ? 'bg-accent-cobalt' : 'bg-transparent hover:bg-accent-cobalt/50'
        }`}
      >
        <span className="w-10 h-0.5 rounded-full bg-border-strong opacity-60" />
      </div>

      {/* Terminal Header Strip */}
      <div className="h-9 bg-canvas-primary border-b border-border-hairline flex items-center justify-between px-3 gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 text-ink-secondary pr-2.5 border-r border-border-hairline shrink-0">
            <TerminalIcon size={13} className="text-accent-cobalt" />
            <span className="font-medium text-xs text-ink-primary">Terminal</span>
          </div>

          {/* Session Tabs (display: contents tablist keeps role="tab" direct semantic children while aligning close buttons) */}
          <div className="flex items-center">
            <div role="tablist" aria-label="Terminal sessions" className="contents">
              {tabs.map((tab, idx) => {
                const isActive = tab.id === activeTabId
                const isWaiting = tab.detectedState === 'waiting_approval'
                const isTesting = tab.detectedState === 'running_tests'

                return (
                  <button
                    key={tab.id}
                    id={`terminal-tab-${tab.id}`}
                    ref={(el) => {
                      tabRefs.current[idx] = el
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="terminal-tabpanel"
                    tabIndex={isActive ? 0 : -1}
                    style={{ order: idx * 2 }}
                    onClick={() => {
                      skipTermFocusRef.current = false
                      setActiveTabId(tab.id)
                    }}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    className={`h-6 pl-2.5 pr-1.5 rounded-l-[6px] border-y border-l flex items-center gap-2 text-[11.5px] transition-colors shrink-0 ${
                      isActive
                        ? 'bg-surface-elevated border-border-hairline text-ink-primary font-medium'
                        : 'bg-transparent border-transparent text-ink-muted hover:bg-surface-hover hover:text-ink-secondary'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isWaiting
                          ? 'bg-accent-amber animate-pulse'
                          : isTesting
                            ? 'bg-accent-cobalt animate-pulse'
                            : 'bg-accent-emerald'
                      }`}
                      title={`Status: ${tab.detectedState || 'active'}`}
                      aria-hidden="true"
                    />

                    <span className="truncate max-w-[140px]">{tab.title}</span>

                    {isWaiting && (
                      <span className="font-mono text-[10px] text-accent-amber font-semibold">
                        [y/n]
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {tabs.map((tab, idx) => {
              const isActive = tab.id === activeTabId
              return (
                <button
                  key={`${tab.id}-close`}
                  type="button"
                  style={{ order: idx * 2 + 1 }}
                  onClick={() => closeSession(tab.id)}
                  title="Close terminal session"
                  aria-label={`Close ${tab.title}`}
                  className={`h-6 pr-2 pl-0.5 mr-1.5 rounded-r-[6px] border-y border-r flex items-center justify-center text-ink-muted hover:text-accent-rose transition-colors shrink-0 ${
                    isActive
                      ? 'bg-surface-elevated border-border-hairline'
                      : 'bg-transparent border-transparent hover:bg-surface-hover'
                  }`}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              )
            })}
          </div>

          {/* New Tab Dropdown Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Open new terminal session"
                aria-label="Open new terminal session"
                className="h-6 px-2 rounded-[6px] hover:bg-surface-hover flex items-center gap-1 text-ink-secondary hover:text-ink-primary border border-border-hairline transition-colors shrink-0 data-[state=open]:bg-surface-hover data-[state=open]:text-ink-primary"
              >
                <Plus size={12} aria-hidden="true" />
                <span className="text-[11.5px] font-medium">New</span>
                <ChevronDown size={10.5} className="opacity-60" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56">
              <DropdownMenuLabel>Shell &amp; CLI presets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => void handleLaunchPreset(undefined, undefined, 'PowerShell', 'pwsh')}
              >
                <span>PowerShell</span>
                <span className="font-mono text-[10px] text-ink-muted">Default</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void handleLaunchPreset('cmd.exe', undefined, 'Command Prompt', 'cmd')}
              >
                <span>CMD.exe</span>
                <span className="font-mono text-[10px] text-ink-muted">Windows</span>
              </DropdownMenuItem>
              {presets
                .filter((p) => p.available && !['pwsh', 'cmd'].includes(p.id))
                .map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => void handleLaunchPreset(p.command, undefined, p.name, p.id)}
                  >
                    <span className="flex items-center gap-1.5">
                      <Zap size={11} className="text-accent-amber" aria-hidden="true" />
                      <span>{p.name}</span>
                    </span>
                    <span className="text-[10.5px] text-[var(--pill-teal-text)]">Ready</span>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Drawer Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeTab && (
            <button
              type="button"
              onClick={handleCaptureErrorToSpec}
              title="Append latest terminal error trace to active spec"
              className="h-6 px-2.5 rounded-[6px] bg-[var(--pill-red-bg)] hover:brightness-110 text-[var(--pill-red-text)] border border-[var(--pill-red-border)] flex items-center gap-1.5 text-[11px] font-medium transition-all"
            >
              <Radio size={11} aria-hidden="true" />
              <span>Capture error</span>
            </button>
          )}

          {currentRepoPath && (
            <span
              title={`CWD: ${currentRepoPath}`}
              className="font-mono text-[10.5px] text-ink-muted truncate max-w-[200px] hidden md:inline px-2 py-0.5 rounded-[6px] bg-surface-elevated border border-border-hairline"
            >
              {currentRepoPath.split(/[/\\]/).pop()}
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore terminal drawer height' : 'Maximize terminal drawer'}
            aria-label={isMaximized ? 'Restore terminal drawer height' : 'Maximize terminal drawer'}
            aria-pressed={isMaximized}
            className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary transition-colors"
          >
            {isMaximized ? (
              <Minimize2 size={12.5} aria-hidden="true" />
            ) : (
              <Maximize2 size={12.5} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={closeDrawer}
            title="Close terminal drawer (Ctrl+`)"
            aria-label="Close terminal drawer"
            className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary transition-colors"
          >
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        id="terminal-tabpanel"
        role="tabpanel"
        aria-labelledby={activeTab ? `terminal-tab-${activeTab.id}` : undefined}
        className="flex-1 w-full h-full overflow-hidden relative p-1.5 bg-surface-chrome"
      >
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </aside>
  )
}
