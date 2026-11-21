import React, { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui'

/**
 * Overflow menu button + popover containing all open tabs.
 * Rendered by App only when the tab strip overflows horizontally.
 */
export const TabOverflowMenu: React.FC = () => {
  const { openTabIds, activePageId, pages, openPageInTab, closeTab, dirtyPageIds } =
    useWorkspaceStore()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="All open tabs"
          aria-label="All open tabs"
          className={`h-7 w-7 rounded-[7px] flex items-center justify-center transition-colors shrink-0 ${
            isOpen
              ? 'bg-surface-hover text-ink-primary'
              : 'text-ink-muted hover:text-ink-primary hover:bg-surface-hover/70'
          }`}
        >
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-64 max-h-80 overflow-y-auto p-1.5">
        <ul aria-label="Open tabs" className="space-y-0.5">
          {openTabIds.map((tabId) => {
            const tabPage = pages.find((p) => p.id === tabId)
            if (!tabPage) return null
            const isActive = tabId === activePageId
            const isDirty = dirtyPageIds.includes(tabId)
            return (
              <li
                key={tabId}
                className={`group rounded-[7px] flex items-center gap-1 text-xs transition-colors hover:bg-surface-hover ${
                  isActive ? 'bg-surface-hover/80 text-ink-primary font-medium' : 'text-ink-secondary'
                }`}
              >
                <button
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    openPageInTab(tabId)
                    setIsOpen(false)
                  }}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-left flex items-center gap-2 rounded-l-[7px]"
                >
                  <span aria-hidden="true">{tabPage.icon}</span>
                  <span className="truncate flex-1">{tabPage.title}</span>
                  {isDirty && (
                    <span
                      role="img"
                      title="Unsaved changes"
                      aria-label="Unsaved changes"
                      className="w-1.5 h-1.5 rounded-full bg-accent-amber shrink-0"
                    />
                  )}
                  <span className="font-mono text-[10px] text-ink-muted shrink-0">
                    {tabPage.code}
                  </span>
                </button>
                {openTabIds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => closeTab(tabId)}
                    aria-label={`Close ${tabPage.title}`}
                    title={`Close ${tabPage.title}`}
                    className="p-1.5 mr-0.5 rounded-[5px] opacity-40 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[#EF4444] text-ink-muted transition-opacity shrink-0"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
