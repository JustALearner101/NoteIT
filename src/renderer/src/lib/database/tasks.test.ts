import { describe, expect, it } from 'vitest'
import type { ProjectTaskItem } from '@shared/types/domain'
import { createTask, deleteTask, shiftTask, sortByStartDate, updateTask } from './tasks'

function makeTask(overrides: Partial<ProjectTaskItem> = {}): ProjectTaskItem {
  return {
    id: 'tsk-1',
    code: 'TSK-01',
    title: 'Task',
    category: 'Engineering',
    color: 'cobalt',
    status: 'backlog',
    startDate: '2026-10-27',
    endDate: '2026-10-31',
    progress: 0,
    isMilestone: false,
    dependsOn: [],
    assignee: 'Engineer',
    estimateHours: 16,
    ...overrides
  }
}

describe('updateTask', () => {
  it('hanya mengubah task yang id-nya cocok', () => {
    const items = [makeTask(), makeTask({ id: 'tsk-2', title: 'Lain' })]
    const next = updateTask(items, 'tsk-2', { progress: 50 })

    expect(next[0].progress).toBe(0)
    expect(next[1].progress).toBe(50)
    expect(next[1].title).toBe('Lain')
  })

  it('tidak memutasi array maupun objek input', () => {
    const items = [makeTask()]
    const next = updateTask(items, 'tsk-1', { title: 'Baru' })

    expect(items[0].title).toBe('Task')
    expect(next).not.toBe(items)
    expect(next[0]).not.toBe(items[0])
  })
})

describe('deleteTask', () => {
  it('menghapus task dari daftar', () => {
    const items = [makeTask(), makeTask({ id: 'tsk-2', code: 'TSK-02' })]
    const next = deleteTask(items, 'tsk-1')

    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('tsk-2')
  })

  it('membersihkan dependsOn yang menunjuk id terhapus', () => {
    const items = [
      makeTask(),
      makeTask({ id: 'tsk-2', dependsOn: ['tsk-1', 'tsk-3'] }),
      makeTask({ id: 'tsk-3', dependsOn: ['tsk-1'] })
    ]
    const next = deleteTask(items, 'tsk-1')

    expect(next.find((item) => item.id === 'tsk-2')?.dependsOn).toEqual(['tsk-3'])
    expect(next.find((item) => item.id === 'tsk-3')?.dependsOn).toEqual([])
  })

  it('tidak memutasi input dan aman untuk id tak dikenal', () => {
    const items = [makeTask({ dependsOn: ['tsk-1'] })]
    const next = deleteTask(items, 'tidak-ada')

    expect(next).toHaveLength(1)
    expect(items[0].dependsOn).toEqual(['tsk-1'])
    expect(next[0]).not.toBe(items[0])
  })
})

describe('shiftTask', () => {
  it('menggeser lintas batas bulan', () => {
    const shifted = shiftTask(makeTask({ startDate: '2026-10-30', endDate: '2026-11-02' }), 3)

    expect(shifted.startDate).toBe('2026-11-02')
    expect(shifted.endDate).toBe('2026-11-05')
  })

  it('menggeser lintas batas tahun dengan delta negatif', () => {
    const shifted = shiftTask(makeTask({ startDate: '2027-01-01', endDate: '2027-01-05' }), -1)

    expect(shifted.startDate).toBe('2026-12-31')
    expect(shifted.endDate).toBe('2027-01-04')
  })

  it('durasi tetap sama dan input tidak berubah', () => {
    const task = makeTask()
    const shifted = shiftTask(task, 7)

    expect(task.startDate).toBe('2026-10-27')
    expect(shifted).not.toBe(task)
    expect(shifted.endDate).toBe('2026-11-07')
  })
})

describe('createTask', () => {
  it('memakai todayIso saat daftar kosong', () => {
    const task = createTask([], '2026-03-05')

    expect(task.startDate).toBe('2026-03-05')
    expect(task.endDate).toBe('2026-03-09')
    expect(task.dependsOn).toEqual([])
    expect(task.code).toBe('TSK-01')
    expect(task.progress).toBe(0)
    expect(task.id.startsWith('tsk-')).toBe(true)
  })

  it('menempel setelah task terakhir', () => {
    const last = makeTask({ id: 'tsk-9', code: 'TSK-09', endDate: '2026-11-10' })
    const task = createTask([makeTask(), last], '2026-03-05')

    expect(task.code).toBe('TSK-03')
    expect(task.startDate).toBe('2026-11-10')
    expect(task.endDate).toBe('2026-11-14')
    expect(task.dependsOn).toEqual(['tsk-9'])
  })
})

describe('sortByStartDate', () => {
  it('mengurutkan naik tanpa memutasi input', () => {
    const items = [
      makeTask({ id: 'c', startDate: '2026-11-01' }),
      makeTask({ id: 'a', startDate: '2026-01-15' }),
      makeTask({ id: 'b', startDate: '2026-05-20' })
    ]
    const sorted = sortByStartDate(items)

    expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(items.map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(sorted).not.toBe(items)
  })

  it('menaruh tanggal tidak valid di akhir', () => {
    const items = [
      makeTask({ id: 'bad', startDate: '2026-02-30' }),
      makeTask({ id: 'ok', startDate: '2026-05-20' })
    ]

    expect(sortByStartDate(items).map((item) => item.id)).toEqual(['ok', 'bad'])
  })
})
