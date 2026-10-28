import React, { useMemo } from 'react'
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Diamond,
  GanttChart,
  Kanban,
  Plus,
  Table2,
  Trash2
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { MarkerColor, ProjectTaskItem, TaskStatus } from '@shared/types/domain'
import { MARKER_COLORS, MARKER_META } from '@renderer/lib/marker-colors'
import { createId } from '@renderer/lib/ids'

interface ProjectDatabaseBlockProps {
  title: string
  activeView: 'gantt' | 'kanban' | 'table' | 'chart'
  chartType: 'bar' | 'line' | 'area' | 'donut'
  items: ProjectTaskItem[]
  onChange: (updates: {
    databaseTitle?: string
    databaseActiveView?: 'gantt' | 'kanban' | 'table' | 'chart'
    databaseChartType?: 'bar' | 'line' | 'area' | 'donut'
    databaseItems?: ProjectTaskItem[]
  }) => void
}

const DAY_MS = 86400000
const DAY_COL_WIDTH = 34
const ROW_HEIGHT = 40

function parseDateUTC(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y || 2026, (m || 10) - 1, d || 1)
}

function formatDateUTC(ms: number): string {
  const d = new Date(ms)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export const ProjectDatabaseBlock: React.FC<ProjectDatabaseBlockProps> = ({
  title,
  activeView = 'gantt',
  chartType = 'bar',
  items = [],
  onChange
}) => {
  // Compute timeline window for Gantt Chart
  const timelineWindow = useMemo(() => {
    if (items.length === 0) {
      const base = Date.UTC(2026, 9, 18)
      return { startMs: base, totalDays: 24 }
    }
    const minMs = Math.min(...items.map((i) => parseDateUTC(i.startDate)))
    const maxMs = Math.max(...items.map((i) => parseDateUTC(i.endDate)))
    const startMs = minMs - DAY_MS * 2
    const totalDays = Math.max(22, Math.ceil((maxMs - startMs) / DAY_MS) + 4)
    return { startMs, totalDays }
  }, [items])

  const daysArray = useMemo(() => {
    return Array.from({ length: timelineWindow.totalDays }).map((_, idx) => {
      const ms = timelineWindow.startMs + idx * DAY_MS
      const d = new Date(ms)
      return {
        ms,
        iso: formatDateUTC(ms),
        dayNum: String(d.getUTCDate()).padStart(2, '0'),
        monthShort: d.toLocaleDateString('id-ID', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
        isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6
      }
    })
  }, [timelineWindow])

  // Detect dependency schedule conflicts (successor starts before predecessor finishes)
  const conflicts = useMemo(() => {
    const list: { fromCode: string; toCode: string }[] = []
    for (const task of items) {
      for (const depId of task.dependsOn || []) {
        const pred = items.find((i) => i.id === depId)
        if (pred && parseDateUTC(task.startDate) < parseDateUTC(pred.endDate)) {
          list.push({ fromCode: pred.code, toCode: task.code })
        }
      }
    }
    return list
  }, [items])

  const updateTask = (taskId: string, patch: Partial<ProjectTaskItem>): void => {
    onChange({
      databaseItems: items.map((item) => (item.id === taskId ? { ...item, ...patch } : item))
    })
  }

  const shiftTaskDays = (task: ProjectTaskItem, deltaDays: number): void => {
    const nextStart = formatDateUTC(parseDateUTC(task.startDate) + deltaDays * DAY_MS)
    const nextEnd = formatDateUTC(parseDateUTC(task.endDate) + deltaDays * DAY_MS)
    updateTask(task.id, { startDate: nextStart, endDate: nextEnd })
  }

  const handleAddTask = (): void => {
    const nextNum = items.length + 1
    const lastTask = items[items.length - 1]
    const newTask: ProjectTaskItem = {
      id: createId('tsk'),
      code: `TSK-${String(nextNum).padStart(2, '0')}`,
      title: 'Spesifikasi Task Engineering Baru',
      category: 'Engineering',
      color: MARKER_COLORS[nextNum % MARKER_COLORS.length],
      status: 'backlog',
      startDate: lastTask ? lastTask.endDate : '2026-10-27',
      endDate: lastTask
        ? formatDateUTC(parseDateUTC(lastTask.endDate) + 4 * DAY_MS)
        : '2026-10-31',
      progress: 0,
      isMilestone: false,
      dependsOn: lastTask ? [lastTask.id] : [],
      assignee: 'Engineer',
      estimateHours: 16
    }
    onChange({ databaseItems: [...items, newTask] })
  }

  const handleDeleteTask = (taskId: string): void => {
    onChange({
      databaseItems: items
        .filter((i) => i.id !== taskId)
        .map((i) => ({
          ...i,
          dependsOn: (i.dependsOn || []).filter((d) => d !== taskId)
        }))
    })
  }

  // Aggregated data for Recharts Data Visualization View
  const chartData = useMemo(() => {
    return items.map((item) => ({
      name: item.code,
      fullTitle: item.title,
      progress: item.progress,
      hours: item.estimateHours,
      colorHex: MARKER_META[item.color]?.hex || '#3B82F6'
    }))
  }, [items])

  const todayIso = '2026-10-27'
  const todayIdx = daysArray.findIndex((d) => d.iso === todayIso)

  return (
    <div className="rounded-[8px] bg-surface-elevated border border-border-hairline overflow-hidden shadow-sm my-3">
      {/* Top Database & View Switcher Header */}
      <div className="px-3 py-2 bg-surface-chrome border-b border-border-hairline flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-amber" />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ databaseTitle: e.target.value })}
            className="bg-transparent font-mono text-xs font-semibold tracking-wider uppercase text-ink-primary focus:outline-none border-b border-transparent focus:border-accent-amber"
          />
          {conflicts.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-[#EF4444]/15 border border-[#EF4444]/40 font-mono text-[10px] text-[#EF4444] flex items-center gap-1">
              <AlertTriangle size={11} />
              <span>
                {conflicts.length} KONFLIK JADWAL ({conflicts[0].fromCode} → {conflicts[0].toCode})
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 4-View Switcher: Gantt | Kanban | Table | Data Chart */}
          <div className="p-0.5 rounded bg-surface-elevated border border-border-hairline flex items-center font-mono text-[10px]">
            <button
              onClick={() => onChange({ databaseActiveView: 'gantt' })}
              className={`px-2.5 py-1 rounded flex items-center gap-1 ${
                activeView === 'gantt'
                  ? 'bg-accent-cobalt text-white font-semibold'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <GanttChart size={11} />
              <span>Gantt</span>
            </button>
            <button
              onClick={() => onChange({ databaseActiveView: 'kanban' })}
              className={`px-2.5 py-1 rounded flex items-center gap-1 ${
                activeView === 'kanban'
                  ? 'bg-accent-cobalt text-white font-semibold'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Kanban size={11} />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => onChange({ databaseActiveView: 'table' })}
              className={`px-2.5 py-1 rounded flex items-center gap-1 ${
                activeView === 'table'
                  ? 'bg-accent-cobalt text-white font-semibold'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Table2 size={11} />
              <span>Table</span>
            </button>
            <button
              onClick={() => onChange({ databaseActiveView: 'chart' })}
              className={`px-2.5 py-1 rounded flex items-center gap-1 ${
                activeView === 'chart'
                  ? 'bg-accent-cobalt text-white font-semibold'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <BarChart3 size={11} />
              <span>Data Chart</span>
            </button>
          </div>

          <button
            onClick={handleAddTask}
            className="h-7 px-2.5 rounded bg-accent-cobalt hover:opacity-90 text-white font-mono text-[10px] font-semibold flex items-center gap-1"
          >
            <Plus size={11} />
            <span>Tambah Task</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE GANTT TIMELINE */}
      {activeView === 'gantt' && (
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
                        onClick={() => shiftTaskDays(task, -1)}
                        title="Majukan 1 Hari"
                        className="p-0.5 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-ink-secondary"
                      >
                        <ChevronLeft size={11} />
                      </button>
                      <button
                        onClick={() => shiftTaskDays(task, 1)}
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
                        (parseDateUTC(pred.endDate) - timelineWindow.startMs) / DAY_MS
                      )
                      const taskStartOffset = Math.round(
                        (parseDateUTC(task.startDate) - timelineWindow.startMs) / DAY_MS
                      )

                      const x1 = (predEndOffset + 1) * DAY_COL_WIDTH
                      const y1 = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                      const x2 = taskStartOffset * DAY_COL_WIDTH
                      const y2 = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2

                      const isConflict = parseDateUTC(task.startDate) < parseDateUTC(pred.endDate)
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
                    Math.round((parseDateUTC(task.startDate) - timelineWindow.startMs) / DAY_MS)
                  )
                  const durationDays = Math.max(
                    1,
                    Math.round((parseDateUTC(task.endDate) - parseDateUTC(task.startDate)) / DAY_MS) +
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
      )}

      {/* VIEW 2: KANBAN BOARD VIEW */}
      {activeView === 'kanban' && (
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
      )}

      {/* VIEW 3: STRUCTURED TABLE VIEW */}
      {activeView === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-chrome border-b border-border-hairline font-mono text-[10px] text-ink-muted uppercase">
                <th className="py-2 px-3">KODE</th>
                <th className="py-2 px-3">TASK / MILESTONE</th>
                <th className="py-2 px-3">WARNA</th>
                <th className="py-2 px-3">MULAI</th>
                <th className="py-2 px-3">SELESAI</th>
                <th className="py-2 px-3">PROGRESS</th>
                <th className="py-2 px-3">EST (JAM)</th>
                <th className="py-2 px-3">MILESTONE</th>
                <th className="py-2 px-3 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-surface-hover/40">
                  <td className="py-1.5 px-3 font-mono text-[11px] text-ink-secondary">
                    <input
                      type="text"
                      value={item.code}
                      onChange={(e) => updateTask(item.id, { code: e.target.value })}
                      className="w-16 bg-transparent font-mono focus:outline-none focus:border-b focus:border-accent-cobalt"
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateTask(item.id, { title: e.target.value })}
                      className="w-full bg-transparent text-ink-primary focus:outline-none focus:border-b focus:border-accent-cobalt"
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <select
                      value={item.color}
                      onChange={(e) =>
                        updateTask(item.id, { color: e.target.value as MarkerColor })
                      }
                      className="bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 font-mono text-[10px] text-ink-primary"
                    >
                      {MARKER_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {c.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 px-3 font-mono text-[11px] tabular-nums">
                    <input
                      type="date"
                      value={item.startDate}
                      onChange={(e) => updateTask(item.id, { startDate: e.target.value })}
                      className="bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 text-ink-primary"
                    />
                  </td>
                  <td className="py-1.5 px-3 font-mono text-[11px] tabular-nums">
                    <input
                      type="date"
                      value={item.endDate}
                      onChange={(e) => updateTask(item.id, { endDate: e.target.value })}
                      className="bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 text-ink-primary"
                    />
                  </td>
                  <td className="py-1.5 px-3 font-mono text-[11px] tabular-nums">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.progress}
                      onChange={(e) =>
                        updateTask(item.id, { progress: Number(e.target.value) })
                      }
                      className="w-14 bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 text-ink-primary"
                    />
                    %
                  </td>
                  <td className="py-1.5 px-3 font-mono text-[11px] tabular-nums">
                    <input
                      type="number"
                      min={1}
                      value={item.estimateHours}
                      onChange={(e) =>
                        updateTask(item.id, { estimateHours: Number(e.target.value) })
                      }
                      className="w-14 bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 text-ink-primary"
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <button
                      onClick={() => updateTask(item.id, { isMilestone: !item.isMilestone })}
                      className={`p-1 rounded border ${
                        item.isMilestone
                          ? 'bg-accent-amber/20 border-accent-amber text-accent-amber'
                          : 'border-border-hairline text-ink-muted'
                      }`}
                    >
                      <Diamond size={12} />
                    </button>
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <button
                      onClick={() => handleDeleteTask(item.id)}
                      className="p-1 rounded hover:bg-[#EF4444]/15 text-ink-muted hover:text-[#EF4444]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 4: DATA VISUALIZATION CHARTS (Bar, Area, Donut) */}
      {activeView === 'chart' && (
        <div className="p-4 bg-canvas-primary">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-xs text-ink-secondary">
              VISUALISASI BEBAN KERJA (JAM) & PROGRESS PER MODUL
            </span>
            <div className="flex items-center gap-1 font-mono text-[10px]">
              {(['bar', 'area', 'donut'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => onChange({ databaseChartType: type })}
                  className={`px-2.5 py-1 rounded border uppercase ${
                    chartType === type
                      ? 'bg-accent-cobalt text-white border-accent-cobalt'
                      : 'bg-surface-elevated text-ink-secondary border-border-hairline'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-hairline)',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono'
                    }}
                  />
                  <Bar dataKey="progress" name="Progress (%)" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.colorHex} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="hours"
                    name="Estimasi Jam"
                    fill="#F59E0B"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              ) : chartType === 'area' ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-hairline)',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="progress"
                    name="Progress (%)"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.25}
                  />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    name="Estimasi Jam"
                    stroke="#F59E0B"
                    fill="#F59E0B"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              ) : (
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="hours"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    label={(props: any) => `${props.name} (${props.hours}h)`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`pie-${index}`} fill={entry.colorHex} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-hairline)',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono'
                    }}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
