import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-sans font-medium transition-all duration-150 select-none disabled:opacity-45 disabled:pointer-events-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cobalt focus-visible:ring-offset-1 focus-visible:ring-offset-canvas-primary',
  {
    variants: {
      variant: {
        primary: 'btn-primary-sheen text-white rounded-[7px]',
        secondary:
          'bg-surface-elevated hover:bg-surface-hover text-ink-primary border border-border-hairline hover:border-border-strong rounded-[7px]',
        outline:
          'bg-transparent hover:bg-surface-hover text-ink-secondary hover:text-ink-primary border border-border-hairline rounded-[7px]',
        ghost:
          'bg-transparent hover:bg-surface-hover text-ink-secondary hover:text-ink-primary rounded-[6px]',
        subtle:
          'bg-[var(--pill-cobalt-bg)] hover:brightness-110 text-[var(--pill-cobalt-text)] border border-[var(--pill-cobalt-border)] rounded-[7px]',
        danger:
          'bg-[var(--pill-red-bg)] hover:brightness-110 text-[var(--pill-red-text)] border border-[var(--pill-red-border)] rounded-[7px]'
      },
      size: {
        xs: 'h-6 px-2 text-[11.5px]',
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-[12.5px]',
        icon: 'h-7 w-7 p-0',
        'icon-xs': 'h-6 w-6 p-0'
      }
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'sm'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', loading = false, disabled, children, ...props }, ref) => {
    const isDisabled = Boolean(disabled || loading)
    const isIconSize = size === 'icon' || size === 'icon-xs'
    const spinnerSize = size === 'xs' || size === 'icon-xs' ? 11 : 13

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading && (
          <Loader2 size={spinnerSize} className="animate-spin shrink-0" aria-hidden="true" />
        )}
        {!(loading && isIconSize) && children}
      </button>
    )
  }
)

Button.displayName = 'Button'
