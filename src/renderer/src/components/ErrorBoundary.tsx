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
        <div className="w-full max-w-2xl rounded-[14px] border border-border-hairline bg-surface-elevated p-8 shadow-popover">
          <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[var(--pill-amber-bg)] border border-[var(--pill-amber-border)] text-[var(--pill-amber-text)] text-[11px] font-medium">
            Runtime fault
          </span>
          <h1 className="mt-3 font-display text-xl font-semibold tracking-[-0.015em]">
            Antarmuka berhenti karena kesalahan tak terduga.
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Workspace tetap tersimpan di disk. Muat ulang aplikasi untuk melanjutkan.
          </p>
          <pre className="mt-5 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-border-hairline bg-canvas-primary p-4 font-mono text-xs text-ink-secondary">
            {error.message || String(error)}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 h-8 rounded-[7px] btn-primary-sheen px-4 text-xs font-medium transition-all"
          >
            Muat Ulang Aplikasi
          </button>
        </div>
      </div>
    )
  }
}
