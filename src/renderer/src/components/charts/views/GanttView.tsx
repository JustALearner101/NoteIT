import React, { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { DAY_MS, formatIsoDate, parseIsoDate } from '@renderer/lib/database/dates'
import type { DatabaseViewProps } from './types'

const DAY_COL_WIDTH = 34
const ROW_HEIGHT = 40

export const GanttView: React.FC<DatabaseViewProps> = ({ items, updateTask, shiftTask }) => {
  // Compute timeline window for Gantt Chart
  const timelineWindow = useMemo(() => {
    const starts = items
      .map((item) => parseIsoDate(item.startDate))
      .filter((ms): ms is number => ms !== null)
    const ends = items
      .map((item) => parseIsoDate(item.endDate))
      .filter((ms): ms is number => ms !== null)

    if (starts.length === 0 || ends.length === 0) {
      const base = Date.UTC(2026, 9, 18)
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
        monthShort: d.toLocaleDateString('id-ID', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
        isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6
      }
    })
  }, [timelineWindow])

  const todayIso = '2026-10-27'
  const todayIdx = daysArray.findIndex((d) => d.iso === todayIso)

  /** Tanggal tidak valid jatuh ke awal timeline supaya tidak menghasilkan NaN. */
  const toMs = (iso: string): number => parseIsoDate(iso) ?? timelineWindow.startMs

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12">
      {/* Left Task Spec Column */}
      <div className="lg:col-span-5 border-r border-border-hairline flex flex-col">
        <div className="h-12 px-3 bg-surface-chrome/70 border-b border-border-hairline flex items-center justify-between font-mono text-[10px] text-ink-muted uppercase tracking-wider">
          <span>TASK SPECIFICATION ({items.length})</span>
          <span>PROGRESS · GESER HARI</span>
        </div>

        <div className="divide-y divide-border-subtle">
          {items.map((task) => {
            const marker = MARKER_META[task.color]
            return (
              <div
                key={task.id}
                style={{ height: `${ROW_HEIGHT}px` }}
                className="px-3 flex items-center justify-between gap-2 hover:bg-surface-hover/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-1.5 h-4 rounded-[2px] ${marker.bgStrip} shrink-0`} />
                  <span className="font-mono text-[10px] text-ink-muted shrink-0">
                    {task.code}
                  </span>
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => updateTask(task.id, { title: e.target.value })}
                    className="bg-transparent text-xs text-ink-primary truncate focus:outline-none focus:border-b focus:border-accent-cobalt w-full"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] tabular-nums">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={task.progress}
                    onChange={(e) =>
                      updateTask(task.id, { progress: Number(e.target.value) })
                    }
                    title={`Progress: ${task.progress}%`}
                    className="w-14 accent-[#3B82F6] cursor-pointer"
                  />
                  <span className="w-8 text-right text-ink-secondary">{task.progress}%</span>
                  <button
                    onClick={() => shiftTask(task, -1)}
                    title="Majukan 1 Hari"
                    className="p-0.5 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-ink-secondary"
                  >
                    <ChevronLeft size={11} />
                  </button>
                  <button
                    onClick={() => shiftTask(task, 1)}
                    title="Mundurkan 1 Hari"
                    className="p-0.5 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-ink-secondary"
                  >
                    <ChevronRight size={11} />
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
          <div className="h-12 bg-surface-chrome/70 border-b border-border-hairline flex">
            {daysArray.map((d, idx) => {
              const isToday = idx === todayIdx
              return (
                <div
                  key={d.iso}
                  style={{ width: `${DAY_COL_WIDTH}px` }}
                  className={`border-r border-border-subtle flex flex-col items-center justify-center font-mono tabular-nums ${
                    isToday
                      ? 'bg-accent-amber/20 text-accent-amber font-bold'
                      : d.isWeekend
                        ? 'bg-surface-chrome/90 text-ink-muted'
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
            {/* Vertical Day Columns + Today Amber Marker */}
            <div className="absolute inset-0 flex pointer-events-none">
              {daysArray.map((d, idx) => (
                <div
                  key={d.iso}
                  style={{ width: `${DAY_COL_WIDTH}px` }}
                  className={`h-full border-r border-border-subtle/60 ${
                    d.isWeekend ? 'bg-surface-chrome/25' : ''
                  }`}
                >
                  {idx === todayIdx && (
                    <div className="h-full w-[1.5px] bg-accent-amber mx-auto relative">
                      <span className="absolute top-1 -left-4 px-1 rounded-[2px] bg-accent-amber text-black font-mono text-[8px] font-bold">
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
                  const strokeColor = isConflict ? '#EF4444' : '#3B82F6'
                  const midX = x2 >= x1 ? (x1 + x2) / 2 : x1 + 10

                  const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`

                  return (
                    <g key={`${pred.id}->${task.id}`}>
                      <path
                        d={path}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isConflict ? 2 : 1.4}
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

            {/* Task Rows & Hatched Engineering Bars */}
            {items.map((task) => {
              const startOffset = Math.max(
                0,
                Math.round((toMs(task.startDate) - timelineWindow.startMs) / DAY_MS)
              )
              const durationDays = Math.max(
                1,
                Math.round((toMs(task.endDate) - toMs(task.startDate)) / DAY_MS) +
                  1
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
                      style={{ left: `${leftPx + DAY_COL_WIDTH / 2 - 8}px` }}
                      className="absolute z-20 flex items-center gap-2"
                    >
                      <div
                        title={`Milestone: ${task.title} (${task.startDate})`}
                        className="w-4 h-4 rotate-45 bg-accent-amber border border-white/60 shadow"
                      />
                      <span className="font-mono text-[10px] font-semibold text-accent-amber whitespace-nowrap">
                        ◆ {task.code}
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{ left: `${leftPx + 2}px`, width: `${Math.max(24, widthPx - 4)}px` }}
                      className={`absolute h-[22px] rounded-[4px] border ${marker.border} hatched-pattern bg-surface-elevated overflow-hidden flex items-center z-20`}
                    >
                      <div
                        style={{ width: `${task.progress}%` }}
                        className={`h-full ${marker.bgStrip} opacity-80 transition-all`}
                      />
                      <span className="absolute inset-0 px-2 flex items-center justify-between font-mono text-[10px] text-white drop-shadow">
                        <span className="truncate font-medium">{task.code}</span>
                        <span className="tabular-nums">{task.progress}%</span>
                      </span>
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
