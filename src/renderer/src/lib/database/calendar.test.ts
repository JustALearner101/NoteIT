import { describe, expect, it } from 'vitest'
import type { ProjectTaskItem } from '@shared/types/domain'
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  isSameMonth,
  monthLabel,
  moveTaskToDate,
  resizeTaskEnd,
  shiftMonth,
  taskDurationDays,
  taskSpanClass,
  taskSpanPosition,
  tasksForDate
} from './calendar'

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

describe('shiftMonth', () => {
  it('maju dari Desember ke Januari tahun berikutnya', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
  })

  it('mundur dari Januari ke Desember tahun sebelumnya', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
  })

  it('delta besar melewati beberapa tahun', () => {
    expect(shiftMonth(2026, 10, 15)).toEqual({ year: 2028, month: 1 })
    expect(shiftMonth(2026, 2, -14)).toEqual({ year: 2024, month: 12 })
  })

  it('delta nol tidak mengubah bulan', () => {
    expect(shiftMonth(2026, 7, 0)).toEqual({ year: 2026, month: 7 })
  })
})

describe('monthLabel', () => {
  it('memakai nama bulan dan tahun id-ID', () => {
    expect(monthLabel(2026, 10)).toBe('Oktober 2026')
  })

  it('Januari dan Desember tidak tertukar', () => {
    expect(monthLabel(2026, 1)).toBe('Januari 2026')
    expect(monthLabel(2026, 12)).toBe('Desember 2026')
  })

  it('Februari tahun kabisat tetap Februari', () => {
    expect(monthLabel(2028, 2)).toBe('Februari 2028')
  })
})


describe('isSameMonth', () => {
  it('true untuk tanggal di bulan yang sama', () => {
    expect(isSameMonth('2026-10-01', 2026, 10)).toBe(true)
    expect(isSameMonth('2026-10-31', 2026, 10)).toBe(true)
  })

  it('false untuk bulan lain meski tahun sama', () => {
    expect(isSameMonth('2026-09-30', 2026, 10)).toBe(false)
    expect(isSameMonth('2026-11-01', 2026, 10)).toBe(false)
  })

  it('false untuk tahun lain', () => {
    expect(isSameMonth('2025-10-15', 2026, 10)).toBe(false)
  })

  it('false untuk tanggal tidak valid', () => {
    expect(isSameMonth('2026-02-30', 2026, 2)).toBe(false)
  })
})

describe('WEEKDAY_LABELS', () => {
  it('dimulai Senin dan berakhir Minggu', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7)
    expect(WEEKDAY_LABELS[0]).toBe('Sen')
    expect(WEEKDAY_LABELS[6]).toBe('Min')
  })
})


describe('taskSpanPosition', () => {
  const task = makeTask({ startDate: '2026-10-26', endDate: '2026-10-29' })

  it('single untuk task sehari', () => {
    const oneDay = makeTask({ startDate: '2026-10-26', endDate: '2026-10-26' })
    expect(taskSpanPosition(oneDay, '2026-10-26')).toBe('single')
  })

  it('first di hari pertama', () => {
    expect(taskSpanPosition(task, '2026-10-26')).toBe('first')
  })

  it('middle di hari tengah', () => {
    expect(taskSpanPosition(task, '2026-10-27')).toBe('middle')
    expect(taskSpanPosition(task, '2026-10-28')).toBe('middle')
  })

  it('last di hari terakhir', () => {
    expect(taskSpanPosition(task, '2026-10-29')).toBe('last')
  })

  it('null di luar rentang atau tanggal tidak valid', () => {
    expect(taskSpanPosition(task, '2026-10-25')).toBeNull()
    expect(taskSpanPosition(task, '2026-10-30')).toBeNull()
    expect(taskSpanPosition(task, '2026-02-30')).toBeNull()
  })
})

describe('taskSpanClass', () => {
  const task = makeTask({ startDate: '2026-10-26', endDate: '2026-10-29' })

  it('single membulat di kedua sisi', () => {
    const oneDay = makeTask({ startDate: '2026-10-26', endDate: '2026-10-26' })
    expect(taskSpanClass(oneDay, '2026-10-26')).toBe('rounded-[3px]')
  })

  it('first hanya membulat di kiri', () => {
    expect(taskSpanClass(task, '2026-10-26')).toBe('rounded-l-[3px]')
  })

  it('middle rata di kedua sisi supaya terlihat satu batang', () => {
    expect(taskSpanClass(task, '2026-10-27')).toBe('')
  })

  it('last hanya membulat di kanan', () => {
    expect(taskSpanClass(task, '2026-10-29')).toBe('rounded-r-[3px]')
  })
})

