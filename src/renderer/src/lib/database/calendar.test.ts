import { describe, expect, it } from 'vitest'
import type { ProjectTaskItem } from '@shared/types/domain'
import { buildMonthGrid, moveTaskToDate, resizeTaskEnd, taskDurationDays, tasksForDate } from './calendar'

function makeTask(overrides: Partial<ProjectTaskItem> = {}): ProjectTaskItem {
  return {
    id: 'tsk-1',
    code: 'TSK-01',
    title: 'Task',
    category: 'Engineering',
    color: 'cobalt',
    status: 'backlog',
    startDate: '2026-10-26',
    endDate: '2026-10-30',
    progress: 0,
    isMilestone: false,
    dependsOn: [],
    assignee: 'Engineer',
    estimateHours: 16,
    ...overrides
  }
}

const flat = (grid: string[][]): string[] => grid.flat()

describe('buildMonthGrid', () => {
  it('Februari 2026 berisi 28 hari dan tidak pernah 29', () => {
    const days = flat(buildMonthGrid(2026, 2))

    expect(days).toContain('2026-02-01')
    expect(days).toContain('2026-02-28')
    expect(days).not.toContain('2026-02-29')
    expect(days.filter((iso) => iso.startsWith('2026-02'))).toHaveLength(28)
  })

  it('selalu berupa matriks 6x7', () => {
    const grid = buildMonthGrid(2026, 2)

    expect(grid).toHaveLength(6)
    for (const week of grid) expect(week).toHaveLength(7)
    expect(flat(grid)).toHaveLength(42)
  })

  it('minggu mulai Senin vs Minggu menggeser sel pertama', () => {
    // 1 Februari 2026 jatuh pada hari Minggu.
    expect(buildMonthGrid(2026, 2, 1)[0][0]).toBe('2026-01-26')
    expect(buildMonthGrid(2026, 2, 0)[0][0]).toBe('2026-02-01')
    expect(buildMonthGrid(2026, 2)[0][0]).toBe('2026-01-26')
  })

  it('bulan yang butuh 6 minggu tetap terpotong rapi', () => {
    // 1 Agustus 2026 = Sabtu, jadi grid Senin mulai 27 Juli dan berakhir 6 September.
    const days = flat(buildMonthGrid(2026, 8))

    expect(days[0]).toBe('2026-07-27')
    expect(days[41]).toBe('2026-09-06')
    expect(days).toContain('2026-08-31')
  })

  it('sel di luar bulan tetap ikut supaya tinggi grid stabil', () => {
    const days = flat(buildMonthGrid(2026, 2))

    expect(days[0].startsWith('2026-01')).toBe(true)
    expect(days[41].startsWith('2026-03')).toBe(true)
  })
})

describe('tasksForDate', () => {
  it('memakai rentang inklusif di kedua ujung', () => {
    const items = [makeTask()]

    expect(tasksForDate(items, '2026-10-26')).toHaveLength(1)
    expect(tasksForDate(items, '2026-10-28')).toHaveLength(1)
    expect(tasksForDate(items, '2026-10-30')).toHaveLength(1)
  })

  it('tidak menyertakan task di luar rentang', () => {
    const items = [makeTask()]

    expect(tasksForDate(items, '2026-10-25')).toHaveLength(0)
    expect(tasksForDate(items, '2026-10-31')).toHaveLength(0)
  })

  it('mengembalikan kosong untuk tanggal tidak valid', () => {
    expect(tasksForDate([makeTask()], '2026-02-30')).toHaveLength(0)
  })
})

describe('moveTaskToDate', () => {
  it('mempertahankan durasi saat dipindah lintas bulan', () => {
    const moved = moveTaskToDate(makeTask(), '2026-11-03')

    expect(moved.startDate).toBe('2026-11-03')
    expect(moved.endDate).toBe('2026-11-07')
    expect(taskDurationDays(moved)).toBe(5)
  })

  it('task satu hari tetap satu hari', () => {
    const moved = moveTaskToDate(makeTask({ startDate: '2026-10-27', endDate: '2026-10-27' }), '2026-12-31')

    expect(moved.endDate).toBe('2026-12-31')
  })
})

describe('resizeTaskEnd', () => {
  it('memperpanjang tanggal selesai', () => {
    expect(resizeTaskEnd(makeTask(), '2026-11-05').endDate).toBe('2026-11-05')
  })

  it('end sebelum start diperlakukan sebagai 1 hari', () => {
    const resized = resizeTaskEnd(makeTask(), '2026-10-01')

    expect(resized.endDate).toBe('2026-10-26')
    expect(taskDurationDays(resized)).toBe(1)
  })

  it('tanggal tidak valid tidak mengubah task', () => {
    expect(resizeTaskEnd(makeTask(), '2026-02-30').endDate).toBe('2026-10-30')
  })
})
