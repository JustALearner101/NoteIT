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

/** Label hari untuk grid dengan weekStartsOn = 1 (Senin). */
export const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const

/** Geser bulan tanpa melewati bulan 0 atau 13; delta boleh negatif. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 }
}

/** "Oktober 2026" menurut locale id-ID. Formatting sengaja di lib, bukan di JSX. */
export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

/** Apakah iso berada di bulan/tahun tertentu. Tanggal tidak valid -> false. */
export function isSameMonth(iso: string, year: number, month: number): boolean {
  const ms = parseIsoDate(iso)
  if (ms === null) return false
  const date = new Date(ms)
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month
}

export type TaskSpanPosition = 'single' | 'first' | 'middle' | 'last'

/**
 * Posisi potongan task pada satu tanggal: task sehari = single, hari pertama =
 * first, hari terakhir = last, sisanya middle. Null kalau tanggal di luar rentang.
 */
export function taskSpanPosition(task: ProjectTaskItem, iso: string): TaskSpanPosition | null {
  const target = parseIsoDate(iso)
  const start = parseIsoDate(task.startDate)
  const end = parseIsoDate(task.endDate)
  if (target === null || start === null || end === null) return null
  if (target < start || target > end) return null

  const isFirst = target === start
  const isLast = target === end
  if (isFirst && isLast) return 'single'
  if (isFirst) return 'first'
  if (isLast) return 'last'
  return 'middle'
}

/**
 * Kelas sudut chip supaya task multi-hari terlihat satu batang: hanya ujung
 * rentang yang membulat, potongan tengah rata di kedua sisi.
 */
export function taskSpanClass(task: ProjectTaskItem, iso: string): string {
  switch (taskSpanPosition(task, iso)) {
    case 'single':
      return 'rounded-[3px]'
    case 'first':
      return 'rounded-l-[3px]'
    case 'last':
      return 'rounded-r-[3px]'
    default:
      return ''
  }
}
