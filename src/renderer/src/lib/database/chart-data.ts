/**
 * Pemetaan chartType -> jenis chart dan pembentukan seri data untuk Recharts.
 *
 * resolveChartKind sengaja memakai daftar eksplisit: nilai tak dikenal jatuh ke
 * 'bar', bukan diam-diam menjadi donut seperti fallback else di komponen lama.
 */
import type { ProjectTaskItem } from '@shared/types/domain'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { taskDurationDays } from './calendar'

export const CHART_KINDS = ['bar', 'line', 'area', 'donut', 'radar', 'scatter'] as const

export type ChartKind = (typeof CHART_KINDS)[number]

export const DEFAULT_CHART_KIND: ChartKind = 'bar'

export function resolveChartKind(type: string | null | undefined): ChartKind {
  if (type && (CHART_KINDS as readonly string[]).includes(type)) {
    return type as ChartKind
  }
  return DEFAULT_CHART_KIND
}

export interface ChartSeriesPoint {
  name: string
  fullTitle: string
  progress: number
  hours: number
  colorHex: string
  count: number
  /** Durasi inklusif dalam hari; dipakai Scatter sebagai ukuran marker (Z). */
  durationDays: number
}

export interface ChartSeriesOptions {
  /** 'item' = satu titik per task, 'category' = agregasi per kategori. */
  dimension: 'item' | 'category'
}

const FALLBACK_HEX = '#3B82F6'

function colorHexOf(item: ProjectTaskItem): string {
  return MARKER_META[item.color]?.hex || FALLBACK_HEX
}

export function buildChartSeries(
  items: ProjectTaskItem[],
  options: ChartSeriesOptions = { dimension: 'item' }
): ChartSeriesPoint[] {
  if (options.dimension === 'category') {
    const buckets = new Map<
      string,
      { hours: number; progressSum: number; count: number; colorHex: string; durationSum: number }
    >()

    for (const item of items) {
      const bucket = buckets.get(item.category) ?? {
        hours: 0,
        progressSum: 0,
        count: 0,
        colorHex: colorHexOf(item),
        durationSum: 0
      }
      bucket.hours += item.estimateHours
      bucket.progressSum += item.progress
      bucket.count += 1
      bucket.durationSum += taskDurationDays(item)
      buckets.set(item.category, bucket)
    }

    return Array.from(buckets, ([name, bucket]) => ({
      name,
      fullTitle: name,
      hours: bucket.hours,
      progress: Math.round(bucket.progressSum / bucket.count),
      colorHex: bucket.colorHex,
      count: bucket.count,
      durationDays: bucket.durationSum
    }))
  }

  return items.map((item) => ({
    name: item.code,
    fullTitle: item.title,
    progress: item.progress,
    hours: item.estimateHours,
    colorHex: colorHexOf(item),
    count: 1,
    durationDays: taskDurationDays(item)
  }))
}

/** Style tooltip bersama untuk semua chart (dulu disalin tiga kali di ChartView). */
export const chartTooltipStyle = {
  backgroundColor: 'var(--bg-surface-elevated)',
  borderColor: 'var(--border-hairline)',
  fontSize: '12px',
  fontFamily: 'JetBrains Mono'
}
