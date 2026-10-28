import React, { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { MARKER_META } from '@renderer/lib/marker-colors'
import type { ChartViewProps } from './types'

export const ChartView: React.FC<ChartViewProps> = ({ items, onChange, chartType }) => {
  // Aggregated data for Recharts Data Visualization View
  const chartData = useMemo(() => {
    return items.map((item) => ({
      name: item.code,
      fullTitle: item.title,
      progress: item.progress,
      hours: item.estimateHours,
      colorHex: MARKER_META[item.color]?.hex || '#3B82F6'
    }))
  }, [items])

  return (
    <div className="p-4 bg-canvas-primary">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-xs text-ink-secondary">
          VISUALISASI BEBAN KERJA (JAM) & PROGRESS PER MODUL
        </span>
        <div className="flex items-center gap-1 font-mono text-[10px]">
          {(['bar', 'area', 'donut'] as const).map((type) => (
            <button
              key={type}
              onClick={() => onChange({ databaseChartType: type })}
              className={`px-2.5 py-1 rounded border uppercase ${
                chartType === type
                  ? 'bg-accent-cobalt text-white border-accent-cobalt'
                  : 'bg-surface-elevated text-ink-secondary border-border-hairline'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-hairline)',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono'
                }}
              />
              <Bar dataKey="progress" name="Progress (%)" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.colorHex} />
                ))}
              </Bar>
              <Bar
                dataKey="hours"
                name="Estimasi Jam"
                fill="#F59E0B"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-hairline)',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono'
                }}
              />
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
          ) : (
            <PieChart>
              <Pie
                data={chartData}
                dataKey="hours"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                label={(props: any) => `${props.name} (${props.hours}h)`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`pie-${index}`} fill={entry.colorHex} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-hairline)',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono'
                }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
