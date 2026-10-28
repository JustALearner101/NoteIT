import React, { useMemo } from 'react'
import { AlertTriangle, BarChart3, GanttChart, Kanban, Plus, Table2 } from 'lucide-react'
import type { ProjectTaskItem } from '@shared/types/domain'
import { MARKER_COLORS } from '@renderer/lib/marker-colors'
import { createId } from '@renderer/lib/ids'
import { ChartView } from './views/ChartView'
import { GanttView } from './views/GanttView'
import { KanbanView } from './views/KanbanView'
import { TableView } from './views/TableView'
import type { DatabaseChangePatch, DatabaseChartType, DatabaseView } from './views/types'

interface ProjectDatabaseBlockProps {
  title: string
  activeView: DatabaseView
  chartType: DatabaseChartType
  items: ProjectTaskItem[]
  onChange: (updates: DatabaseChangePatch) => void
}

const DAY_MS = 86400000

function parseDateUTC(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y || 2026, (m || 10) - 1, d || 1)
}

function formatDateUTC(ms: number): string {
  const d = new Date(ms)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return yyyy + '-' + mm + '-' + dd
}

export const ProjectDatabaseBlock: React.FC<ProjectDatabaseBlockProps> = ({
  title,
  activeView = 'gantt',
  chartType = 'bar',
  items = [],
  onChange
}) => {
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

  const shiftTask = (task: ProjectTaskItem, deltaDays: number): void => {
    const nextStart = formatDateUTC(parseDateUTC(task.startDate) + deltaDays * DAY_MS)
    const nextEnd = formatDateUTC(parseDateUTC(task.endDate) + deltaDays * DAY_MS)
    updateTask(task.id, { startDate: nextStart, endDate: nextEnd })
  }

  const handleAddTask = (): void => {
    const nextNum = items.length + 1
    const lastTask = items[items.length - 1]
    const newTask: ProjectTaskItem = {
      id: createId('tsk'),
      code: 'TSK-' + String(nextNum).padStart(2, '0'),
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

  const viewProps = { items, onChange, updateTask, shiftTask, handleAddTask, handleDeleteTask }

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


      {activeView === 'gantt' && <GanttView {...viewProps} />}
      {activeView === 'kanban' && <KanbanView {...viewProps} />}
      {activeView === 'table' && <TableView {...viewProps} />}
      {activeView === 'chart' && <ChartView {...viewProps} chartType={chartType} />}
    </div>
  )
}
