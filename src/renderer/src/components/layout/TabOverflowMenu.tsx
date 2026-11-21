import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'

/**
 * Tombol chevron + dropdown berisi semua tab.
 * Hanya dirender App saat strip tab benar-benar overflow (scrollWidth > clientWidth),
 * jadi tab bar yang lega tidak kehilangan ruang.
 */
export const TabOverflowMenu: React.FC = () => {
  const { openTabIds, activePageId, pages, openPageInTab, closeTab, dirtyPageIds } =
    useWorkspaceStore()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e: MouseEvent): void => {
      if (rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target)) return
      setIsOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        title="Semua Tab"
        aria-label="Semua Tab"
        className={`h-7 w-7 rounded-[7px] flex items-center justify-center transition-colors ${
          isOpen ? 'bg-surface-hover text-ink-primary' : 'text-ink-muted hover:text-ink-primary hover:bg-surface-hover/70'
        }`}
      >
        <ChevronDown size={13} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 z-50 w-64 max-h-80 overflow-y-auto p-1.5 rounded-[10px] bg-surface-elevated border border-border-hairline shadow-popover animate-popover-enter space-y-0.5">
          {openTabIds.map((tabId) => {
            const tabPage = pages.find((p) => p.id === tabId)
            if (!tabPage) return null
            const isActive = tabId === activePageId
            const isDirty = dirtyPageIds.includes(tabId)
            return (
              <div
                key={tabId}
                className={`group px-2.5 py-1.5 rounded-[7px] flex items-center gap-2 text-xs cursor-pointer transition-colors hover:bg-surface-hover ${
                  isActive ? 'bg-surface-hover/80 text-ink-primary font-medium' : 'text-ink-secondary'
                }`}
                onClick={() => {
                  openPageInTab(tabId)
                  setIsOpen(false)
                }}
              >
                <span>{tabPage.icon}</span>
                <span className="truncate flex-1">{tabPage.title}</span>
                {isDirty && (
                  <span
                    title="Belum tersimpan"
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
                    className="opacity-0 group-hover:opacity-100 hover:text-[#EF4444] text-ink-muted"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
