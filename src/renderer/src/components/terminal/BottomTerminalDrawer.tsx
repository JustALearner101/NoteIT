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
  const termInstanceRef = useRef<{
    term: Terminal
    fit: FitAddon
    sessionId: string | null
  } | null>(null)

  const [isResizing, setIsResizing] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false)

  // Ambil CWD saat ini berdasarkan notebook yang aktif
  const currentNotebook = notebooks.find((nb) => nb.id === activeNotebookId) || notebooks[0]
  const activePage = pages.find((p) => p.id === activePageId)
  const activeSection = sections.find((s) => s.id === activePage?.sectionId)
  const currentRepoPath = activeSection?.repoPathOverride || currentNotebook?.repoPath || ''

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  // Inisialisasi xterm instance tunggal yang di-reuse antar tab
  useEffect(() => {
    if (!containerRef.current) return

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

    // Listener IPC data stream dari backend PTY
    const unsubData = window.noteitAPI.onTerminalData(({ sessionId, data }) => {
      appendBuffer(sessionId, data)
      if (useTerminalStore.getState().activeTabId === sessionId) {
        term.write(data)
      }
    })

    const unsubExit = window.noteitAPI.onTerminalExit(({ sessionId, exitCode }) => {
      if (useTerminalStore.getState().activeTabId === sessionId) {
        term.write(`\r\n\x1b[90m[Proses selesai dengan kode keluar ${exitCode}]\x1b[0m\r\n`)
      }
    })

    const unsubState = window.noteitAPI.onTerminalStateChange(({ sessionId, state }) => {
      updateDetectedState(sessionId, state)
    })

    return () => {
      resizeObserver.disconnect()
      unsubData()
      unsubExit()
      unsubState()
      term.dispose()
      termInstanceRef.current = null
    }
  }, [appendBuffer, updateDetectedState])

  // Saat activeTabId berubah, muat ulang buffer teks ke xterm
  useEffect(() => {
    const inst = termInstanceRef.current
    if (!inst) return

    inst.sessionId = activeTabId
    inst.term.reset()

    if (activeTabId) {
      const activeTab = tabs.find((t) => t.id === activeTabId)
      if (activeTab && activeTab.bufferText) {
        inst.term.write(activeTab.bufferText)
      }
      setTimeout(() => {
        try {
          inst.fit.fit()
          inst.term.focus()
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
    }
  }, [activeTabId, tabs])

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
    setIsPresetMenuOpen(false)
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

  return (
    <aside
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

          {/* Session Tabs */}
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const isWaiting = tab.detectedState === 'waiting_approval'
            const isTesting = tab.detectedState === 'running_tests'

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group h-6 px-2.5 rounded-[6px] border flex items-center gap-2 cursor-pointer text-[11.5px] transition-colors ${
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
                />

                <span className="truncate max-w-[140px]">{tab.title}</span>

                {isWaiting && (
                  <span className="font-mono text-[10px] text-accent-amber font-semibold">
                    [y/n]
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeSession(tab.id)
                  }}
                  title="Tutup Sesi Terminal"
                  className="opacity-40 group-hover:opacity-100 hover:text-accent-rose ml-0.5"
                >
                  <X size={11} />
                </button>
              </div>
            )
          })}

          {/* New Tab Dropdown Button */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
              title="Buka Sesi Terminal Baru"
              className="h-6 px-2 rounded-[6px] hover:bg-surface-hover flex items-center gap-1 text-ink-secondary hover:text-ink-primary border border-border-hairline transition-colors"
            >
              <Plus size={12} />
              <span className="text-[11.5px] font-medium">New</span>
              <ChevronDown size={10.5} className="opacity-60" />
            </button>

            {isPresetMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-50"
                  onClick={() => setIsPresetMenuOpen(false)}
                />
                <div className="absolute top-7 left-0 z-50 w-56 bg-surface-elevated border border-border-hairline rounded-[10px] shadow-popover p-1.5 flex flex-col gap-0.5 animate-popover-enter">
                  <div className="px-2 py-1 text-[10.5px] font-medium text-ink-muted border-b border-border-subtle mb-1">
                    Shell &amp; CLI presets
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLaunchPreset(undefined, undefined, 'PowerShell', 'pwsh')}
                    className="w-full px-2 py-1.5 text-left text-xs rounded-[7px] hover:bg-surface-hover flex items-center justify-between text-ink-primary transition-colors"
                  >
                    <span>PowerShell</span>
                    <span className="font-mono text-[10px] text-ink-muted">Default</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLaunchPreset('cmd.exe', undefined, 'Command Prompt', 'cmd')}
                    className="w-full px-2 py-1.5 text-left text-xs rounded-[7px] hover:bg-surface-hover flex items-center justify-between text-ink-primary transition-colors"
                  >
                    <span>CMD.exe</span>
                    <span className="font-mono text-[10px] text-ink-muted">Windows</span>
                  </button>

                  {presets
                    .filter((p) => p.available && !['pwsh', 'cmd'].includes(p.id))
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleLaunchPreset(p.command, undefined, p.name, p.id)}
                        className="w-full px-2 py-1.5 text-left text-xs rounded-[7px] hover:bg-surface-hover flex items-center justify-between text-ink-primary transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <Zap size={11} className="text-accent-amber" />
                          <span>{p.name}</span>
                        </div>
                        <span className="text-[10.5px] text-[var(--pill-teal-text)]">Ready</span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Drawer Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeTab && (
            <button
              type="button"
              onClick={handleCaptureErrorToSpec}
              title="Salin potongan error/trace terminal terakhir ke dokumen spec aktif"
              className="h-6 px-2.5 rounded-[6px] bg-[var(--pill-red-bg)] hover:brightness-110 text-[var(--pill-red-text)] border border-[var(--pill-red-border)] flex items-center gap-1.5 text-[11px] font-medium transition-all"
            >
              <Radio size={11} />
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
            title={isMaximized ? 'Pulihkan Ukuran Drawer' : 'Maksimalkan Drawer Terminal'}
            className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary transition-colors"
          >
            {isMaximized ? <Minimize2 size={12.5} /> : <Maximize2 size={12.5} />}
          </button>

          <button
            type="button"
            onClick={closeDrawer}
            title="Tutup Drawer Terminal (Ctrl+`)"
            className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary transition-colors"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 w-full h-full overflow-hidden relative p-1.5 bg-surface-chrome">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </aside>
  )
}
