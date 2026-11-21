import React from 'react'
import { Calendar, Clock, Plus } from 'lucide-react'
import type { TaskStatus } from '@shared/types/domain'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { Badge, ProgressBar, cn } from '@renderer/components/ui'
import type { DatabaseViewProps } from './types'

const COLUMNS: {
  id: TaskStatus
  label: string
  tone: 'cobalt' | 'teal' | 'violet' | 'amber'
}[] = [
  { id: 'backlog', label: 'Backlog', tone: 'cobalt' },
  { id: 'in_progress', label: 'In Progress', tone: 'teal' },
  { id: 'review', label: 'In Review', tone: 'violet' },
  { id: 'done', label: 'Completed', tone: 'amber' }
]

export const KanbanView: React.FC<DatabaseViewProps> = ({
  items,
  updateTask,
  handleAddTask
}) => {
  return (
    <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-canvas-primary">
      {COLUMNS.map((col) => {
        const colItems = items.filter((i) => i.status === col.id)
        const totalHours = colItems.reduce((sum, item) => sum + (item.estimateHours || 0), 0)

        return (
          <div
            key={col.id}
            className="rounded-[12px] bg-surface-chrome/70 border border-border-hairline p-2.5 flex flex-col gap-2.5 min-h-[290px]"
          >
            {/* Column Header (mirrors Reference Image 2: Discovery 2 + / $551,000) */}
            <div className="px-1 pt-0.5 pb-2 border-b border-border-subtle space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge tone={col.tone} dot size="sm">
                    {col.label}
                  </Badge>
                  <span className="px-1.5 py-[1px] rounded-[5px] bg-surface-elevated border border-border-hairline font-mono text-[10px] text-ink-muted tabular-nums">
                    {colItems.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddTask()}
                  title="Tambah task baru"
                  className="p-1 rounded-[6px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors"
                >
                  <Plus size={13} />
                </button>
              </div>
              <div className="font-mono text-[11px] text-ink-muted tabular-nums">
                {totalHours}h workload
              </div>
            </div>

            {/* Cards Stack (mirrors Reference Image 2 airy matte cards) */}
            <div className="flex flex-col gap-2.5 flex-1">
              {colItems.length === 0 ? (
                <div className="flex-1 rounded-[10px] border border-dashed border-border-subtle flex items-center justify-center p-4 text-[11.5px] text-ink-muted">
                  Belum ada task
                </div>
              ) : (
                colItems.map((item) => {
                  const marker = MARKER_META[item.color]
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-[10px] bg-surface-elevated border border-border-hairline hover:border-border-strong shadow-[0_2px_8px_rgba(0,0,0,0.18)] space-y-2.5 transition-colors"
                    >
                      {/* Top Micro Context Row */}
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 text-ink-secondary min-w-0">
                          <span
                            className={cn('w-2 h-2 rounded-[3px] shrink-0', marker.dotBg)}
                          />
                          <span className="font-mono text-[10.5px] text-ink-muted truncate">
                            {item.code}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-muted tabular-nums shrink-0">
                          <Clock size={10.5} />
                          {item.estimateHours}h
                        </span>
                      </div>

                      {/* Card Title */}
                      <p className="text-[13px] font-semibold text-ink-primary leading-snug">
                        {item.title}
                      </p>

                      {/* Category Pastel Pill + Hairline Emerald Progress Bar (Image 2 signature!) */}
                      <div className="flex items-center gap-2.5">
                        <Badge tone={item.color} className="truncate max-w-[110px]">
                          {item.category}
                        </Badge>
                        <ProgressBar
                          value={item.progress}
                          className="flex-1"
                        />
                      </div>

                      {/* Footer Metadata & Stage Switch */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-border-subtle gap-2">
                        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-muted tabular-nums">
                          <Calendar size={10.5} />
                          <span>
                            {item.startDate.slice(5)} → {item.endDate.slice(5)}
                          </span>
                        </span>

                        <select
                          value={item.status}
                          onChange={(e) =>
                            updateTask(item.id, {
                              status: e.target.value as TaskStatus,
                              progress: e.target.value === 'done' ? 100 : item.progress
                            })
                          }
                          className="h-6 bg-surface-chrome hover:bg-surface-hover border border-border-hairline rounded-[6px] px-1.5 text-[10.5px] font-medium text-ink-secondary focus:outline-none focus:border-accent-cobalt cursor-pointer"
                        >
                          <option value="backlog">Backlog</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">In Review</option>
                          <option value="done">Completed</option>
                        </select>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
