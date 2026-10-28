import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[NoteIT] Renderer failure:', error, info.componentStack)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas-primary px-8 py-12 text-ink-primary">
        <div className="w-full max-w-2xl border border-hairline bg-surface-elevated p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent-amber">
            Runtime Fault
          </p>
          <h1 className="mt-3 font-display text-xl font-semibold">
            Antarmuka berhenti karena kesalahan tak terduga.
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Workspace tetap tersimpan di disk. Muat ulang aplikasi untuk melanjutkan.
          </p>
          <pre className="mt-5 max-h-64 overflow-auto whitespace-pre-wrap break-words border border-hairline bg-canvas-primary p-4 font-mono text-xs text-ink-secondary">
            {error.message || String(error)}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 border border-hairline bg-surface-hover px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-primary transition-colors hover:bg-surface-chrome"
          >
            Muat Ulang Aplikasi
          </button>
        </div>
      </div>
    )
  }
}
