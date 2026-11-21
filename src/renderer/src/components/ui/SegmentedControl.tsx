import React, { useRef } from 'react'
import { cn } from './cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
  count?: number
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'xs' | 'sm'
  ariaLabel?: string
  className?: string
}

/**
 * Recessed Obsidian segmented switcher — mirrors the List | Board & Draft | Live controls
 * in the reference studio mockups.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  ariaLabel = 'View options',
  className
}: SegmentedControlProps<T>): React.JSX.Element {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number): void => {
    if (options.length === 0) return
    let nextIdx: number | null = null

    if (e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % options.length
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + options.length) % options.length
    } else if (e.key === 'Home') {
      nextIdx = 0
    } else if (e.key === 'End') {
      nextIdx = options.length - 1
    }

    if (nextIdx !== null) {
      e.preventDefault()
      onChange(options[nextIdx].value)
      tabRefs.current[nextIdx]?.focus()
    }
  }

  const hasSelectedOption = options.some((opt) => opt.value === value)

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center p-[3px] rounded-[8px] bg-surface-chrome border border-border-hairline select-none shrink-0',
        className
      )}
    >
      {options.map((opt, idx) => {
        const active = opt.value === value
        const isTabbable = active || (!hasSelectedOption && idx === 0)
        return (
          <button
            key={opt.value}
            ref={(el) => {
              tabRefs.current[idx] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={isTabbable ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cobalt',
              size === 'xs' ? 'h-[22px] px-2 text-[11px]' : 'h-[26px] px-2.5 text-xs',
              active
                ? 'bg-surface-hover text-ink-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)] border border-border-hairline'
                : 'text-ink-secondary hover:text-ink-primary border border-transparent'
            )}
          >
            {opt.icon && (
              <span className="shrink-0 opacity-85" aria-hidden="true">
                {opt.icon}
              </span>
            )}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={cn(
                  'font-mono text-[10px] tabular-nums px-1 rounded',
                  active ? 'text-ink-secondary bg-surface-chrome/70' : 'text-ink-muted'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
