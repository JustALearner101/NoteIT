import React, { useEffect, useRef, useState } from 'react'

const SAVED_INDICATOR_MS = 1600

/**
 * Isi window capture (680x200, frameless). Sengaja tidak menyentuh store workspace:
 * window ini hanya perlu satu IPC tulis, bukan seluruh snapshot.
 */
export const QuickCapture: React.FC = () => {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    textareaRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        window.close()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const save = async (): Promise<void> => {
    if (status === 'saving') return

    if (!text.trim()) {
      setStatus('error')
      setErrorMessage('Write a note before saving.')
      return
    }

    setStatus('saving')
    try {
      await window.noteitAPI.createQuickNote(text)
      setText('')
      setErrorMessage(null)
      setStatus('saved')
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setStatus('idle'), SAVED_INDICATOR_MS)
      textareaRef.current?.focus()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save note.')
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void save()
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-surface-elevated text-ink-primary border border-border-hairline [-webkit-app-region:drag]">
      <div className="px-4 pt-3 flex items-center gap-2 text-[11px] font-medium text-ink-muted">
        <span className="w-2 h-2 rounded-full bg-accent-cobalt" />
        <span>Quick capture · Inbox</span>
      </div>

      <textarea
        ref={textareaRef}
        aria-label="Quick capture note"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        spellCheck={false}
        placeholder="Capture a raw thought here..."
        className="flex-1 mx-4 mt-2 mb-1 bg-transparent resize-none text-sm leading-relaxed text-ink-primary placeholder:text-ink-muted focus:outline-none [-webkit-app-region:no-drag]"
      />

      <div className="px-4 pb-3 flex items-center justify-between gap-3 text-[11px] text-ink-muted">
        <span>Enter to save · Shift+Enter newline · Esc close</span>
        {status === 'saved' && <span role="status" className="text-[var(--pill-teal-text)] font-medium">Saved to Inbox</span>}
        {status === 'error' && errorMessage && (
          <span role="alert" className="text-[var(--pill-red-text)] truncate">{errorMessage}</span>
        )}
      </div>
    </div>
  )
}
