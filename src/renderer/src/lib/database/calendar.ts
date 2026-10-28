/**
 * Grid bulan dan operasi tanggal untuk Calendar view.
 * Bulan memakai penomoran 1-12 (Januari = 1) agar sama dengan input pengguna.
 */
import type { ProjectTaskItem } from '@shared/types/domain'
import { DAY_MS, addDays, diffDays, formatIsoDate, parseIsoDate } from './dates'

export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Matriks 6x7 (42 sel) berisi ISO date. Sel di luar bulan tetap disertakan supaya
 * tinggi grid stabil saat navigasi bulan.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  weekStartsOn: WeekStartsOn = 1
): string[][] {
  const firstMs = Date.UTC(year, month - 1, 1)
  const firstWeekday = new Date(firstMs).getUTCDay()
  const lead = (firstWeekday - weekStartsOn + 7) % 7
  const gridStartMs = firstMs - lead * DAY_MS

  const weeks: string[][] = []
  for (let week = 0; week < 6; week += 1) {
    const row: string[] = []
    for (let day = 0; day < 7; day += 1) {
      row.push(formatIsoDate(gridStartMs + (week * 7 + day) * DAY_MS))
    }
    weeks.push(row)
  }
  return weeks
}

/** Task yang rentang startDate..endDate-nya memuat iso (inklusif). */
export function tasksForDate(items: ProjectTaskItem[], iso: string): ProjectTaskItem[] {
  const target = parseIsoDate(iso)
  if (target === null) return []

  return items.filter((item) => {
    const start = parseIsoDate(item.startDate)
    const end = parseIsoDate(item.endDate)
    if (start === null || end === null) return false
    return target >= start && target <= end
  })
}

/** Durasi inklusif dalam hari; end < start atau tidak valid dihitung 1 hari. */
export function taskDurationDays(task: ProjectTaskItem): number {
  const span = diffDays(task.endDate, task.startDate)
  if (span === null || span < 0) return 1
  return span + 1
}

/** Pindahkan task ke tanggal baru tanpa mengubah durasi. */
export function moveTaskToDate(task: ProjectTaskItem, iso: string): ProjectTaskItem {
  return {
    ...task,
    startDate: iso,
    endDate: addDays(iso, taskDurationDays(task) - 1)
  }
}

/** Set tanggal selesai; kalau sebelum start, perlakukan sebagai 1 hari. */
export function resizeTaskEnd(task: ProjectTaskItem, iso: string): ProjectTaskItem {
  const start = parseIsoDate(task.startDate)
  const end = parseIsoDate(iso)
  if (start === null || end === null) return { ...task }
  if (end < start) return { ...task, endDate: task.startDate }
  return { ...task, endDate: iso }
}
