import React, { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, ChevronsRight, Columns2, X, XCircle } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'

interface TabContextMenuProps {
  pageId: string
  x: number
  y: number
  onClose: () => void
}

const MENU_WIDTH = 208
const MENU_HEIGHT = 228

/**
 * Context menu tab. Gaya mengikuti overlay CommandPalette (fixed, hairline,
 * surface-elevated) supaya terasa satu sistem dengan chrome lain.
 */
export const TabContextMenu: React.FC<TabContextMenuProps> = ({ pageId, x, y, onClose }) => {
  const {
    openTabIds,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    reorderTabs,
    toggleSplitPane
  } = useWorkspaceStore()

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent): void => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return
      onClose()
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const index = openTabIds.indexOf(pageId)
  const isOnlyTab = openTabIds.length <= 1
  const isLast = index === openTabIds.length - 1

  // Jangan biarkan menu keluar viewport saat tab diklik di ujung kanan/bawah.
  const left = Math.max(4, Math.min(x, window.innerWidth - MENU_WIDTH - 4))
  const top = Math.max(4, Math.min(y, window.innerHeight - MENU_HEIGHT - 4))

  const itemClass =
    'w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs text-ink-secondary hover:bg-surface-hover hover:text-ink-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-secondary disabled:cursor-default'

  const run = (action: () => void): void => {
    action()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      data-tab-context-menu
      style={{ left, top }}
      className="fixed z-50 w-52 py-1 rounded-[6px] bg-surface-elevated border border-border-hairline shadow-2xl select-none animate-popover-enter"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        role="menuitem"
        disabled={isOnlyTab}
        onClick={() => run(() => closeTab(pageId))}
        className={itemClass}
      >
        <X size={12} />
        <span>Close</span>
      </button>
      <button
        role="menuitem"
        disabled={isOnlyTab}
        onClick={() => run(() => closeOtherTabs(pageId))}
        className={itemClass}
      >
        <XCircle size={12} />
        <span>Close Others</span>
      </button>
      <button
        role="menuitem"
        disabled={isLast}
        onClick={() => run(() => closeTabsToRight(pageId))}
        className={itemClass}
      >
        <ChevronsRight size={12} />
        <span>Close to the Right</span>
      </button>

      <div className="my-1 border-t border-border-subtle" />

      <button
        role="menuitem"
        disabled={index <= 0}
        onClick={() =>
          run(() => {
            const prev = openTabIds[index - 1]
            if (prev) reorderTabs(pageId, prev)
          })
        }
        className={itemClass}
      >
        <ChevronLeft size={12} />
        <span>Move Left</span>
      </button>
      <button
        role="menuitem"
        disabled={isLast}
        onClick={() =>
          run(() => {
            const next = openTabIds[index + 1]
            if (next) reorderTabs(pageId, next)
          })
        }
        className={itemClass}
      >
        <ChevronRight size={12} />
        <span>Move Right</span>
      </button>

      <div className="my-1 border-t border-border-subtle" />

      <button
        role="menuitem"
        onClick={() => run(() => toggleSplitPane(pageId))}
        className={itemClass}
      >
        <Columns2 size={12} />
        <span>Open in Split</span>
      </button>
    </div>
  )
}
