import React from 'react'
import { cn } from './cn'

export const Kbd: React.FC<React.HTMLAttributes<HTMLElement>> = ({
  className,
  children,
  ...props
}) => (
  <kbd
    className={cn(
      'inline-flex items-center justify-center px-1.5 py-[1px] rounded-[5px] bg-surface-chrome border border-border-hairline font-mono text-[10px] leading-tight text-ink-muted select-none shrink-0',
      className
    )}
    {...props}
  >
    {children}
  </kbd>
)
