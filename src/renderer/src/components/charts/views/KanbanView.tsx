import React, { useState } from 'react'
import { Calendar, Clock, Plus, User } from 'lucide-react'
import type { TaskStatus } from '@shared/types/domain'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { stagePatch } from '@renderer/lib/database/tasks'
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

export const KanbanView: React.FC<DatabaseViewProps> = ({ items, updateTask, handleAddTask }) => {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null)

  const moveTask = (taskId: string, status: TaskStatus): void => {
    const task = items.find((i) => i.id === taskId)
    if (!task) return
    const patch = stagePatch(task, status)
    if (patch) updateTask(taskId, patch)
  }

  return (
    <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-canvas-primary">
      {COLUMNS.map((col) => {
        const colItems = items.filter((i) => i.status === col.id)
        const totalHours = colItems.reduce((sum, item) => sum + (item.estimateHours || 0), 0)
        const isDropTarget = dragOverCol === col.id && draggingId !== null

        return (
          <section
            key={col.id}
            aria-label={`${col.label} column`}
            onDragOver={(e) => {
              if (!draggingId) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (dragOverCol !== col.id) setDragOverCol(col.id)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOverCol(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              const taskId = e.dataTransfer.getData('text/plain') || draggingId
              if (taskId) moveTask(taskId, col.id)
              setDraggingId(null)
              setDragOverCol(null)
            }}
            className={cn(
              'rounded-[12px] bg-surface-chrome/70 border p-2.5 flex flex-col gap-2.5 min-h-[290px] transition-colors',
              isDropTarget ? 'border-accent-cobalt bg-surface-hover/30' : 'border-border-hairline'
            )}
          >
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
                  title="Add a new task"
                  aria-label={`Add task to ${col.label}`}
                  className="p-1 rounded-[6px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors"
                >
                  <Plus size={13} aria-hidden="true" />
                </button>
              </div>
              <div className="font-mono text-[11px] text-ink-muted tabular-nums">
                {totalHours}h workload
              </div>
            </div>

            <div className="flex flex-col gap-2.5 flex-1">
              {colItems.length === 0 ? (
                <div className="flex-1 rounded-[10px] border border-dashed border-border-subtle flex items-center justify-center p-4 text-[11.5px] text-ink-muted">
                  No tasks yet
                </div>
              ) : (
                colItems.map((item) => {
                  const marker = MARKER_META[item.color]
                  return (
                    <article
                      key={item.id}
                      draggable
                      aria-label={`${item.code} ${item.title}`}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', item.id)
                        setDraggingId(item.id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDragOverCol(null)
                      }}
                      className={cn(
                        'p-3.5 rounded-[10px] bg-surface-elevated border border-border-hairline hover:border-border-strong shadow-[0_2px_8px_rgba(0,0,0,0.18)] space-y-2.5 transition-colors cursor-grab active:cursor-grabbing',
                        draggingId === item.id && 'opacity-50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 text-ink-secondary min-w-0">
                          <span
                            aria-hidden="true"
                            className={cn('w-2 h-2 rounded-[3px] shrink-0', marker.dotBg)}
                          />
                          <span className="font-mono text-[10.5px] text-ink-muted truncate">
                            {item.code}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-muted tabular-nums shrink-0">
                          <Clock size={10.5} aria-hidden="true" />
                          {item.estimateHours}h
                        </span>
                      </div>

                      <p className="text-[13px] font-semibold text-ink-primary leading-snug">
                        {item.title}
                      </p>

                      <div className="flex items-center gap-2.5">
                        <Badge tone={item.color} className="truncate max-w-[110px]">
                          {item.category}
                        </Badge>
                        <ProgressBar value={item.progress} className="flex-1" />
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-border-subtle gap-2">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-muted tabular-nums">
                            <Calendar size={10.5} aria-hidden="true" />
                            <span>
                              {item.startDate.slice(5)} → {item.endDate.slice(5)}
                            </span>
                          </span>
                          {item.assignee && (
                            <span
                              title={`Assignee: ${item.assignee}`}
                              className="inline-flex items-center gap-1 text-[10.5px] text-ink-secondary truncate"
                            >
                              <User size={10.5} aria-hidden="true" />
                              <span className="truncate">{item.assignee}</span>
                            </span>
                          )}
                        </div>

                        <select
                          value={item.status}
                          aria-label={`Stage for ${item.title}`}
                          onChange={(e) => moveTask(item.id, e.target.value as TaskStatus)}
                          className="h-6 bg-surface-chrome hover:bg-surface-hover border border-border-hairline rounded-[6px] px-1.5 text-[10.5px] font-medium text-ink-secondary focus:outline-none focus:border-accent-cobalt focus-visible:ring-2 focus-visible:ring-accent-cobalt cursor-pointer"
                        >
                          {COLUMNS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
