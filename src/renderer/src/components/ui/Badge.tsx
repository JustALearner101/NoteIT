import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[6px] border font-medium leading-none select-none shrink-0',
  {
    variants: {
      tone: {
        neutral:
          'bg-surface-hover/80 text-ink-secondary border-border-hairline',
        cobalt:
          'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]',
        amber:
          'bg-[var(--pill-amber-bg)] text-[var(--pill-amber-text)] border-[var(--pill-amber-border)]',
        teal:
          'bg-[var(--pill-teal-bg)] text-[var(--pill-teal-text)] border-[var(--pill-teal-border)]',
        red:
          'bg-[var(--pill-red-bg)] text-[var(--pill-red-text)] border-[var(--pill-red-border)]',
        violet:
          'bg-[var(--pill-violet-bg)] text-[var(--pill-violet-text)] border-[var(--pill-violet-border)]',
        slate:
          'bg-[var(--pill-slate-bg)] text-[var(--pill-slate-text)] border-[var(--pill-slate-border)]'
      },
      size: {
        xs: 'px-1.5 py-[3px] text-[10.5px]',
        sm: 'px-2 py-1 text-[11px]'
      }
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'xs'
    }
  }
)

const DOT_TONES: Record<NonNullable<VariantProps<typeof badgeVariants>['tone']>, string> = {
  neutral: 'bg-ink-muted',
  cobalt: 'bg-[#6E7BF2]',
  amber: 'bg-[#E5A93C]',
  teal: 'bg-[#2DD4BF]',
  red: 'bg-[#F87171]',
  violet: 'bg-[#A78BFA]',
  slate: 'bg-[#787886]'
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  pulseDot?: boolean
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  tone = 'neutral',
  size,
  dot = false,
  pulseDot = false,
  children,
  ...props
}) => {
  const safeTone = tone || 'neutral'
  return (
    <span className={cn(badgeVariants({ tone: safeTone, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            DOT_TONES[safeTone],
            pulseDot && 'animate-pulse'
          )}
        />
      )}
      {children}
    </span>
  )
}
