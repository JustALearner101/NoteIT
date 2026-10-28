import React from 'react'
import type { TaskStatus } from '@shared/types/domain'
import { MARKER_META } from '@renderer/lib/marker-colors'
import type { DatabaseViewProps } from './types'

export const KanbanView: React.FC<DatabaseViewProps> = ({ items, updateTask }) => {
  return (
    <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3 bg-canvas-primary">
      {(
        [
          { id: 'backlog', label: 'BACKLOG' },
          { id: 'in_progress', label: 'IN PROGRESS' },
          { id: 'review', label: 'IN REVIEW' },
          { id: 'done', label: 'COMPLETED' }
        ] as { id: TaskStatus; label: string }[]
      ).map((col) => {
        const colItems = items.filter((i) => i.status === col.id)
        return (
          <div
            key={col.id}
            className="rounded-[6px] bg-surface-chrome border border-border-hairline p-2 flex flex-col gap-2 min-h-[260px]"
          >
            <div className="flex items-center justify-between px-1 pb-1.5 border-b border-border-subtle font-mono text-[11px]">
              <span className="font-semibold text-ink-primary">{col.label}</span>
              <span className="px-1.5 py-0.2 rounded bg-surface-elevated text-ink-muted">
                {colItems.length}
              </span>
            </div>

            {colItems.map((item) => {
              const marker = MARKER_META[item.color]
              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-[6px] bg-surface-elevated border border-border-hairline space-y-2"
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className={`px-1.5 py-0.2 rounded border ${marker.badgeBg}`}>
                      {item.code} · {item.category}
                    </span>
                    <span className="text-ink-muted tabular-nums">{item.estimateHours}h</span>
                  </div>
                  <p className="text-xs font-medium text-ink-primary">{item.title}</p>
                  <div className="w-full h-1.5 rounded-full bg-surface-chrome overflow-hidden">
                    <div
                      style={{ width: `${item.progress}%` }}
                      className={`h-full ${marker.bgStrip}`}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono text-[10px] text-ink-muted tabular-nums">
                      {item.startDate.slice(5)} → {item.endDate.slice(5)}
                    </span>
                    <select
                      value={item.status}
                      onChange={(e) =>
                        updateTask(item.id, {
                          status: e.target.value as TaskStatus,
                          progress:
                            e.target.value === 'done' ? 100 : item.progress
                        })
                      }
                      className="bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary focus:outline-none"
                    >
                      <option value="backlog">Backlog</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
