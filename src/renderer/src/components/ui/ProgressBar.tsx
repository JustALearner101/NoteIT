import React from 'react'
import { cn } from './cn'

interface ProgressBarProps {
  value: number
  colorClass?: string
  showLabel?: boolean
  className?: string
  trackClassName?: string
}

/**
 * Ultra-thin 3px emerald/semantic hairline progress track + right-aligned tabular percentage,
 * inspired by the probability bars in reference Images 1 & 2.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  colorClass = 'bg-accent-emerald',
  showLabel = true,
  className,
  trackClassName
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <div
        className={cn(
          'flex-1 h-[3.5px] rounded-full bg-surface-hover overflow-hidden min-w-[44px]',
          trackClassName
        )}
      >
        <div
          style={{ width: `${clamped}%` }}
          className={cn('h-full rounded-full transition-all duration-200', colorClass)}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-[11px] text-ink-secondary tabular-nums shrink-0 w-8 text-right">
          {clamped}%
        </span>
      )}
    </div>
  )
}
