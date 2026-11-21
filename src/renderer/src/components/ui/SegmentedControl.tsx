import React from 'react'
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
  className
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div
      className={cn(
        'inline-flex items-center p-[3px] rounded-[8px] bg-surface-chrome border border-border-hairline select-none shrink-0',
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition-all duration-150',
              size === 'xs' ? 'h-[22px] px-2 text-[11px]' : 'h-[26px] px-2.5 text-xs',
              active
                ? 'bg-surface-hover text-ink-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)] border border-border-hairline'
                : 'text-ink-secondary hover:text-ink-primary border border-transparent'
            )}
          >
            {opt.icon && <span className="shrink-0 opacity-85">{opt.icon}</span>}
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
