import React, { useMemo, useState } from 'react'
import { Keyboard, Search } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { getShortcutsByCategory } from '@renderer/lib/shortcuts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Kbd
} from '@renderer/components/ui'

export const ShortcutCheatsheetModal: React.FC = () => {
  const { isShortcutCheatsheetOpen, setShortcutCheatsheetOpen } = useWorkspaceStore()
  const [filterQuery, setFilterQuery] = useState('')

  const categories = useMemo(() => {
    const groups = getShortcutsByCategory()
    const q = filterQuery.trim().toLowerCase()
    if (!q) return groups

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.keys.toLowerCase().includes(q)
        )
      }))
      .filter((group) => group.items.length > 0)
  }, [filterQuery])

  return (
    <Dialog
      open={isShortcutCheatsheetOpen}
      onOpenChange={(open) => {
        if (!open) setFilterQuery('')
        setShortcutCheatsheetOpen(open)
      }}
    >
      <DialogContent size="xl" className="max-w-3xl p-0 overflow-hidden select-none">
        <DialogHeader className="px-5 pt-4 pb-3 bg-surface-chrome/90 border-b border-border-hairline space-y-2.5">
          <div className="flex items-center justify-between pr-7">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[7px] bg-[var(--pill-cobalt-bg)] border border-[var(--pill-cobalt-border)] flex items-center justify-center text-[var(--pill-cobalt-text)]">
                <Keyboard size={14} aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="pr-0">Keyboard Shortcuts</DialogTitle>
                <DialogDescription>
                  Global desktop and workspace shortcuts across NoteIT.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <span>Press</span>
              <Kbd>Esc</Kbd>
              <span>to close</span>
            </div>
          </div>

          <div className="relative">
            <Search
              size={13}
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter shortcuts by action or key..."
              aria-label="Filter shortcuts"
              className="w-full h-8 pl-8 pr-3 rounded-[8px] bg-surface-elevated border border-border-hairline text-xs text-ink-primary placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cobalt"
            />
          </div>
        </DialogHeader>

        <div className="p-4 max-h-[68vh] overflow-y-auto">
          {categories.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-secondary">
              No shortcuts match{' '}
              <span className="font-mono text-accent-amber">&quot;{filterQuery}&quot;</span>.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map((group) => (
                <section
                  key={group.category}
                  aria-label={group.label}
                  className="rounded-[10px] bg-surface-chrome/60 border border-border-hairline overflow-hidden"
                >
                  <div className="px-3.5 py-2 border-b border-border-subtle bg-surface-chrome text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                    {group.label}
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-ink-primary truncate">{item.label}</div>
                          <div className="text-[11px] text-ink-muted truncate">
                            {item.description}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.keyTokens.map((token, idx) => (
                            <React.Fragment key={`${item.id}-tok-${token}`}>
                              {idx > 0 && <span className="text-[10px] text-ink-muted">+</span>}
                              <Kbd className="px-1.5 py-0.5 text-[10.5px]">{token}</Kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
