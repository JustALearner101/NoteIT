import React from 'react'
import { getShortcutsByCategory } from '@renderer/lib/shortcuts'
import { Kbd } from '@renderer/components/ui'

export const ShortcutsTab: React.FC = () => {
  const groups = getShortcutsByCategory()

  return (
    <div className="space-y-6 animate-view-enter">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-primary">Keyboard shortcuts</h1>
        <p className="text-xs text-ink-secondary mt-1">
          Global and local shortcuts for fast navigation without leaving the keyboard.
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.category} aria-label={group.label} className="space-y-2">
          <h2 className="text-[11px] font-medium text-ink-muted px-1">{group.label}</h2>
          <ul className="rounded-[12px] bg-surface-elevated border border-border-hairline overflow-hidden divide-y divide-border-subtle">
            {group.items.map((item) => (
              <li
                key={item.id}
                className="px-4 py-3 flex items-center justify-between gap-4 text-xs hover:bg-surface-hover/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-ink-primary font-medium">{item.label}</div>
                  <div className="text-[11px] text-ink-secondary">{item.description}</div>
                </div>
                <Kbd className="px-2 py-0.5 text-[11px] text-ink-secondary shrink-0">{item.keys}</Kbd>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
