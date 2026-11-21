/**
 * Operasi murni atas daftar ProjectTaskItem. Tidak menyentuh React/DOM dan tidak
 * memutasi array input: selalu mengembalikan array baru.
 */
import type { ProjectTaskItem } from '@shared/types/domain'
import { MARKER_COLORS } from '@renderer/lib/marker-colors'
import { createId } from '@renderer/lib/ids'
import { addDays, parseIsoDate } from './dates'

export function updateTask(
  items: ProjectTaskItem[],
  taskId: string,
  patch: Partial<ProjectTaskItem>
): ProjectTaskItem[] {
  return items.map((item) => (item.id === taskId ? { ...item, ...patch } : item))
}

/** Hapus task dan bersihkan referensi dependsOn yang menunjuk ke id tersebut. */
export function deleteTask(items: ProjectTaskItem[], taskId: string): ProjectTaskItem[] {
  return items
    .filter((item) => item.id !== taskId)
    .map((item) => ({
      ...item,
      dependsOn: (item.dependsOn || []).filter((depId) => depId !== taskId)
    }))
}

/** Geser start dan end bersama-sama, durasi tetap. */
export function shiftTask(task: ProjectTaskItem, deltaDays: number): ProjectTaskItem {
  return {
    ...task,
    startDate: addDays(task.startDate, deltaDays),
    endDate: addDays(task.endDate, deltaDays)
  }
}

/**
 * Task baru: menempel setelah task terakhir (mulai di endDate-nya, durasi 4 hari),
 * atau mulai hari ini kalau daftar kosong.
 */
export function createTask(items: ProjectTaskItem[], todayIso: string): ProjectTaskItem {
  const nextNum = items.length + 1
  const lastTask = items[items.length - 1]
  const startDate = lastTask ? lastTask.endDate : todayIso

  return {
    id: createId('tsk'),
    code: 'TSK-' + String(nextNum).padStart(2, '0'),
    title: 'New engineering task specification',
    category: 'Engineering',
    color: MARKER_COLORS[nextNum % MARKER_COLORS.length],
    status: 'backlog',
    startDate,
    endDate: addDays(startDate, 4),
    progress: 0,
    isMilestone: false,
    dependsOn: lastTask ? [lastTask.id] : [],
    assignee: 'Engineer',
    estimateHours: 16
  }
}

/** Urut naik berdasarkan startDate. Tanggal tidak valid ditaruh paling akhir. */
export function sortByStartDate(items: ProjectTaskItem[]): ProjectTaskItem[] {
  return [...items].sort((a, b) => {
    const aMs = parseIsoDate(a.startDate)
    const bMs = parseIsoDate(b.startDate)
    if (aMs === null && bMs === null) return 0
    if (aMs === null) return 1
    if (bMs === null) return -1
    return aMs - bMs
  })
}

/**
 * Patch for moving a task to another stage (Kanban drop / stage select).
 * Returns null when the stage is unchanged. Completed always implies 100% progress.
 */
export function stagePatch(
  task: Pick<ProjectTaskItem, 'status' | 'progress'>,
  nextStatus: ProjectTaskItem['status']
): Partial<ProjectTaskItem> | null {
  if (task.status === nextStatus) return null
  return { status: nextStatus, progress: nextStatus === 'done' ? 100 : task.progress }
}

export type GanttDragMode = 'move' | 'resize-start' | 'resize-end'

/**
 * New dates after dragging a Gantt bar by deltaDays. Resizing keeps at least a one-day
 * duration (start <= end). Invalid input dates are returned unchanged.
 */
export function computeGanttBarDragDates(
  task: Pick<ProjectTaskItem, 'startDate' | 'endDate'>,
  mode: GanttDragMode,
  deltaDays: number
): { startDate: string; endDate: string } {
  const startMs = parseIsoDate(task.startDate)
  const endMs = parseIsoDate(task.endDate)
  if (startMs === null || endMs === null) {
    return { startDate: task.startDate, endDate: task.endDate }
  }
  if (mode === 'move') {
    return {
      startDate: addDays(task.startDate, deltaDays),
      endDate: addDays(task.endDate, deltaDays)
    }
  }
  if (mode === 'resize-start') {
    const nextStart = addDays(task.startDate, deltaDays)
    const clamped = (parseIsoDate(nextStart) ?? startMs) > endMs ? task.endDate : nextStart
    return { startDate: clamped, endDate: task.endDate }
  }
  const nextEnd = addDays(task.endDate, deltaDays)
  const clampedEnd = (parseIsoDate(nextEnd) ?? endMs) < startMs ? task.startDate : nextEnd
  return { startDate: task.startDate, endDate: clampedEnd }
}
