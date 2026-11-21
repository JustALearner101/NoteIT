import React from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { Kbd } from './Kbd'
import { cn } from './cn'

export const TooltipProvider: React.FC<
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Provider>
> = ({ delayDuration = 350, ...props }) => (
  <RadixTooltip.Provider delayDuration={delayDuration} {...props} />
)

export const Tooltip = RadixTooltip.Root
export const TooltipTrigger = RadixTooltip.Trigger

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixTooltip.Content> {
  shortcut?: string
}

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  TooltipContentProps
>(function NoteitTooltipContent({ className, sideOffset = 6, shortcut, children, ...props }, ref) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 inline-flex items-center gap-1.5 rounded-[7px] bg-surface-elevated border border-border-hairline px-2.5 py-1.5 text-[11.5px] text-ink-primary shadow-popover animate-popover-enter select-none',
          className
        )}
        {...props}
      >
        <span>{children}</span>
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  )
})
