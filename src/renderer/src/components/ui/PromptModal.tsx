import React, { useEffect, useId, useRef, useState } from 'react'
import { Button } from './Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './Dialog'

export interface PromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  label?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  trim?: boolean
  allowEmpty?: boolean
  validate?: (value: string) => string | null
  loading?: boolean
  onSubmit: (value: string) => void | Promise<void>
  onCancel?: () => void
}

export const PromptModal: React.FC<PromptModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  label,
  defaultValue = '',
  placeholder,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  trim = true,
  allowEmpty = false,
  validate,
  loading = false,
  onSubmit,
  onCancel
}) => {
  const inputId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [textValue, setTextValue] = useState(defaultValue)
  const [validationErr, setValidationErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const isBusy = Boolean(loading || submitting)

  useEffect(() => {
    if (open) {
      setTextValue(defaultValue)
      setValidationErr(null)
    }
  }, [open, defaultValue])

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

  const handleFormSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (isBusy) return

    const candidate = trim ? textValue.trim() : textValue
    if (!allowEmpty && !candidate) {
      setValidationErr('Value cannot be empty.')
      return
    }
    if (validate) {
      const msg = validate(candidate)
      if (msg) {
        setValidationErr(msg)
        return
      }
    }

    setValidationErr(null)
    setSubmitting(true)
    try {
      await onSubmit(candidate)
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.'
      setValidationErr(msg || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="md"
        aria-describedby={validationErr ? errorId : undefined}
        onEscapeKeyDown={(e) => {
          if (isBusy) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (isBusy) e.preventDefault()
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
          inputRef.current?.select()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={(e) => void handleFormSubmit(e)}>
          <div className="px-5 pb-4 space-y-2">
            {label && (
              <label htmlFor={inputId} className="block text-xs font-medium text-ink-secondary">
                {label}
              </label>
            )}
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={textValue}
              onChange={(e) => {
                setTextValue(e.target.value)
                if (validationErr) setValidationErr(null)
              }}
              placeholder={placeholder}
              disabled={isBusy}
              aria-label={!label ? title : undefined}
              aria-invalid={Boolean(validationErr)}
              aria-describedby={validationErr ? errorId : undefined}
              className="w-full bg-surface-chrome border border-border-hairline rounded-[8px] px-3 py-2 text-xs text-ink-primary placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cobalt"
            />
            {validationErr && (
              <p id={errorId} role="alert" className="text-[11.5px] text-[var(--pill-red-text)]">
                {validationErr}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="md" disabled={isBusy} onClick={handleCancelClick}>
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              variant={variant === 'danger' ? 'danger' : 'primary'}
              size="md"
              loading={isBusy}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
