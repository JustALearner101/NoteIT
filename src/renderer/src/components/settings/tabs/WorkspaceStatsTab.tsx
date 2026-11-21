import React, { useMemo } from 'react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'

export const WorkspaceStatsTab: React.FC = () => {
  const { notebooks, sections, pages, tags } = useWorkspaceStore()

  const totalBlocks = useMemo(() => pages.reduce((acc, p) => acc + p.blocks.length, 0), [pages])
  const totalWords = useMemo(
    () =>
      pages.reduce((acc, p) => {
        const text = p.blocks.map((b) => b.content).join(' ')
        return acc + text.trim().split(/\s+/).filter(Boolean).length
      }, 0),
    [pages]
  )

  const metrics: [string, number][] = [
    ['Notebooks', notebooks.length],
    ['Sections', sections.length],
    ['Total pages', pages.length],
    ['Total blocks', totalBlocks],
    ['Estimated words', totalWords],
    ['Indexed tags', tags.length]
  ]

  return (
    <div className="space-y-6 animate-view-enter">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-primary">Stats &amp; usage</h1>
        <p className="text-xs text-ink-secondary mt-1">
          Real-time usage metrics for your local NoteIT workspace.
        </p>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="p-4 rounded-xl bg-surface-elevated border border-border-hairline">
            <dt className="font-mono text-[10px] text-ink-muted uppercase">{label}</dt>
            <dd className="font-display text-2xl font-bold text-ink-primary mt-1 tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
