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
      setErrorMessage('Tulis catatan dulu sebelum menyimpan.')
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
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyimpan catatan.')
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void save()
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas-primary text-ink-primary [-webkit-app-region:drag]">
      <div className="px-4 pt-3 flex items-center gap-2 font-mono text-[10px] uppercase text-ink-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-cobalt" />
        <span>Quick Capture · INBOX</span>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        spellCheck={false}
        placeholder="Tangkap ide mentah di sini..."
        className="flex-1 mx-4 mt-2 mb-1 bg-transparent resize-none text-sm leading-relaxed text-ink-primary placeholder:text-ink-muted focus:outline-none [-webkit-app-region:no-drag]"
      />

      <div className="px-4 pb-3 flex items-center justify-between gap-3 font-mono text-[10px] text-ink-muted">
        <span>Enter untuk simpan · Shift+Enter baris baru · Esc tutup</span>
        {status === 'saved' && <span className="text-[#10B981]">Tersimpan ke INBOX</span>}
        {status === 'error' && errorMessage && (
          <span className="text-[#EF4444] truncate">{errorMessage}</span>
        )}
      </div>
    </div>
  )
}
