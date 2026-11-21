import React, { useMemo } from 'react'
import { AlertTriangle, BarChart3, CalendarDays, GanttChart, Kanban, Plus, Table2 } from 'lucide-react'
import type { ProjectTaskItem } from '@shared/types/domain'
import { moveTaskToDate } from '@renderer/lib/database/calendar'
import { parseIsoDate, todayIso } from '@renderer/lib/database/dates'
import { createTask, deleteTask, shiftTask, updateTask } from '@renderer/lib/database/tasks'
import { Badge, Button, SegmentedControl } from '@renderer/components/ui'
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

  const totalHours = useMemo(
    () => items.reduce((sum, item) => sum + (item.estimateHours || 0), 0),
    [items]
  )

  const openCount = useMemo(
    () => items.filter((item) => item.status !== 'done').length,
    [items]
  )

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
    <div className="rounded-[12px] bg-canvas-primary border border-border-hairline overflow-hidden shadow-card my-4">
      {/* Top Studio Header Bar (mirrors Reference Images 1 & 2 header) */}
      <div className="px-4 py-2.5 bg-surface-chrome/75 border-b border-border-hairline flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-[6px] bg-surface-elevated border border-border-hairline flex items-center justify-center shrink-0">
            <Table2 size={13} className="text-accent-cobalt" />
          </div>
          <input
            type="text"
            aria-label="Database block title"
            value={title}
            size={Math.max(18, title.length + 2)}
            onChange={(e) => onChange({ databaseTitle: e.target.value })}
            className="bg-transparent font-display text-[14px] font-semibold tracking-[-0.01em] text-ink-primary focus:outline-none border-b border-transparent focus:border-accent-cobalt min-w-[140px] max-w-[360px]"
          />
          <span className="text-xs text-ink-muted tabular-nums whitespace-nowrap hidden sm:inline">
            {openCount} open · {totalHours}h total
          </span>
          {conflicts.length > 0 && (
            <Badge tone="red" size="sm">
              <AlertTriangle size={11} aria-hidden="true" />
              <span>
                {conflicts.length} {conflicts.length === 1 ? 'conflict' : 'conflicts'} ({conflicts[0].fromCode} → {conflicts[0].toCode})
              </span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SegmentedControl<DatabaseView>
            size="xs"
            value={activeView}
            onChange={(nextView) => onChange({ databaseActiveView: nextView })}
            options={[
              { value: 'table', label: 'List', icon: <Table2 size={11.5} /> },
              { value: 'kanban', label: 'Board', icon: <Kanban size={11.5} /> },
              { value: 'gantt', label: 'Gantt', icon: <GanttChart size={11.5} /> },
              { value: 'calendar', label: 'Calendar', icon: <CalendarDays size={11.5} /> },
              { value: 'chart', label: 'Chart', icon: <BarChart3 size={11.5} /> }
            ]}
          />

          <Button variant="primary" size="sm" onClick={() => handleAddTask()}>
            <Plus size={12.5} />
            <span>Add task</span>
          </Button>
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
