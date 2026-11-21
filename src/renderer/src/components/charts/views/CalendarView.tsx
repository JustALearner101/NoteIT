import React, { useMemo, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { MARKER_META } from '@renderer/lib/marker-colors'
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  isSameMonth,
  monthLabel,
  resizeTaskEnd,
  shiftMonth,
  taskSpanClass,
  tasksForDate
} from '@renderer/lib/database/calendar'
import { parseIsoDate, todayIso } from '@renderer/lib/database/dates'
import type { DatabaseViewProps } from './types'

interface MonthCursor {
  year: number
  month: number
}

const MAX_CHIPS = 3

const ACTION_BUTTON_CLASS =
  'h-7 px-2.5 rounded-[7px] border border-border-hairline bg-surface-elevated hover:bg-surface-hover text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

/** Bulan awal diturunkan dari todayIso; tidak pernah disimpan ke dokumen. */
function initialCursor(today: string): MonthCursor {
  const ms = parseIsoDate(today)
  if (ms === null) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  const date = new Date(ms)
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

export const CalendarView: React.FC<DatabaseViewProps> = ({
  items,
  updateTask,
  shiftTask,
  handleAddTask
}) => {
  const today = todayIso()
  // State lokal: bulan, tanggal terpilih, task terpilih. Tidak memicu save 350ms.
  const [cursor, setCursor] = useState<MonthCursor>(() => initialCursor(today))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, 1),
    [cursor.year, cursor.month]
  )
  const label = useMemo(() => monthLabel(cursor.year, cursor.month), [cursor.year, cursor.month])

  const selectedTask = items.find((item) => item.id === selectedTaskId) ?? null
  const actionDate = selectedDate ?? today

  const goMonth = (delta: number): void => {
    setCursor((prev) => shiftMonth(prev.year, prev.month, delta))
  }

  const goToday = (): void => {
    setCursor(initialCursor(today))
    setSelectedDate(today)
  }

  const setStart = (): void => {
    if (!selectedTask || !selectedDate) return
    const endDate = selectedTask.endDate < selectedDate ? selectedDate : selectedTask.endDate
    updateTask(selectedTask.id, { startDate: selectedDate, endDate })
  }

  const setEnd = (): void => {
    if (!selectedTask || !selectedDate) return
    updateTask(selectedTask.id, { endDate: resizeTaskEnd(selectedTask, selectedDate).endDate })
  }


  return (
    <div className="bg-canvas-primary">
      <div className="px-4 py-2.5 border-b border-border-hairline bg-surface-chrome/45 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="Bulan sebelumnya"
            className="w-7 h-7 rounded-[7px] border border-border-hairline bg-surface-elevated hover:bg-surface-hover text-ink-secondary hover:text-ink-primary flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="min-w-[136px] text-center font-display text-[13px] font-semibold text-ink-primary">
            {label}
          </span>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Bulan berikutnya"
            className="w-7 h-7 rounded-[7px] border border-border-hairline bg-surface-elevated hover:bg-surface-hover text-ink-secondary hover:text-ink-primary flex items-center justify-center transition-colors"
          >
            <ChevronRight size={13} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="h-7 px-2.5 ml-1 rounded-[7px] border border-border-hairline bg-surface-elevated hover:bg-surface-hover text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
          >
            Hari ini
          </button>
        </div>
        <span className="text-xs text-ink-muted tabular-nums">
          {items.length === 0 ? 'Belum ada task' : `${items.length} tasks`}
        </span>
      </div>

      <div className="p-3.5">
        <div className="rounded-[10px] border border-border-hairline overflow-hidden">
          <div className="grid grid-cols-7 bg-surface-chrome/60 border-b border-border-hairline">
            {WEEKDAY_LABELS.map((day) => (
              <span
                key={day}
                className="py-2 text-center text-[11px] font-medium text-ink-muted"
              >
                {day}
              </span>
            ))}
          </div>

          {grid.map((week) => (
            <div key={week[0]} className="grid grid-cols-7">
              {week.map((iso) => {
                const inMonth = isSameMonth(iso, cursor.year, cursor.month)
                const isToday = iso === today
                const isSelected = iso === selectedDate
                const dayTasks = tasksForDate(items, iso)
                const visibleTasks = dayTasks.slice(0, MAX_CHIPS)
                const overflow = dayTasks.length - visibleTasks.length

                return (
                  <div
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    className={
                      'min-h-[88px] p-1.5 border-b border-r border-border-subtle cursor-pointer transition-colors ' +
                      (inMonth ? 'bg-surface-elevated/55 ' : 'bg-surface-chrome/40 ') +
                      (isSelected
                        ? 'ring-1 ring-inset ring-accent-cobalt bg-[var(--pill-cobalt-bg)]'
                        : 'hover:bg-surface-hover/40')
                    }
                  >
                    <div className="flex items-center justify-between px-0.5 pb-1.5">
                      <span
                        className={
                          'flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10.5px] tabular-nums ' +
                          (isToday
                            ? 'bg-accent-cobalt font-semibold text-white '
                            : inMonth
                              ? 'text-ink-secondary '
                              : 'text-ink-muted/55')
                        }
                      >
                        {Number(iso.slice(8, 10))}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      {visibleTasks.map((task) => {
                        const marker = MARKER_META[task.color]
                        const isTaskSelected = task.id === selectedTaskId
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedDate(iso)
                              setSelectedTaskId(task.id)
                            }}
                            title={task.title}
                            style={{
                              backgroundColor: marker.hex + '22',
                              borderLeftColor: marker.hex
                            }}
                            className={
                              'block w-full truncate border-l-2 py-[2px] px-1.5 text-left text-[11px] font-medium leading-tight text-ink-primary ' +
                              taskSpanClass(task, iso) +
                              (isTaskSelected ? ' ring-1 ring-inset ring-accent-cobalt' : '')
                            }
                          >
                            {task.title}
                          </button>
                        )
                      })}
                      {overflow > 0 && (
                        <span className="pl-1 font-mono text-[10px] text-ink-muted">
                          +{overflow} more
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {(selectedDate || selectedTask) && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-border-hairline bg-surface-chrome/50 text-xs">
          <span className="font-mono text-[11px] text-ink-muted mr-1">
            {selectedDate ?? 'No date'}
            {selectedTask ? ' · ' + selectedTask.code : ''}
          </span>
          <button type="button" onClick={() => handleAddTask(actionDate)} className={ACTION_BUTTON_CLASS}>
            <CalendarPlus size={12} />
            <span>Tambah task</span>
          </button>
          <button
            type="button"
            disabled={!selectedTask}
            onClick={() => {
              if (selectedTask) shiftTask(selectedTask, -1)
            }}
            className={ACTION_BUTTON_CLASS}
          >
            -1 hari
          </button>
          <button
            type="button"
            disabled={!selectedTask}
            onClick={() => {
              if (selectedTask) shiftTask(selectedTask, 1)
            }}
            className={ACTION_BUTTON_CLASS}
          >
            +1 hari
          </button>
          <button
            type="button"
            disabled={!selectedTask || !selectedDate}
            onClick={setStart}
            className={ACTION_BUTTON_CLASS}
          >
            Set mulai
          </button>
          <button
            type="button"
            disabled={!selectedTask || !selectedDate}
            onClick={setEnd}
            className={ACTION_BUTTON_CLASS}
          >
            Set selesai
          </button>
        </div>
      )}
    </div>
  )
}

