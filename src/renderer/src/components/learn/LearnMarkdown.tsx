import React, { useEffect, useId, useState } from 'react'
import { Check, Copy, Maximize2, Minimize2 } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { sanitizeSvg } from '@shared/svg-sanitize'

/**
 * Renders a sanitized live Mermaid SVG diagram (reusing NoteIT's dynamic mermaid + sanitizeSvg).
 */
export const MermaidDiagramPreview: React.FC<{
  code: string
  compact?: boolean
  className?: string
}> = ({ code, compact = false, className = '' }) => {
  const theme = useWorkspaceStore((s) => s.theme)
  const uniqueId = useId().replace(/:/g, '-')
  const [svgOutput, setSvgOutput] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let active = true
    async function render(): Promise<void> {
      const trimmed = code.trim()
      if (!trimmed) {
        setSvgOutput('')
        setErrorMsg(null)
        return
      }
      try {
        const mod = await import('mermaid')
        const mermaidInstance = mod.default
        mermaidInstance.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'neutral',
          securityLevel: 'strict',
          fontFamily: 'JetBrains Mono, monospace',
          flowchart: { curve: 'basis', htmlLabels: true }
        })
        const { svg } = await mermaidInstance.render(
          `learn-mermaid-${uniqueId}-${Date.now()}`,
          trimmed
        )
        if (active) {
          setSvgOutput(sanitizeSvg(svg))
          setErrorMsg(null)
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg(err?.message?.split('\n')[0] || 'Unable to render Mermaid diagram')
        }
      }
    }
    void render()
    return () => {
      active = false
    }
  }, [code, theme, uniqueId])

  if (!code.trim()) return null

  return (
    <div
      className={`rounded-lg bg-surface-elevated border border-border-hairline overflow-hidden ${className}`}
    >
      <div className="px-2.5 py-1 bg-surface-chrome/70 border-b border-border-subtle flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
          Mermaid Diagram
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSource((v) => !v)}
            className="text-[10px] font-mono text-ink-secondary hover:text-ink-primary px-1.5 py-0.5 rounded hover:bg-surface-hover"
          >
            {showSource ? 'Diagram' : 'Source'}
          </button>
          {compact && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Collapse' : 'Expand'}
              className="text-ink-muted hover:text-ink-primary p-0.5 rounded hover:bg-surface-hover"
            >
              {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </button>
          )}
        </div>
      </div>

      {showSource || errorMsg ? (
        <div className="p-2.5 space-y-1.5">
          {errorMsg && <div className="text-[10.5px] text-accent-amber">{errorMsg}</div>}
          <pre className="font-mono text-[10.5px] text-ink-secondary overflow-x-auto whitespace-pre">
            {code}
          </pre>
        </div>
      ) : (
        <div
          className={`p-3 overflow-auto flex items-center justify-center [&_svg]:max-w-full [&_svg]:h-auto ${
            compact && !expanded ? 'max-h-56' : 'max-h-[420px]'
          }`}
          // Sanitized via NoteIT's sanitizeSvg() (same path as MermaidStudio & GraphvizStudio)
          dangerouslySetInnerHTML={{ __html: svgOutput }}
        />
      )}
    </div>
  )
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index))
    }
    const raw = match[0]
    if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push(
        <strong key={key++} className="font-semibold text-ink-primary">
          {raw.slice(2, -2)}
        </strong>
      )
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push(
        <em key={key++} className="italic text-ink-secondary">
          {raw.slice(1, -1)}
        </em>
      )
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-surface-chrome border border-border-subtle font-mono text-[11px] text-accent-cobalt"
        >
          {raw.slice(1, -1)}
        </code>
      )
    }
    lastIndex = match.index + raw.length
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex))
  }
  return tokens
}

const CodeFenceBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false)
  if (language.toLowerCase() === 'mermaid') {
    return <MermaidDiagramPreview code={code} />
  }
  return (
    <div className="rounded-lg bg-surface-chrome border border-border-hairline overflow-hidden my-2">
      <div className="px-2.5 py-1 border-b border-border-subtle flex items-center justify-between text-[10px] font-mono text-ink-muted">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="flex items-center gap-1 hover:text-ink-primary"
        >
          {copied ? <Check size={10} className="text-accent-emerald" /> : <Copy size={10} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-[11px] text-ink-primary leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/**
 * CSP-safe Markdown + fenced code + inline Mermaid SVG renderer for Learn Workbench turns.
 */
export const LearnMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const parts: Array<{ type: 'text' | 'fence'; content: string; lang?: string }> = []
  const fenceRegex = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'fence', lang: match[1] || '', content: match[2].trimEnd() })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) })
  }

  return (
    <div className="space-y-2.5 text-[13px] text-ink-primary leading-relaxed selectable-text">
      {parts.map((part, pIdx) => {
        if (part.type === 'fence') {
          return <CodeFenceBlock key={pIdx} language={part.lang || ''} code={part.content} />
        }
        const blocks = part.content
          .split(/\n{2,}/)
          .map((b) => b.trim())
          .filter(Boolean)

        return (
          <React.Fragment key={pIdx}>
            {blocks.map((block, bIdx) => {
              const lines = block.split('\n')
              if (lines.length === 1 && /^#{1,3}\s+/.test(block)) {
                const headingText = block.replace(/^#{1,3}\s+/, '')
                return (
                  <h4 key={bIdx} className="font-display font-semibold text-sm text-ink-primary pt-1">
                    {renderInlineMarkdown(headingText)}
                  </h4>
                )
              }
              if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
                return (
                  <ul key={bIdx} className="list-disc pl-5 space-y-1 text-ink-primary">
                    {lines.map((l, lIdx) => (
                      <li key={lIdx}>{renderInlineMarkdown(l.trim().replace(/^[-*]\s+/, ''))}</li>
                    ))}
                  </ul>
                )
              }
              if (lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
                return (
                  <ol key={bIdx} className="list-decimal pl-5 space-y-1 text-ink-primary">
                    {lines.map((l, lIdx) => (
                      <li key={lIdx}>{renderInlineMarkdown(l.trim().replace(/^\d+\.\s+/, ''))}</li>
                    ))}
                  </ol>
                )
              }
              return (
                <p key={bIdx} className="whitespace-pre-line">
                  {renderInlineMarkdown(block)}
                </p>
              )
            })}
          </React.Fragment>
        )
      })}
    </div>
  )
}
