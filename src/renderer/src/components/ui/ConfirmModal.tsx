import React, { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './Dialog'

export interface ConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const errorId = useId()
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const isBusy = Boolean(loading || submitting)

  useEffect(() => {
    if (open) {
      setSubmitError(null)
    }
  }, [open])

  const handleOpenChange = (nextOpen: boolean): void => {
    if (isBusy) return
    if (!nextOpen) onCancel?.()
    onOpenChange(nextOpen)
  }

  const handleCancelClick = (): void => {
    if (isBusy) return
    onCancel?.()
    onOpenChange(false)
  }

  const handleConfirmClick = async (): Promise<void> => {
    if (isBusy) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed. Please try again.'
      setSubmitError(msg || 'Action failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="sm"
        onEscapeKeyDown={(e) => {
          if (isBusy) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (isBusy) e.preventDefault()
        }}
        onOpenAutoFocus={(e) => {
          if (variant === 'danger' && cancelBtnRef.current) {
            e.preventDefault()
            cancelBtnRef.current.focus()
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            {variant === 'danger' && (
              <div className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 mt-0.5 bg-[var(--pill-red-bg)] border border-[var(--pill-red-border)] text-[var(--pill-red-text)]">
                <AlertTriangle size={15} aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {submitError && (
          <div className="px-5 pb-3">
            <p id={errorId} role="alert" className="text-[11.5px] text-[var(--pill-red-text)]">
              {submitError}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            ref={cancelBtnRef}
            variant="ghost"
            size="md"
            disabled={isBusy}
            onClick={handleCancelClick}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="md"
            loading={isBusy}
            onClick={() => void handleConfirmClick()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
