import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Copy, Sigma } from 'lucide-react'
import { isKatexLoaded, loadKatex, renderKatexSync } from '@renderer/lib/katex-render'
import { computeAutoGrowRows } from '@renderer/lib/editor-v2'
import { cn } from '@renderer/components/ui'

interface MathBlockProps {
  content: string
  viewMode?: 'code' | 'split' | 'preview'
  onChange: (patch: { content?: string; mathViewMode?: 'code' | 'split' | 'preview' }) => void
}

export const MathBlock: React.FC<MathBlockProps> = ({
  content,
  viewMode = 'preview',
  onChange
}) => {
  const [isEditing, setIsEditing] = useState(content.trim().length === 0)
  const [katexReady, setKatexReady] = useState(isKatexLoaded)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (katexReady) return
    let active = true
    void loadKatex().then(() => {
      if (active) setKatexReady(true)
    })
    return () => {
      active = false
    }
  }, [katexReady])

  const rendered = useMemo(
    () => (katexReady ? renderKatexSync(content, true) : null) ?? { html: '', error: null },
    [content, katexReady]
  )

  const effectiveMode: 'code' | 'split' | 'preview' =
    viewMode === 'preview' && isEditing ? 'split' : viewMode

  const handleCopy = (): void => {
    void navigator.clipboard?.writeText(content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="rounded-[10px] bg-surface-elevated border border-border-hairline overflow-hidden">
      {/* Compact Header */}
      <div className="h-8 px-3 bg-surface-chrome/80 border-b border-border-hairline flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
          <Sigma size={12.5} className="text-[var(--marker-violet)]" aria-hidden="true" />
          <span>LaTeX Math</span>
          {rendered.error && (
            <span
              title={rendered.error}
              className="inline-flex items-center gap-1 text-[10.5px] text-[#EF4444] font-mono ml-1"
            >
              <AlertCircle size={11} aria-hidden="true" />
              <span>Syntax error</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(['preview', 'split', 'code'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setIsEditing(m !== 'preview')
                onChange({ mathViewMode: m })
              }}
              className={cn(
                'px-2 py-0.5 rounded-[5px] text-[10.5px] capitalize transition-colors',
                viewMode === m
                  ? 'bg-[var(--pill-violet-bg)] text-[var(--pill-violet-text)] font-medium'
                  : 'text-ink-muted hover:text-ink-primary hover:bg-surface-hover'
              )}
            >
              {m === 'code' ? 'TeX' : m}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy raw LaTeX"
            aria-label="Copy raw LaTeX"
            className="p-1 rounded-[5px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover ml-1"
          >
            {copied ? (
              <Check size={11.5} className="text-accent-teal" aria-hidden="true" />
            ) : (
              <Copy size={11.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className={cn(
          effectiveMode === 'split' ? 'grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-hairline' : ''
        )}
      >
        {(effectiveMode === 'code' || effectiveMode === 'split') && (
          <div className="p-3 bg-surface-chrome/40">
            <textarea
              aria-label="LaTeX formula editor"
              value={content}
              onChange={(e) => onChange({ content: e.target.value })}
              onBlur={() => {
                if (viewMode === 'preview' && content.trim().length > 0) {
                  setIsEditing(false)
                }
              }}
              rows={computeAutoGrowRows(content, 52, 2)}
              spellCheck={false}
              placeholder="\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}"
              className="w-full bg-transparent font-mono text-[12.5px] leading-relaxed text-ink-primary placeholder:text-ink-muted resize-none focus:outline-none selectable-text"
            />
          </div>
        )}

        {(effectiveMode === 'preview' || effectiveMode === 'split') && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsEditing(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setIsEditing(true)
              }
            }}
            title="Click to edit LaTeX formula"
            className="p-4 flex items-center justify-center min-h-[64px] overflow-x-auto cursor-text hover:bg-surface-hover/20 transition-colors"
          >
            {content.trim().length === 0 ? (
              <span className="text-xs font-mono text-ink-muted">
                Click to write a LaTeX equation...
              </span>
            ) : (
              <div
                className="text-ink-primary text-[15px]"
                dangerouslySetInnerHTML={{ __html: rendered.html }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
