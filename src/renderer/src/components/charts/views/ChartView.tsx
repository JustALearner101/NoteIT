import React, { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from 'recharts'
import {
  AreaChart as AreaChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Radar as RadarIcon,
  ScatterChart as ScatterChartIcon
} from 'lucide-react'
import {
  CHART_KINDS,
  buildChartSeries,
  chartTooltipStyle,
  resolveChartKind
} from '@renderer/lib/database/chart-data'
import type { ChartKind } from '@renderer/lib/database/chart-data'
import type { ChartViewProps } from './types'

const CHART_ICONS: Record<ChartKind, React.ComponentType<{ size?: number }>> = {
  bar: BarChart3,
  line: LineChartIcon,
  area: AreaChartIcon,
  donut: PieChartIcon,
  radar: RadarIcon,
  scatter: ScatterChartIcon
}

export const ChartView: React.FC<ChartViewProps> = ({ items, onChange, chartType }) => {
  const kind = resolveChartKind(chartType)

  // Satu titik per task untuk bar/line/area/scatter, agregasi per kategori untuk donut/radar.
  const itemSeries = useMemo(() => buildChartSeries(items, { dimension: 'item' }), [items])
  const categorySeries = useMemo(
    () => buildChartSeries(items, { dimension: 'category' }),
    [items]
  )


  /**
   * Switch eksplisit: tidak ada rantai else yang membuat 'line' diam-diam menjadi
   * donut. Tipe asing sudah dinormalisasi resolveChartKind menjadi 'bar'.
   */
  const renderChart = (chartKind: ChartKind): React.ReactElement => {
    const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
    const xAxis = <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
    const yAxis = <YAxis stroke="var(--text-secondary)" fontSize={11} />
    const tooltip = <Tooltip contentStyle={chartTooltipStyle} />

    switch (chartKind) {
      case 'line':
        return (
          <LineChart data={itemSeries}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Line
              type="monotone"
              dataKey="progress"
              name="Progress (%)"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="hours"
              name="Estimasi Jam"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart data={itemSeries}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Area
              type="monotone"
              dataKey="progress"
              name="Progress (%)"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.25}
            />
            <Area
              type="monotone"
              dataKey="hours"
              name="Estimasi Jam"
              stroke="#F59E0B"
              fill="#F59E0B"
              fillOpacity={0.2}
            />
          </AreaChart>
        )

      case 'donut':
        return (
          <PieChart>
            <Pie
              data={categorySeries}
              dataKey="hours"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              label={(props: any) => props.name + ' (' + props.hours + 'h)'}
            >
              {categorySeries.map((entry, index) => (
                <Cell key={'pie-' + index} fill={entry.colorHex} />
              ))}
            </Pie>
            {tooltip}
          </PieChart>
        )


      case 'radar':
        return (
          <RadarChart data={categorySeries} outerRadius="75%">
            <PolarGrid stroke="var(--border-hairline)" />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              stroke="var(--border-hairline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            />
            {tooltip}
            <Radar
              name="Progress (%)"
              dataKey="progress"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
            />
            <Radar
              name="Estimasi Jam"
              dataKey="hours"
              stroke="#F59E0B"
              fill="#F59E0B"
              fillOpacity={0.2}
            />
          </RadarChart>
        )

      case 'scatter':
        return (
          <ScatterChart>
            {grid}
            <XAxis
              type="number"
              dataKey="progress"
              name="Progress (%)"
              domain={[0, 100]}
              stroke="var(--text-secondary)"
              fontSize={11}
            />
            <YAxis
              type="number"
              dataKey="hours"
              name="Estimasi Jam"
              stroke="var(--text-secondary)"
              fontSize={11}
            />
            <ZAxis type="number" dataKey="durationDays" name="Durasi (hari)" range={[60, 400]} />
            {tooltip}
            <Scatter name="Task" data={itemSeries}>
              {itemSeries.map((entry, index) => (
                <Cell key={'scatter-' + index} fill={entry.colorHex} />
              ))}
            </Scatter>
          </ScatterChart>
        )

      case 'bar':
      default:
        // default hanya jaring pengaman untuk nilai runtime di luar union; hasilnya
        // 'bar', bukan donut, sama seperti resolveChartKind.
        return (
          <BarChart data={itemSeries}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Bar dataKey="progress" name="Progress (%)" radius={[4, 4, 0, 0]}>
              {itemSeries.map((entry, index) => (
                <Cell key={'cell-' + index} fill={entry.colorHex} />
              ))}
            </Bar>
            <Bar dataKey="hours" name="Estimasi Jam" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        )
    }
  }


  return (
    <div className="p-4 bg-canvas-primary">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <span className="font-mono text-xs text-ink-secondary">
          VISUALISASI BEBAN KERJA (JAM) & PROGRESS PER MODUL
        </span>
        <div className="p-0.5 rounded bg-surface-elevated border border-border-hairline flex items-center font-mono text-[10px]">
          {CHART_KINDS.map((option) => {
            const Icon = CHART_ICONS[option]
            return (
              <button
                key={option}
                onClick={() => onChange({ databaseChartType: option })}
                className={
                  'px-2.5 py-1 rounded flex items-center gap-1 uppercase ' +
                  (kind === option
                    ? 'bg-accent-cobalt text-white font-semibold'
                    : 'text-ink-secondary hover:text-ink-primary')
                }
              >
                <Icon size={11} />
                <span>{option}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(kind)}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

