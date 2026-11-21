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
import { SegmentedControl } from '@renderer/components/ui'
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
              stroke="#6E7BF2"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="hours"
              name="Estimated Hours"
              stroke="#2DD4BF"
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
              stroke="#6E7BF2"
              fill="#6E7BF2"
              fillOpacity={0.22}
            />
            <Area
              type="monotone"
              dataKey="hours"
              name="Estimated Hours"
              stroke="#2DD4BF"
              fill="#2DD4BF"
              fillOpacity={0.18}
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
              stroke="#6E7BF2"
              fill="#6E7BF2"
              fillOpacity={0.26}
            />
            <Radar
              name="Estimated Hours"
              dataKey="hours"
              stroke="#2DD4BF"
              fill="#2DD4BF"
              fillOpacity={0.18}
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
              name="Estimated Hours"
              stroke="var(--text-secondary)"
              fontSize={11}
            />
            <ZAxis type="number" dataKey="durationDays" name="Duration (days)" range={[60, 400]} />
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
            <Bar dataKey="progress" name="Progress (%)" radius={[6, 6, 0, 0]}>
              {itemSeries.map((entry, index) => (
                <Cell key={'cell-' + index} fill={entry.colorHex} />
              ))}
            </Bar>
            <Bar dataKey="hours" name="Estimated Hours" fill="#E5A93C" radius={[6, 6, 0, 0]} />
          </BarChart>
        )
    }
  }


  return (
    <div className="p-4 bg-canvas-primary">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <span className="text-xs font-medium text-ink-secondary">
          Workload (hours) &amp; progress by module
        </span>
        <SegmentedControl<ChartKind>
          size="xs"
          value={kind}
          onChange={(option) => onChange({ databaseChartType: option })}
          options={CHART_KINDS.map((option) => {
            const Icon = CHART_ICONS[option]
            return {
              value: option,
              label: option.charAt(0).toUpperCase() + option.slice(1),
              icon: <Icon size={11} />
            }
          })}
        />
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(kind)}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

