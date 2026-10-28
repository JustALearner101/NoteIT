import React, { useMemo } from 'react'
import { AlertTriangle, BarChart3, CalendarDays, GanttChart, Kanban, Plus, Table2 } from 'lucide-react'
import type { ProjectTaskItem } from '@shared/types/domain'
import { moveTaskToDate } from '@renderer/lib/database/calendar'
import { parseIsoDate, todayIso } from '@renderer/lib/database/dates'
import { createTask, deleteTask, shiftTask, updateTask } from '@renderer/lib/database/tasks'
import { CalendarView } from './views/CalendarView'
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
      const taskStart = parseIsoDate(task.startDate)
      if (taskStart === null) continue
      for (const depId of task.dependsOn || []) {
        const pred = items.find((i) => i.id === depId)
        const predEnd = pred ? parseIsoDate(pred.endDate) : null
        if (pred && predEnd !== null && taskStart < predEnd) {
          list.push({ fromCode: pred.code, toCode: task.code })
        }
      }
    }
    return list
  }, [items])

  const handleUpdateTask = (taskId: string, patch: Partial<ProjectTaskItem>): void => {
    onChange({ databaseItems: updateTask(items, taskId, patch) })
  }

  const handleShiftTask = (task: ProjectTaskItem, deltaDays: number): void => {
    const next = shiftTask(task, deltaDays)
    handleUpdateTask(task.id, { startDate: next.startDate, endDate: next.endDate })
  }

  /**
   * startDate opsional dari Calendar: createTask menempel setelah task terakhir,
   * jadi task baru digeser ke tanggal terpilih kalau parameter diberikan.
   */
  const handleAddTask = (startDate?: string): void => {
    const created = createTask(items, startDate ?? todayIso())
    const next = startDate ? moveTaskToDate(created, startDate) : created
    onChange({ databaseItems: [...items, next] })
  }

  const handleDeleteTask = (taskId: string): void => {
    onChange({ databaseItems: deleteTask(items, taskId) })
  }

  const viewProps = {
    items,
    onChange,
    updateTask: handleUpdateTask,
    shiftTask: handleShiftTask,
    handleAddTask,
    handleDeleteTask
  }

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
          {/* 5-View Switcher: Gantt | Kanban | Table | Data Chart | Calendar */}
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
            <button
              onClick={() => onChange({ databaseActiveView: 'calendar' })}
              className={`px-2.5 py-1 rounded flex items-center gap-1 ${
                activeView === 'calendar'
                  ? 'bg-accent-cobalt text-white font-semibold'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <CalendarDays size={11} />
              <span>Calendar</span>
            </button>
          </div>

          <button
            onClick={() => handleAddTask()}
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
      {activeView === 'calendar' && <CalendarView {...viewProps} />}
    </div>
  )
}
