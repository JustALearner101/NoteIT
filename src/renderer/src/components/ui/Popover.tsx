import React from 'react'
import * as RadixPopover from '@radix-ui/react-popover'
import { cn } from './cn'

export const Popover = RadixPopover.Root
export const PopoverTrigger = RadixPopover.Trigger
export const PopoverAnchor = RadixPopover.Anchor

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof RadixPopover.Content>,
  React.ComponentPropsWithoutRef<typeof RadixPopover.Content>
>(function NoteitPopoverContent({ className, align = 'end', sideOffset = 6, ...props }, ref) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-[10px] bg-surface-elevated border border-border-hairline shadow-popover p-1.5 text-ink-primary font-sans animate-popover-enter focus:outline-none',
          className
        )}
        {...props}
      />
    </RadixPopover.Portal>
  )
})
