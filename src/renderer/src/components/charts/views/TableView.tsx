import React from 'react'
import { Diamond, Plus, Trash2 } from 'lucide-react'
import type { MarkerColor, TaskStatus } from '@shared/types/domain'
import { MARKER_COLORS, MARKER_META } from '@renderer/lib/marker-colors'
import { Badge, ProgressBar, cn } from '@renderer/components/ui'
import type { DatabaseViewProps } from './types'

const STATUS_GROUPS: {
  id: TaskStatus
  label: string
  tone: 'cobalt' | 'teal' | 'violet' | 'amber' | 'slate'
}[] = [
  { id: 'backlog', label: 'Backlog', tone: 'cobalt' },
  { id: 'in_progress', label: 'In Progress', tone: 'teal' },
  { id: 'review', label: 'In Review', tone: 'violet' },
  { id: 'done', label: 'Completed', tone: 'amber' }
]

export const TableView: React.FC<DatabaseViewProps> = ({
  items,
  updateTask,
  handleAddTask,
  handleDeleteTask
}) => {
  const totalHours = items.reduce((sum, item) => sum + (item.estimateHours || 0), 0)
  const avgProgress =
    items.length > 0
      ? Math.round(items.reduce((sum, item) => sum + (item.progress || 0), 0) / items.length)
      : 0

  return (
    <div className="bg-canvas-primary">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-hairline text-[11.5px] font-medium text-ink-muted bg-surface-chrome/35">
              <th className="py-2.5 px-4 font-medium w-[28%]">Task</th>
              <th className="py-2.5 px-3 font-medium">Code</th>
              <th className="py-2.5 px-3 font-medium">Stage</th>
              <th className="py-2.5 px-3 font-medium">Tag</th>
              <th className="py-2.5 px-3 font-medium min-w-[155px]">Progress</th>
              <th className="py-2.5 px-3 font-medium">Schedule</th>
              <th className="py-2.5 px-3 font-medium text-right">Est.</th>
              <th className="py-2.5 px-3 font-medium text-center">Milestone</th>
              <th className="py-2.5 px-3 font-medium text-right w-10" />
            </tr>
          </thead>

          <tbody className="text-[12.5px]">
            {STATUS_GROUPS.map((group) => {
              const groupItems = items.filter((i) => i.status === group.id)
              if (groupItems.length === 0) return null
              const groupHours = groupItems.reduce((acc, i) => acc + (i.estimateHours || 0), 0)

              return (
                <React.Fragment key={group.id}>
                  {/* Grouped Stage Header Row (mirrors Reference Image 1: Discovery 2 ... $551K) */}
                  <tr className="bg-surface-chrome/45 border-y border-border-subtle">
                    <td colSpan={6} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <Badge tone={group.tone} dot size="sm">
                          {group.label}
                        </Badge>
                        <span className="px-1.5 py-[1px] rounded-[5px] bg-surface-elevated border border-border-hairline font-mono text-[10px] text-ink-muted tabular-nums">
                          {groupItems.length}
                        </span>
                      </div>
                    </td>
                    <td
                      colSpan={3}
                      className="py-2 px-4 text-right font-mono text-[11px] text-ink-secondary tabular-nums"
                    >
                      {groupHours}h
                    </td>
                  </tr>

                  {groupItems.map((item) => {
                    const marker = MARKER_META[item.color]
                    return (
                      <tr
                        key={item.id}
                        className="group h-[42px] border-b border-border-subtle hover:bg-surface-hover/35 transition-colors"
                      >
                        {/* Task Title with micro color swatch */}
                        <td className="py-1.5 px-4">
                          <div className="flex items-center gap-2.5 min-w-[170px]">
                            <span
                              className={cn(
                                'w-2 h-2 rounded-[3px] shrink-0',
                                marker.dotBg
                              )}
                            />
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => updateTask(item.id, { title: e.target.value })}
                              className="w-full bg-transparent text-[13px] font-medium text-ink-primary focus:outline-none focus:border-b focus:border-accent-cobalt truncate"
                            />
                          </div>
                        </td>

                        {/* Code Pill */}
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            value={item.code}
                            onChange={(e) => updateTask(item.id, { code: e.target.value })}
                            className="w-16 px-1.5 py-0.5 rounded-[5px] bg-surface-elevated border border-border-hairline font-mono text-[11px] text-ink-secondary focus:outline-none focus:border-accent-cobalt"
                          />
                        </td>

                        {/* Stage Selector */}
                        <td className="py-1.5 px-3">
                          <select
                            value={item.status}
                            onChange={(e) =>
                              updateTask(item.id, {
                                status: e.target.value as TaskStatus,
                                progress: e.target.value === 'done' ? 100 : item.progress
                              })
                            }
                            className="h-6 px-2 rounded-[6px] bg-surface-elevated border border-border-hairline text-[11px] font-medium text-ink-primary focus:border-accent-cobalt cursor-pointer"
                          >
                            <option value="backlog">Backlog</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">In Review</option>
                            <option value="done">Completed</option>
                          </select>
                        </td>

                        {/* Color Tag Pill Selector */}
                        <td className="py-1.5 px-3">
                          <select
                            value={item.color}
                            onChange={(e) =>
                              updateTask(item.id, { color: e.target.value as MarkerColor })
                            }
                            className={cn(
                              'h-6 px-2 rounded-[6px] border text-[11px] font-medium focus:outline-none cursor-pointer',
                              marker.badgeBg
                            )}
                          >
                            {MARKER_COLORS.map((c) => (
                              <option
                                key={c}
                                value={c}
                                className="bg-surface-elevated text-ink-primary"
                              >
                                {MARKER_META[c].label.split(' ')[1] || c}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Hairline Emerald Progress Bar + Inline Percentage Input (Image 1 signature!) */}
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-2">
                            <ProgressBar
                              value={item.progress}
                              showLabel={false}
                              className="flex-1"
                            />
                            <div className="flex items-center font-mono text-[11px] text-ink-secondary tabular-nums">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={item.progress}
                                onChange={(e) =>
                                  updateTask(item.id, { progress: Number(e.target.value) })
                                }
                                className="w-10 bg-transparent text-right text-ink-secondary hover:text-ink-primary focus:text-ink-primary focus:outline-none tabular-nums"
                              />
                              <span>%</span>
                            </div>
                          </div>
                        </td>

                        {/* Date Range */}
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1 font-mono text-[11px] text-ink-secondary tabular-nums">
                            <input
                              type="date"
                              value={item.startDate}
                              onChange={(e) =>
                                updateTask(item.id, { startDate: e.target.value })
                              }
                              className="bg-transparent hover:bg-surface-elevated border border-transparent hover:border-border-hairline rounded-[5px] px-1 py-0.5 text-ink-secondary focus:bg-surface-elevated focus:border-accent-cobalt focus:text-ink-primary"
                            />
                            <span className="text-ink-muted">→</span>
                            <input
                              type="date"
                              value={item.endDate}
                              onChange={(e) =>
                                updateTask(item.id, { endDate: e.target.value })
                              }
                              className="bg-transparent hover:bg-surface-elevated border border-transparent hover:border-border-hairline rounded-[5px] px-1 py-0.5 text-ink-secondary focus:bg-surface-elevated focus:border-accent-cobalt focus:text-ink-primary"
                            />
                          </div>
                        </td>

                        {/* Estimate Hours */}
                        <td className="py-1.5 px-3 text-right">
                          <div className="inline-flex items-center justify-end font-mono text-[11.5px] text-ink-primary tabular-nums">
                            <input
                              type="number"
                              min={1}
                              value={item.estimateHours}
                              onChange={(e) =>
                                updateTask(item.id, { estimateHours: Number(e.target.value) })
                              }
                              className="w-11 bg-transparent text-right focus:bg-surface-elevated rounded px-1 py-0.5 focus:outline-none tabular-nums"
                            />
                            <span className="text-ink-muted">h</span>
                          </div>
                        </td>

                        {/* Milestone Diamond */}
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              updateTask(item.id, { isMilestone: !item.isMilestone })
                            }
                            title="Toggle Milestone"
                            className={cn(
                              'p-1 rounded-[6px] border transition-colors',
                              item.isMilestone
                                ? 'bg-[var(--pill-amber-bg)] border-[var(--pill-amber-border)] text-accent-amber'
                                : 'border-transparent text-ink-muted hover:bg-surface-hover hover:text-ink-primary'
                            )}
                          >
                            <Diamond size={12} />
                          </button>
                        </td>

                        {/* Hover Delete Action */}
                        <td className="py-1.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(item.id)}
                            title="Hapus Task"
                            className="p-1 rounded-[6px] opacity-0 group-hover:opacity-100 hover:bg-[var(--pill-red-bg)] text-ink-muted hover:text-[var(--pill-red-text)] transition-all"
                          >
                            <Trash2 size={12.5} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Summary Footer Strip (mirrors Reference Image 1 footer: + Add record · 15 records · $3,509K) */}
      <div className="px-4 py-2 bg-surface-chrome/45 border-t border-border-hairline flex items-center justify-between text-[11.5px] text-ink-muted select-none">
        <div className="flex items-center gap-3 tabular-nums">
          <button
            type="button"
            onClick={() => handleAddTask()}
            className="inline-flex items-center gap-1 text-ink-secondary hover:text-ink-primary font-medium transition-colors"
          >
            <Plus size={12} />
            <span>Add task</span>
          </button>
          <span className="text-border-strong">·</span>
          <span>{items.length} records</span>
          <span className="text-border-strong">·</span>
          <span className="font-mono text-[11px]">{totalHours}h estimate</span>
        </div>

        <div className="font-mono text-[11px] tabular-nums text-ink-secondary">
          Avg progress {avgProgress}%
        </div>
      </div>
    </div>
  )
}
