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
    title: 'Spesifikasi Task Engineering Baru',
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
