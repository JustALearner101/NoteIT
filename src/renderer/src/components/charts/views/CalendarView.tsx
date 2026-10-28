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
  'h-6 px-2 rounded border border-border-hairline bg-surface-elevated text-ink-secondary hover:text-ink-primary flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed'

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
      <div className="px-3 py-2 border-b border-border-hairline bg-surface-chrome/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goMonth(-1)}
            aria-label="Bulan sebelumnya"
            className="w-6 h-6 rounded border border-border-hairline bg-surface-elevated text-ink-secondary hover:text-ink-primary flex items-center justify-center"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="min-w-[132px] text-center font-mono text-xs font-semibold uppercase tracking-wider text-ink-primary">
            {label}
          </span>
          <button
            onClick={() => goMonth(1)}
            aria-label="Bulan berikutnya"
            className="w-6 h-6 rounded border border-border-hairline bg-surface-elevated text-ink-secondary hover:text-ink-primary flex items-center justify-center"
          >
            <ChevronRight size={12} />
          </button>
          <button
            onClick={goToday}
            className="px-2 py-1 rounded border border-border-hairline bg-surface-elevated font-mono text-[10px] text-ink-secondary hover:text-ink-primary"
          >
            Hari ini
          </button>
        </div>
        <span className="font-mono text-[10px] uppercase text-ink-muted">
          {items.length === 0 ? 'Belum ada task' : items.length + ' TASK'}
        </span>
      </div>


      <div className="p-3">
        <div className="rounded-[6px] border border-border-hairline overflow-hidden">
          <div className="grid grid-cols-7 bg-surface-chrome/70 border-b border-border-hairline">
            {WEEKDAY_LABELS.map((day) => (
              <span
                key={day}
                className="py-1.5 text-center font-mono text-[10px] uppercase text-ink-muted"
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
                      'min-h-[84px] p-1 border-b border-r border-border-hairline cursor-pointer transition-colors ' +
                      (inMonth ? 'bg-surface-elevated ' : 'bg-surface-chrome/40 ') +
                      (isSelected
                        ? 'ring-1 ring-inset ring-accent-cobalt'
                        : 'hover:bg-surface-hover/40')
                    }
                  >

                    <div className="flex items-center justify-between px-0.5 pb-1">
                      <span
                        className={
                          'flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] ' +
                          (isToday
                            ? 'bg-accent-cobalt font-semibold text-white '
                            : inMonth
                              ? 'text-ink-secondary '
                              : 'text-ink-muted/60')
                        }
                      >
                        {Number(iso.slice(8, 10))}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      {visibleTasks.map((task) => {
                        const marker = MARKER_META[task.color]
                        const isTaskSelected = task.id === selectedTaskId
                        return (
                          <button
                            key={task.id}
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
                              'block w-full truncate border-l-2 py-[1px] pl-1 pr-1 text-left font-mono text-[10px] leading-tight text-ink-primary ' +
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
                          +{overflow}
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
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-border-hairline bg-surface-chrome/60 font-mono text-[10px]">
          <span className="text-ink-muted">
            {selectedDate ?? 'TANPA TANGGAL'}
            {selectedTask ? ' · ' + selectedTask.code : ''}
          </span>
          <button onClick={() => handleAddTask(actionDate)} className={ACTION_BUTTON_CLASS}>
            <CalendarPlus size={11} />
            <span>Tambah task di tanggal ini</span>
          </button>
          <button
            disabled={!selectedTask}
            onClick={() => {
              if (selectedTask) shiftTask(selectedTask, -1)
            }}
            className={ACTION_BUTTON_CLASS}
          >
            Geser -1 hari
          </button>
          <button
            disabled={!selectedTask}
            onClick={() => {
              if (selectedTask) shiftTask(selectedTask, 1)
            }}
            className={ACTION_BUTTON_CLASS}
          >
            Geser +1 hari
          </button>
          <button
            disabled={!selectedTask || !selectedDate}
            onClick={setStart}
            className={ACTION_BUTTON_CLASS}
          >
            Set mulai
          </button>
          <button
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

