import React from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from './cn'

interface DialogFocusContextValue {
  restoreTargetRef: React.MutableRefObject<HTMLElement | null>
  hasTriggerRef: React.MutableRefObject<boolean>
}

const DialogFocusContext = React.createContext<DialogFocusContextValue | null>(null)

export type DialogProps = React.ComponentPropsWithoutRef<typeof RadixDialog.Root>

export const Dialog: React.FC<DialogProps> = ({ open, defaultOpen, onOpenChange, ...props }) => {
  const restoreTargetRef = React.useRef<HTMLElement | null>(null)
  const hasTriggerRef = React.useRef(false)
  const wasOpenRef = React.useRef(false)

  const isControlled = open !== undefined
  const isOpen = isControlled ? Boolean(open) : Boolean(defaultOpen)

  // Capture the focused element synchronously during render BEFORE Radix FocusScope mounts.
  if (isOpen && !wasOpenRef.current) {
    const active = typeof document !== 'undefined' ? document.activeElement : null
    restoreTargetRef.current = active instanceof HTMLElement ? active : null
  }

  React.useEffect(() => {
    if (isControlled) {
      wasOpenRef.current = Boolean(open)
    }
  }, [isControlled, open])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        if (nextOpen && !wasOpenRef.current) {
          const active = typeof document !== 'undefined' ? document.activeElement : null
          restoreTargetRef.current = active instanceof HTMLElement ? active : null
        }
        wasOpenRef.current = nextOpen
      }
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange]
  )

  const focusCtx = React.useMemo(
    () => ({ restoreTargetRef, hasTriggerRef }),
    []
  )

  return (
    <DialogFocusContext.Provider value={focusCtx}>
      <RadixDialog.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </DialogFocusContext.Provider>
  )
}

export const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Trigger>
>(function NoteitDialogTrigger(props, ref) {
  const focusCtx = React.useContext(DialogFocusContext)

  React.useEffect(() => {
    if (!focusCtx) return
    focusCtx.hasTriggerRef.current = true
    return () => {
      focusCtx.hasTriggerRef.current = false
    }
  }, [focusCtx])

  return <RadixDialog.Trigger ref={ref} {...props} />
})

export const DialogPortal = RadixDialog.Portal
export const DialogClose = RadixDialog.Close

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(function NoteitDialogOverlay({ className, ...props }, ref) {
  return (
    <RadixDialog.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/65 backdrop-blur-[3px] animate-overlay-enter',
        className
      )}
      {...props}
    />
  )
})

const DIALOG_WIDTH_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl'
} as const

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  variant?: 'modal' | 'drawer-right'
  size?: keyof typeof DIALOG_WIDTH_MAP
  showCloseButton?: boolean
  overlayClassName?: string
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  DialogContentProps
>(function NoteitDialogContent(
  {
    className,
    children,
    variant = 'modal',
    size = 'md',
    showCloseButton = true,
    overlayClassName,
    onCloseAutoFocus,
    ...props
  },
  ref
) {
  const focusCtx = React.useContext(DialogFocusContext)
  const localContentRef = React.useRef<React.ElementRef<typeof RadixDialog.Content> | null>(null)

  const mergedRef = React.useCallback(
    (node: React.ElementRef<typeof RadixDialog.Content> | null) => {
      localContentRef.current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref]
  )

  const handleCloseAutoFocus = (event: Event): void => {
    onCloseAutoFocus?.(event)
    if (!focusCtx) return

    if (event.defaultPrevented) {
      focusCtx.restoreTargetRef.current = null
      return
    }

    if (focusCtx.hasTriggerRef.current) return

    const target = focusCtx.restoreTargetRef.current
    focusCtx.restoreTargetRef.current = null
    if (!target || !target.isConnected) return

    const activeEl = typeof document !== 'undefined' ? document.activeElement : null
    const shouldRestore =
      !activeEl ||
      activeEl === document.body ||
      activeEl === document.documentElement ||
      Boolean(localContentRef.current?.contains(activeEl))

    if (shouldRestore) {
      event.preventDefault()
      target.focus()
    }
  }

  const layoutClass =
    variant === 'drawer-right'
      ? 'fixed inset-y-0 right-0 z-50 w-full max-w-[540px] h-full bg-canvas-primary border-l border-border-hairline shadow-popover flex flex-col text-ink-primary font-sans animate-drawer-enter-right focus:outline-none'
      : cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[12px] bg-surface-elevated border border-border-hairline shadow-popover text-ink-primary font-sans animate-dialog-enter focus:outline-none',
          DIALOG_WIDTH_MAP[size]
        )

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <RadixDialog.Content
        ref={mergedRef}
        onCloseAutoFocus={handleCloseAutoFocus}
        className={cn(layoutClass, className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <RadixDialog.Close
            type="button"
            aria-label="Close dialog"
            className="absolute right-3.5 top-3.5 p-1 rounded-[6px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cobalt"
          >
            <X size={14} aria-hidden="true" />
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </DialogPortal>
  )
})

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn('px-5 pt-5 pb-3 space-y-1.5', className)} {...props} />

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      'px-5 py-3.5 bg-surface-chrome/70 border-t border-border-subtle rounded-b-[12px] flex items-center justify-end gap-2',
      className
    )}
    {...props}
  />
)

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(function NoteitDialogTitle({ className, ...props }, ref) {
  return (
    <RadixDialog.Title
      ref={ref}
      className={cn('font-display font-semibold text-sm text-ink-primary pr-6', className)}
      {...props}
    />
  )
})

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(function NoteitDialogDescription({ className, ...props }, ref) {
  return (
    <RadixDialog.Description
      ref={ref}
      className={cn('text-xs text-ink-secondary leading-relaxed', className)}
      {...props}
    />
  )
})
