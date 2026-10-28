import type { ProjectTaskItem } from '@shared/types/domain'

export type DatabaseView = 'gantt' | 'kanban' | 'table' | 'chart'
export type DatabaseChartType = 'bar' | 'line' | 'area' | 'donut'

export interface DatabaseChangePatch {
  databaseTitle?: string
  databaseActiveView?: DatabaseView
  databaseChartType?: DatabaseChartType
  databaseItems?: ProjectTaskItem[]
}

export interface DatabaseViewProps {
  items: ProjectTaskItem[]
  onChange: (updates: DatabaseChangePatch) => void
  updateTask: (taskId: string, patch: Partial<ProjectTaskItem>) => void
  shiftTask: (task: ProjectTaskItem, deltaDays: number) => void
  handleAddTask: () => void
  handleDeleteTask: (taskId: string) => void
}

export interface ChartViewProps extends DatabaseViewProps {
  chartType: DatabaseChartType
}
