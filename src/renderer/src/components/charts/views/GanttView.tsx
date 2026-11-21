import React, { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { DAY_MS, formatIsoDate, parseIsoDate, todayIso } from '@renderer/lib/database/dates'
import { computeGanttBarDragDates, type GanttDragMode } from '@renderer/lib/database/tasks'
import type { DatabaseViewProps } from './types'

const DAY_COL_WIDTH = 34
const ROW_HEIGHT = 40

interface BarDrag {
  taskId: string
  mode: GanttDragMode
  startX: number
  deltaDays: number
}

export const GanttView: React.FC<DatabaseViewProps> = ({ items, updateTask, shiftTask }) => {
  const [drag, setDrag] = useState<BarDrag | null>(null)
  const dragRef = useRef<BarDrag | null>(null)

  // Compute timeline window for Gantt Chart
  const timelineWindow = useMemo(() => {
    const starts = items
      .map((item) => parseIsoDate(item.startDate))
      .filter((ms): ms is number => ms !== null)
    const ends = items
      .map((item) => parseIsoDate(item.endDate))
      .filter((ms): ms is number => ms !== null)

    if (starts.length === 0 || ends.length === 0) {
      const now = new Date()
      const base = Date.UTC(now.getFullYear(), now.getMonth(), 1)
      return { startMs: base, totalDays: 24 }
    }

    const startMs = Math.min(...starts) - DAY_MS * 2
    const totalDays = Math.max(22, Math.ceil((Math.max(...ends) - startMs) / DAY_MS) + 4)
    return { startMs, totalDays }
  }, [items])

  const daysArray = useMemo(() => {
    return Array.from({ length: timelineWindow.totalDays }).map((_, idx) => {
      const ms = timelineWindow.startMs + idx * DAY_MS
      const d = new Date(ms)
      return {
        ms,
        iso: formatIsoDate(ms),
        dayNum: String(d.getUTCDate()).padStart(2, '0'),
        monthShort: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
        isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6
      }
    })
  }, [timelineWindow])

  const today = todayIso()
  const todayIdx = daysArray.findIndex((d) => d.iso === today)

  /** Tanggal tidak valid jatuh ke awal timeline supaya tidak menghasilkan NaN. */
  const toMs = (iso: string): number => parseIsoDate(iso) ?? timelineWindow.startMs

  const startBarDrag = (e: React.PointerEvent<HTMLElement>, taskId: string, mode: GanttDragMode): void => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const next = { taskId, mode, startX: e.clientX, deltaDays: 0 }
    dragRef.current = next
    setDrag(next)
  }

  const moveBarDrag = (e: React.PointerEvent<HTMLElement>): void => {
    const current = dragRef.current
    if (!current) return
    const deltaDays = Math.round((e.clientX - current.startX) / DAY_COL_WIDTH)
    if (deltaDays === current.deltaDays) return
    const next = { ...current, deltaDays }
    dragRef.current = next
    setDrag(next)
  }

  /** Commit once on pointerup so a whole drag is a single undo step. */
  const endBarDrag = (e: React.PointerEvent<HTMLElement>, cancelled = false): void => {
    const current = dragRef.current
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    dragRef.current = null
    setDrag(null)
    if (!current || cancelled || current.deltaDays === 0) return
    const task = items.find((i) => i.id === current.taskId)
    if (task) updateTask(task.id, computeGanttBarDragDates(task, current.mode, current.deltaDays))
  }

  const nudgeBar = (e: React.KeyboardEvent<HTMLElement>, taskId: string): void => {
    const task = items.find((i) => i.id === taskId)
    if (!task) return
    const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (!dir) return
    e.preventDefault()
    const mode: GanttDragMode = e.shiftKey ? 'resize-end' : 'move'
    updateTask(task.id, computeGanttBarDragDates(task, mode, dir))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 bg-canvas-primary">
      {/* Left Task Spec Column */}
      <div className="lg:col-span-5 border-r border-border-hairline flex flex-col">
        <div className="h-11 px-4 bg-surface-chrome/45 border-b border-border-hairline flex items-center justify-between text-[11.5px] font-medium text-ink-muted">
          <span>Tasks ({items.length})</span>
          <span>Progress · Shift days</span>
        </div>

        <div className="divide-y divide-border-subtle">
          {items.map((task) => {
            const marker = MARKER_META[task.color]
            return (
              <div
                key={task.id}
                style={{ height: `${ROW_HEIGHT}px` }}
                className="px-4 flex items-center justify-between gap-2 hover:bg-surface-hover/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-2 h-2 rounded-[3px] ${marker.dotBg} shrink-0`} />
                  <span className="font-mono text-[10.5px] text-ink-muted shrink-0">
                    {task.code}
                  </span>
                  <input
                    type="text"
                    aria-label={`Title for ${task.code}`}
                    value={task.title}
                    onChange={(e) => updateTask(task.id, { title: e.target.value })}
                    className="bg-transparent text-[12.5px] font-medium text-ink-primary truncate focus:outline-none focus:border-b focus:border-accent-cobalt w-full"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10.5px] tabular-nums">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    aria-label={`Progress for ${task.title}`}
                    value={task.progress}
                    onChange={(e) =>
                      updateTask(task.id, { progress: Number(e.target.value) })
                    }
                    title={`Progress: ${task.progress}%`}
                    className="w-14 accent-[var(--accent-cobalt)] cursor-pointer"
                  />
                  <span className="w-8 text-right text-ink-secondary">{task.progress}%</span>
                  <button
                    type="button"
                    onClick={() => shiftTask(task, -1)}
                    title="Move 1 day earlier"
                    aria-label={`Move ${task.title} 1 day earlier`}
                    className="p-0.5 rounded-[5px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary"
                  >
                    <ChevronLeft size={11} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftTask(task, 1)}
                    title="Move 1 day later"
                    aria-label={`Move ${task.title} 1 day later`}
                    className="p-0.5 rounded-[5px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary"
                  >
                    <ChevronRight size={11} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Scrollable Gantt Timeline Grid */}
      <div className="lg:col-span-7 overflow-x-auto relative select-none">
        <div style={{ width: `${daysArray.length * DAY_COL_WIDTH}px` }}>
          {/* Two-Tier Date Scale Header */}
          <div className="h-11 bg-surface-chrome/45 border-b border-border-hairline flex">
            {daysArray.map((d, idx) => {
              const isToday = idx === todayIdx
              return (
                <div
                  key={d.iso}
                  style={{ width: `${DAY_COL_WIDTH}px` }}
                  className={`border-r border-border-subtle flex flex-col items-center justify-center font-mono tabular-nums ${
                    isToday
                      ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] font-semibold'
                      : d.isWeekend
                        ? 'bg-surface-chrome/70 text-ink-muted'
                        : 'text-ink-secondary'
                  }`}
                >
                  <span className="text-[9px] opacity-75">{d.monthShort}</span>
                  <span className="text-[11px]">{d.dayNum}</span>
                </div>
              )
            })}
          </div>

          {/* Timeline Bars + Orthogonal Dependency Arrows */}
          <div
            style={{ height: `${items.length * ROW_HEIGHT}px` }}
            className="relative bg-canvas-primary"
          >
            {/* Vertical Day Columns + Today Marker */}
            <div className="absolute inset-0 flex pointer-events-none">
              {daysArray.map((d, idx) => (
                <div
                  key={d.iso}
                  style={{ width: `${DAY_COL_WIDTH}px` }}
                  className={`h-full border-r border-border-subtle ${
                    d.isWeekend ? 'bg-surface-chrome' : ''
                  }`}
                >
                  {idx === todayIdx && (
                    <div className="h-full w-[1.5px] bg-accent-cobalt mx-auto relative">
                      <span className="absolute top-1 -left-4 px-1.5 py-[1px] rounded-[4px] bg-accent-cobalt text-white font-mono text-[8px] font-semibold">
                        TODAY
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* SVG Dependency Arrows (Finish-to-Start + Conflict Detection) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
              {items.map((task, rowIdx) =>
                (task.dependsOn || []).map((depId) => {
                  const predIdx = items.findIndex((i) => i.id === depId)
                  if (predIdx === -1) return null
                  const pred = items[predIdx]

                  const predEndOffset = Math.round(
                    (toMs(pred.endDate) - timelineWindow.startMs) / DAY_MS
                  )
                  const taskStartOffset = Math.round(
                    (toMs(task.startDate) - timelineWindow.startMs) / DAY_MS
                  )

                  const x1 = (predEndOffset + 1) * DAY_COL_WIDTH
                  const y1 = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                  const x2 = taskStartOffset * DAY_COL_WIDTH
                  const y2 = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2

                  const isConflict = toMs(task.startDate) < toMs(pred.endDate)
                  const strokeColor = isConflict ? '#F87171' : '#6E7BF2'
                  const midX = x2 >= x1 ? (x1 + x2) / 2 : x1 + 10

                  const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`

                  return (
                    <g key={`${pred.id}->${task.id}`}>
                      <path
                        d={path}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isConflict ? 1.8 : 1.4}
                      />
                      <polygon
                        points={`${x2},${y2} ${x2 - 6},${y2 - 3.5} ${x2 - 6},${y2 + 3.5}`}
                        fill={strokeColor}
                      />
                    </g>
                  )
                })
              )}
            </svg>

            {/* Task Rows & Soft Rounded Timeline Bars */}
            {items.map((task) => {
              const eff =
                drag && drag.taskId === task.id
                  ? computeGanttBarDragDates(task, drag.mode, drag.deltaDays)
                  : task
              const startOffset = Math.max(
                0,
                Math.round((toMs(eff.startDate) - timelineWindow.startMs) / DAY_MS)
              )
              const durationDays = Math.max(
                1,
                Math.round((toMs(eff.endDate) - toMs(eff.startDate)) / DAY_MS) + 1
              )
              const leftPx = startOffset * DAY_COL_WIDTH
              const widthPx = durationDays * DAY_COL_WIDTH
              const marker = MARKER_META[task.color]

              return (
                <div
                  key={task.id}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  className="relative border-b border-border-subtle flex items-center"
                >
                  {task.isMilestone ? (
                    <div
                      style={{ left: `${leftPx + DAY_COL_WIDTH / 2 - 7}px` }}
                      className="absolute z-20 flex items-center gap-2"
                    >
                      <div
                        title={`Milestone: ${task.title} (${task.startDate})`}
                        className="w-3.5 h-3.5 rotate-45 rounded-[2px] bg-accent-amber border border-white/40 shadow"
                      />
                      <span className="font-mono text-[10.5px] font-medium text-accent-amber whitespace-nowrap">
                        {task.code}
                      </span>
                    </div>
                  ) : (
                    <div
                      role="group"
                      tabIndex={0}
                      aria-label={`${task.code} ${task.title}: ${eff.startDate} to ${eff.endDate}. Arrow keys move, Shift+arrows resize.`}
                      onKeyDown={(e) => nudgeBar(e, task.id)}
                      style={{ left: `${leftPx + 2}px`, width: `${Math.max(28, widthPx - 4)}px` }}
                      className={`absolute h-[24px] rounded-[6px] border ${marker.border} hatched-pattern bg-surface-elevated overflow-hidden flex items-center z-20 focus-visible:ring-2 focus-visible:ring-accent-cobalt`}
                    >
                      <div
                        style={{ width: `${task.progress}%` }}
                        className={`h-full ${marker.bgStrip} opacity-80 transition-all`}
                      />
                      <span
                        onPointerDown={(e) => startBarDrag(e, task.id, 'move')}
                        onPointerMove={moveBarDrag}
                        onPointerUp={(e) => endBarDrag(e)}
                        onPointerCancel={(e) => endBarDrag(e, true)}
                        className="absolute inset-0 px-2 flex items-center justify-between font-mono text-[10px] text-white drop-shadow cursor-grab active:cursor-grabbing touch-none"
                      >
                        <span className="truncate font-medium">{task.code}</span>
                        <span className="tabular-nums">{task.progress}%</span>
                      </span>
                      <span
                        aria-hidden="true"
                        title="Drag to change start date"
                        onPointerDown={(e) => startBarDrag(e, task.id, 'resize-start')}
                        onPointerMove={moveBarDrag}
                        onPointerUp={(e) => endBarDrag(e)}
                        onPointerCancel={(e) => endBarDrag(e, true)}
                        className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize touch-none hover:bg-white/30"
                      />
                      <span
                        aria-hidden="true"
                        title="Drag to change end date"
                        onPointerDown={(e) => startBarDrag(e, task.id, 'resize-end')}
                        onPointerMove={moveBarDrag}
                        onPointerUp={(e) => endBarDrag(e)}
                        onPointerCancel={(e) => endBarDrag(e, true)}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize touch-none hover:bg-white/30"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
