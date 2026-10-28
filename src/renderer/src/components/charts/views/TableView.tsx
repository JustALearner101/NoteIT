import React from 'react'
import { Diamond, Trash2 } from 'lucide-react'
import type { MarkerColor } from '@shared/types/domain'
import { MARKER_COLORS } from '@renderer/lib/marker-colors'
import type { DatabaseViewProps } from './types'

export const TableView: React.FC<DatabaseViewProps> = ({ items, updateTask, handleDeleteTask }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-chrome border-b border-border-hairline font-mono text-[10px] text-ink-muted uppercase">
            <th className="py-2 px-3">KODE</th>
            <th className="py-2 px-3">TASK / MILESTONE</th>
            <th className="py-2 px-3">WARNA</th>
            <th className="py-2 px-3">MULAI</th>
            <th className="py-2 px-3">SELESAI</th>
            <th className="py-2 px-3">PROGRESS</th>
            <th className="py-2 px-3">EST (JAM)</th>
            <th className="py-2 px-3">MILESTONE</th>
            <th className="py-2 px-3 text-right">AKSI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle text-xs">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-surface-hover/40">
              <td className="py-1.5 px-3 font-mono text-[11px] text-ink-secondary">
                <input
                  type="text"
                  value={item.code}
                  onChange={(e) => updateTask(item.id, { code: e.target.value })}
                  className="w-16 bg-transparent font-mono focus:outline-none focus:border-b focus:border-accent-cobalt"
                />
              </td>
              <td className="py-1.5 px-3">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateTask(item.id, { title: e.target.value })}
                  className="w-full bg-transparent text-ink-primary focus:outline-none focus:border-b focus:border-accent-cobalt"
                />
              </td>
              <td className="py-1.5 px-3">
                <select
                  value={item.color}
                  onChange={(e) =>
                    updateTask(item.id, { color: e.target.value as MarkerColor })
                  }
                  className="bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 font-mono text-[10px] text-ink-primary"
                >
                  {MARKER_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1.5 px-3 font-mono text-[11px] tabular-nums">
                <input
                  type="date"
                  value={item.startDate}
                  onChange={(e) => updateTask(item.id, { startDate: e.target.value })}
                  className="bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 text-ink-primary"
                />
              </td>
              <td className="py-1.5 px-3 font-mono text-[11px] tabular-nums">
                <input
                  type="date"
                  value={item.endDate}
                  onChange={(e) => updateTask(item.id, { endDate: e.target.value })}
                  className="bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 text-ink-primary"
                />
              </td>
              <td className="py-1.5 px-3 font-mono text-[11px] tabular-nums">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={item.progress}
                  onChange={(e) =>
                    updateTask(item.id, { progress: Number(e.target.value) })
                  }
                  className="w-14 bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 text-ink-primary"
                />
                %
              </td>
              <td className="py-1.5 px-3 font-mono text-[11px] tabular-nums">
                <input
                  type="number"
                  min={1}
                  value={item.estimateHours}
                  onChange={(e) =>
                    updateTask(item.id, { estimateHours: Number(e.target.value) })
                  }
                  className="w-14 bg-surface-chrome border border-border-hairline rounded px-1.5 py-0.5 text-ink-primary"
                />
              </td>
              <td className="py-1.5 px-3">
                <button
                  onClick={() => updateTask(item.id, { isMilestone: !item.isMilestone })}
                  className={`p-1 rounded border ${
                    item.isMilestone
                      ? 'bg-accent-amber/20 border-accent-amber text-accent-amber'
                      : 'border-border-hairline text-ink-muted'
                  }`}
                >
                  <Diamond size={12} />
                </button>
              </td>
              <td className="py-1.5 px-3 text-right">
                <button
                  onClick={() => handleDeleteTask(item.id)}
                  className="p-1 rounded hover:bg-[#EF4444]/15 text-ink-muted hover:text-[#EF4444]"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
