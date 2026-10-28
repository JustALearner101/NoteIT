import { describe, expect, it } from 'vitest'
import type { MarkerColor, ProjectTaskItem } from '@shared/types/domain'
import {
  CHART_KINDS,
  DEFAULT_CHART_KIND,
  buildChartSeries,
  chartTooltipStyle,
  resolveChartKind
} from './chart-data'

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
    progress: 40,
    isMilestone: false,
    dependsOn: [],
    assignee: 'Engineer',
    estimateHours: 16,
    ...overrides
  }
}

describe('resolveChartKind', () => {
  it('line tetap line (regresi: dulu jatuh ke pie karena fallback else)', () => {
    expect(resolveChartKind('line')).toBe('line')
  })

  it('menerima semua jenis yang didukung', () => {
    for (const kind of CHART_KINDS) {
      expect(resolveChartKind(kind)).toBe(kind)
    }
    expect(CHART_KINDS).toContain('radar')
    expect(CHART_KINDS).toContain('scatter')
  })

  it('nilai tak dikenal jatuh ke bar, bukan donut', () => {
    expect(resolveChartKind('treemap')).toBe('bar')
    expect(resolveChartKind('DONUT')).toBe('bar')
    expect(resolveChartKind('')).toBe('bar')
    expect(DEFAULT_CHART_KIND).toBe('bar')
  })

  it('undefined dan null jatuh ke bar', () => {
    expect(resolveChartKind(undefined)).toBe('bar')
    expect(resolveChartKind(null)).toBe('bar')
  })
})

describe('buildChartSeries per item', () => {
  it('menghasilkan satu titik per task dengan kode sebagai name', () => {
    const series = buildChartSeries([
      makeTask(),
      makeTask({ id: 'tsk-2', code: 'TSK-02', title: 'Kedua', estimateHours: 8, progress: 100 })
    ])

    expect(series).toHaveLength(2)
    expect(series[0]).toMatchObject({
      name: 'TSK-01',
      fullTitle: 'Task',
      progress: 40,
      hours: 16,
      colorHex: '#3B82F6'
    })
    expect(series[1]).toMatchObject({ name: 'TSK-02', hours: 8, progress: 100 })
  })

  it('daftar kosong menghasilkan seri kosong', () => {
    expect(buildChartSeries([])).toEqual([])
    expect(buildChartSeries([], { dimension: 'category' })).toEqual([])
  })

  it('warna tak dikenal memakai fallback biru', () => {
    const series = buildChartSeries([makeTask({ color: 'tidak-ada' as MarkerColor })])

    expect(series[0].colorHex).toBe('#3B82F6')
  })
})

describe('buildChartSeries per kategori', () => {
  it('menjumlahkan hours dan merata-ratakan progress', () => {
    const series = buildChartSeries(
      [
        makeTask({ category: 'Engineering', estimateHours: 16, progress: 40 }),
        makeTask({ id: 'tsk-2', category: 'Engineering', estimateHours: 4, progress: 100 }),
        makeTask({ id: 'tsk-3', category: 'Design', estimateHours: 8, progress: 25 })
      ],
      { dimension: 'category' }
    )

    const engineering = series.find((point) => point.name === 'Engineering')
    const design = series.find((point) => point.name === 'Design')

    expect(series).toHaveLength(2)
    expect(engineering).toMatchObject({ hours: 20, progress: 70, count: 2 })
    expect(design).toMatchObject({ hours: 8, progress: 25, count: 1 })
  })
})

describe('chartTooltipStyle', () => {
  it('memakai variabel tema yang sama dengan chart lama', () => {
    expect(chartTooltipStyle.backgroundColor).toBe('var(--bg-surface-elevated)')
    expect(chartTooltipStyle.borderColor).toBe('var(--border-hairline)')
    expect(chartTooltipStyle.fontFamily).toBe('JetBrains Mono')
  })
})
