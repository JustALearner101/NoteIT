import React from 'react'
import * as RadixMenu from '@radix-ui/react-dropdown-menu'
import { cn } from './cn'

export const DropdownMenu = RadixMenu.Root
export const DropdownMenuTrigger = RadixMenu.Trigger

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Content>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Content>
>(function NoteitDropdownContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[11rem] rounded-[10px] bg-surface-elevated border border-border-hairline shadow-popover p-1.5 text-ink-primary font-sans animate-popover-enter focus:outline-none',
          className
        )}
        {...props}
      />
    </RadixMenu.Portal>
  )
})

export interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixMenu.Item> {
  destructive?: boolean
}

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Item>,
  DropdownMenuItemProps
>(function NoteitDropdownItem({ className, destructive = false, ...props }, ref) {
  return (
    <RadixMenu.Item
      ref={ref}
      className={cn(
        'w-full px-2 py-1.5 rounded-[7px] text-xs flex items-center justify-between gap-2 select-none cursor-pointer outline-none transition-colors data-[disabled]:opacity-45 data-[disabled]:pointer-events-none',
        destructive
          ? 'text-[var(--pill-red-text)] data-[highlighted]:bg-[var(--pill-red-bg)]'
          : 'text-ink-secondary data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink-primary',
        className
      )}
      {...props}
    />
  )
})

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Label>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Label>
>(function NoteitDropdownLabel({ className, ...props }, ref) {
  return (
    <RadixMenu.Label
      ref={ref}
      className={cn('px-2 py-1 text-[10.5px] font-medium text-ink-muted', className)}
      {...props}
    />
  )
})

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Separator>
>(function NoteitDropdownSeparator({ className, ...props }, ref) {
  return (
    <RadixMenu.Separator
      ref={ref}
      className={cn('my-1 h-px bg-border-subtle', className)}
      {...props}
    />
  )
})
