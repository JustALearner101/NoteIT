import React from 'react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'

export const NotebookSettingsTab: React.FC<{ notebookId: string }> = ({ notebookId }) => {
  const { notebooks, sections, pages } = useWorkspaceStore()
  const nb = notebooks.find((n) => n.id === notebookId) || notebooks[0]
  if (!nb) return null

  const nbSections = sections.filter((s) => s.notebookId === nb.id)
  const nbPages = pages.filter((p) => nbSections.some((s) => s.id === p.sectionId))

  return (
    <div className="space-y-6 animate-view-enter">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="text-xl" aria-hidden="true">
            {nb.icon}
          </span>
          <h1 className="font-display text-xl font-bold text-ink-primary">{nb.name}</h1>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-elevated border border-border-hairline text-accent-cobalt">
            Project notebook
          </span>
        </div>
        <p className="text-xs text-ink-secondary mt-1">
          Project-specific configuration and a summary of this notebook&apos;s document hierarchy.
        </p>
        {nb.repoPath && (
          <p className="font-mono text-[11px] text-ink-muted mt-1 break-all">
            Bound repository: {nb.repoPath}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-surface-elevated border border-border-hairline">
          <dt className="font-mono text-[10px] text-ink-muted uppercase">Sections</dt>
          <dd className="font-display text-2xl font-bold text-ink-primary mt-1">{nbSections.length}</dd>
        </div>
        <div className="p-4 rounded-lg bg-surface-elevated border border-border-hairline">
          <dt className="font-mono text-[10px] text-ink-muted uppercase">Total pages</dt>
          <dd className="font-display text-2xl font-bold text-ink-primary mt-1">{nbPages.length}</dd>
        </div>
        <div className="p-4 rounded-lg bg-surface-elevated border border-border-hairline">
          <dt className="font-mono text-[10px] text-ink-muted uppercase">Marker color</dt>
          <dd className="font-mono text-sm font-semibold text-ink-primary mt-2 uppercase flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${MARKER_META[nb.color].bgStrip}`} aria-hidden="true" />
            <span>{nb.color}</span>
          </dd>
        </div>
      </dl>

      <section className="p-4 rounded-lg bg-surface-elevated border border-border-hairline space-y-3">
        <h2 className="font-display text-sm font-semibold text-ink-primary">
          Sections in {nb.name}
        </h2>
        <ul className="divide-y divide-border-subtle">
          {nbSections.map((sec) => {
            const count = nbPages.filter((p) => p.sectionId === sec.id).length
            return (
              <li key={sec.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-4 rounded-full ${MARKER_META[sec.color].bgStrip}`} aria-hidden="true" />
                  <span className="font-medium text-ink-primary">{sec.name}</span>
                  <span className="font-mono text-[10px] text-ink-muted">{sec.code}</span>
                </div>
                <span className="font-mono text-[11px] text-ink-secondary">
                  {count} {count === 1 ? 'page' : 'pages'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
