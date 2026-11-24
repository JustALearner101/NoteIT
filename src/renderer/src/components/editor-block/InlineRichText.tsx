import React, { useEffect, useState } from 'react'
import { FileCode } from 'lucide-react'
import { parseCodeWikiLink } from '@shared/code-wikilink'
import { isKatexLoaded, loadKatex, renderKatexSync } from '@renderer/lib/katex-render'
import { cn } from '@renderer/components/ui'
import type { Page } from '@shared/types/domain'

const InlineMathToken: React.FC<{ expr: string }> = ({ expr }) => {
  const [ready, setReady] = useState(isKatexLoaded)

  useEffect(() => {
    if (ready) return
    let active = true
    void loadKatex().then(() => {
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [ready])

  const rendered = ready ? renderKatexSync(expr, false) : null
  if (!rendered) {
    return (
      <code className="px-1 py-0.5 rounded bg-surface-elevated border border-border-hairline font-mono text-[11.5px] text-[var(--marker-violet)]">
        ${expr}$
      </code>
    )
  }

  return (
    <span
      title={rendered.error ? `LaTeX error: ${rendered.error}` : expr}
      className={cn(
        'inline-block align-baseline px-0.5',
        rendered.error && 'border-b border-dashed border-[#EF4444]'
      )}
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  )
}

interface InlineRichTextProps {
  text: string
  pages: Page[]
  boundRepoPath: string
  placeholder?: string
  strikethrough?: boolean
  className?: string
  onOpenPageInTab: (pageId: string, inSplitPane?: boolean) => void
  onOpenCodeInDiffInspector: (target: {
    repoPath: string
    relPath: string
    startLine?: number
    endLine?: number
  }) => void
  onShowToast: (msg: string) => void
  onRequestEdit: () => void
}

// Matches inline Markdown, inline math ($...$), external links, and [[WikiLinks]]
const INLINE_TOKEN_RE =
  /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\$(?!\s)[^$\n]+?(?<!\s)\$|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\)|\[\[[^\]]+\]\])/g

function renderLineTokens(
  line: string,
  lineKey: number,
  props: Pick<
    InlineRichTextProps,
    'pages' | 'boundRepoPath' | 'onOpenPageInTab' | 'onOpenCodeInDiffInspector' | 'onShowToast'
  >
): React.ReactNode[] {
  const parts = line.split(INLINE_TOKEN_RE)
  return parts.map((part, idx) => {
    const key = `${lineKey}-${idx}`
    if (!part) return null

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-ink-primary">
          {part.slice(2, -2)}
        </strong>
      )
    }

    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return (
        <del key={key} className="line-through text-ink-muted">
          {part.slice(2, -2)}
        </del>
      )
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border-hairline font-mono text-[12px] text-accent-amber"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const expr = part.slice(1, -1)
      return <InlineMathToken key={key} expr={expr} />
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={key} className="italic text-ink-primary">
          {part.slice(1, -1)}
        </em>
      )
    }

    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (linkMatch) {
      return (
        <a
          key={key}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-accent-cobalt underline decoration-accent-cobalt/50 hover:decoration-accent-cobalt"
        >
          {linkMatch[1]}
        </a>
      )
    }

    const wikiMatch = /^\[\[([^\]]+)\]\]$/.exec(part)
    if (wikiMatch) {
      const rawTarget = wikiMatch[1].trim()
      const codeLink = parseCodeWikiLink(rawTarget)
      if (codeLink) {
        return (
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!props.boundRepoPath) {
                props.onShowToast(
                  'No repository bound to this notebook. Bind a folder in Mission Control or Sidebar first.'
                )
                return
              }
              props.onOpenCodeInDiffInspector({
                repoPath: props.boundRepoPath,
                relPath: codeLink.relPath,
                startLine: codeLink.startLine,
                endLine: codeLink.endLine
              })
            }}
            title={`Inspect ${codeLink.relPath}${codeLink.startLine ? ` at line ${codeLink.startLine}` : ''}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.2 mx-0.5 rounded-[5px] bg-[var(--pill-teal-bg)] border border-[var(--pill-teal-border)] text-[var(--pill-teal-text)] font-mono text-[12px] hover:brightness-110 align-baseline"
          >
            <FileCode size={11} className="shrink-0" aria-hidden="true" />
            <span>{codeLink.displayLabel}</span>
          </button>
        )
      }

      const targetPage = props.pages.find(
        (p) =>
          p.title.toLowerCase() === rawTarget.toLowerCase() ||
          p.code.toLowerCase() === rawTarget.toLowerCase()
      )
      return (
        <button
          key={key}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (targetPage) props.onOpenPageInTab(targetPage.id, e.altKey)
          }}
          title={
            targetPage
              ? `Open ${targetPage.code}: ${targetPage.title} (Alt+Click for Split Pane)`
              : `Page '${rawTarget}' has not been created yet`
          }
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.2 mx-0.5 rounded-[5px] border text-[12.5px] font-medium align-baseline transition-colors',
            targetPage
              ? 'bg-[var(--pill-cobalt-bg)] border-[var(--pill-cobalt-border)] text-[var(--pill-cobalt-text)] hover:brightness-110'
              : 'bg-surface-elevated border-border-hairline text-ink-muted'
          )}
        >
          <span>{targetPage?.icon || '📄'}</span>
          <span>{rawTarget}</span>
        </button>
      )
    }

    return <React.Fragment key={key}>{part}</React.Fragment>
  })
}

/**
 * Obsidian-style Pure Live Preview renderer for unfocused text blocks.
 * Clicking any non-link region seamlessly switches the block into its raw editor.
 */
export const InlineRichText: React.FC<InlineRichTextProps> = ({
  text,
  pages,
  boundRepoPath,
  placeholder = "Click to write, type '/' for blocks, or '[[' to link pages...",
  strikethrough = false,
  className,
  onOpenPageInTab,
  onOpenCodeInDiffInspector,
  onShowToast,
  onRequestEdit
}) => {
  const isEmpty = text.trim().length === 0
  const lines = text.split('\n')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRequestEdit}
      onFocus={onRequestEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRequestEdit()
        }
      }}
      className={cn(
        'w-full cursor-text whitespace-pre-wrap break-words rounded-[6px] transition-colors hover:bg-surface-elevated/35 px-1 -mx-1 py-0.5',
        strikethrough && 'line-through text-ink-muted',
        className
      )}
    >
      {isEmpty ? (
        <span className="text-ink-muted">{placeholder}</span>
      ) : (
        lines.map((line, i) => (
          <React.Fragment key={i}>
            {renderLineTokens(line, i, {
              pages,
              boundRepoPath,
              onOpenPageInTab,
              onOpenCodeInDiffInspector,
              onShowToast
            })}
            {i < lines.length - 1 && '\n'}
          </React.Fragment>
        ))
      )}
    </div>
  )
}
