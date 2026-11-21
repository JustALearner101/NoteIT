import React, { Suspense, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  ChevronRight,
  Code,
  FileCode,
  GripVertical,
  Italic,
  Link2,
  Plus,
  Strikethrough,
  Trash2
} from 'lucide-react'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { cn } from '@renderer/components/ui'
import { parseCodeWikiLink } from '@shared/code-wikilink'
import {
  applyInlineMarkdownShortcut,
  matchSlashTrigger,
  matchWikiAutocompleteTrigger,
  type InlineMarkdownFormat
} from '@renderer/lib/editor-v2'
import { AssetBlock } from './AssetBlock'
import { SlashCommandMenu } from './SlashCommandMenu'
import { WikiAutocompletePopover } from './WikiAutocompletePopover'
import type { BlockType, DocumentBlock, Page } from '@shared/types/domain'

const DBMLStudio = React.lazy(() =>
  import('@renderer/components/diagrams/dbml/DBMLStudio').then((m) => ({
    default: m.DBMLStudio
  }))
)
const MermaidStudio = React.lazy(() =>
  import('@renderer/components/diagrams/mermaid/MermaidStudio').then((m) => ({
    default: m.MermaidStudio
  }))
)
const GraphvizStudio = React.lazy(() =>
  import('@renderer/components/diagrams/graphviz/GraphvizStudio').then((m) => ({
    default: m.GraphvizStudio
  }))
)
const ProjectDatabaseBlock = React.lazy(() =>
  import('@renderer/components/charts/ProjectDatabaseBlock').then((m) => ({
    default: m.ProjectDatabaseBlock
  }))
)

const BlockStudioFallback: React.FC<{ label: string }> = ({ label }) => (
  <div className="my-3 p-4 rounded-[12px] bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-muted">
    Loading {label}...
  </div>
)

function hasInlineMarkdownSyntax(text: string): boolean {
  return /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/.test(text)
}

function renderFormattedInlinePreview(text: string): React.ReactNode {
  if (!hasInlineMarkdownSyntax(text)) return null

  const tokenRegex = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  const parts = text.split(tokenRegex)

  return (
    <div
      aria-label="Formatted Markdown preview"
      className="mt-1 px-2.5 py-1.5 rounded-[7px] bg-surface-chrome/60 border border-border-subtle text-xs text-ink-secondary leading-relaxed flex flex-wrap items-center gap-x-1"
    >
      {parts.map((part, idx) => {
        if (!part) return null
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong key={idx} className="font-semibold text-ink-primary">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
          return (
            <del key={idx} className="line-through text-ink-muted">
              {part.slice(2, -2)}
            </del>
          )
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code
              key={idx}
              className="px-1 py-0.5 rounded bg-surface-elevated border border-border-hairline font-mono text-[11px] text-accent-amber"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <em key={idx} className="italic text-ink-primary">
              {part.slice(1, -1)}
            </em>
          )
        }
        const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (linkMatch) {
          return (
            <a
              key={idx}
              href={linkMatch[2]}
              target="_blank"
              rel="noreferrer"
              className="text-accent-cobalt underline hover:opacity-85"
            >
              {linkMatch[1]}
            </a>
          )
        }
        return <span key={idx}>{part}</span>
      })}
    </div>
  )
}

export interface BlockItemProps {
  block: DocumentBlock
  page: Page
  pages: Page[]
  boundRepoPath: string
  canDelete: boolean
  isSlashMenuOpen: boolean
  slashInitialQuery: string
  isWikiPickerOpen: boolean
  isDragging: boolean
  dropIndicator: 'before' | 'after' | null
  onSetDragging: (blockId: string | null) => void
  onDragOverBlock: (e: React.DragEvent<HTMLDivElement>, blockId: string) => void
  onDropOnBlock: (e: React.DragEvent<HTMLDivElement>, targetBlockId: string) => void
  onUpdateBlock: (blockId: string, patch: Partial<DocumentBlock>) => void
  onMoveBlock: (blockId: string, dir: -1 | 1) => void
  onRemoveBlock: (blockId: string) => void
  onOpenSlashMenu: (blockId: string | null, query?: string) => void
  onOpenWikiPicker: (blockId: string | null) => void
  onSlashInsert: (afterId: string, type: BlockType, columnCount?: number) => void
  onOpenPageInTab: (pageId: string, inSplitPane?: boolean) => void
  onOpenCodeInDiffInspector: (target: {
    repoPath: string
    relPath: string
    startLine?: number
    endLine?: number
  }) => void
  onShowToast: (msg: string, tone?: 'info' | 'error') => void
}

export const BlockItem: React.FC<BlockItemProps> = ({
  block,
  page,
  pages,
  boundRepoPath,
  canDelete,
  isSlashMenuOpen,
  slashInitialQuery,
  isWikiPickerOpen,
  isDragging,
  dropIndicator,
  onSetDragging,
  onDragOverBlock,
  onDropOnBlock,
  onUpdateBlock,
  onMoveBlock,
  onRemoveBlock,
  onOpenSlashMenu,
  onOpenWikiPicker,
  onSlashInsert,
  onOpenPageInTab,
  onOpenCodeInDiffInspector,
  onShowToast
}) => {
  const [wikiAutocomplete, setWikiAutocomplete] = useState<{
    query: string
    triggerStart: number
    cursorEnd: number
  } | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [activeInputEl, setActiveInputEl] = useState<
    HTMLTextAreaElement | HTMLInputElement | null
  >(null)

  const isWide =
    block.wide ||
    block.type === 'dbml' ||
    block.type === 'mermaid' ||
    block.type === 'graphviz' ||
    block.type === 'database' ||
    block.type === 'image'

  const handleTextValueChange = (
    val: string,
    cursorIdx: number,
    el: HTMLTextAreaElement | HTMLInputElement
  ): void => {
    setActiveInputEl(el)
    onUpdateBlock(block.id, { content: val })

    // Check `[[` autocomplete trigger
    const wikiTrigger = matchWikiAutocompleteTrigger(val, cursorIdx)
    if (wikiTrigger) {
      setWikiAutocomplete(wikiTrigger)
    } else {
      setWikiAutocomplete(null)
    }

    // Check `/query` slash command trigger
    const slashTrigger = matchSlashTrigger(val)
    if (slashTrigger) {
      onOpenSlashMenu(block.id, slashTrigger.query)
    } else if (isSlashMenuOpen && !val.includes('/')) {
      onOpenSlashMenu(null)
    }
  }

  const handleApplyInlineFormat = (
    format: InlineMarkdownFormat,
    el?: HTMLTextAreaElement | HTMLInputElement | null
  ): void => {
    const targetEl = el || activeInputEl
    const start = targetEl?.selectionStart ?? block.content.length
    const end = targetEl?.selectionEnd ?? block.content.length
    const res = applyInlineMarkdownShortcut(block.content, start, end, format)
    onUpdateBlock(block.id, { content: res.text })
    if (targetEl) {
      window.requestAnimationFrame(() => {
        targetEl.focus()
        targetEl.setSelectionRange(res.selectionStart, res.selectionEnd)
      })
    }
  }

  const handleEditorKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ): void => {
    const mod = e.ctrlKey || e.metaKey

    // Alt+ArrowUp / Alt+ArrowDown moves the block vertically (single undo step)
    if (e.altKey && !mod && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      onMoveBlock(block.id, e.key === 'ArrowUp' ? -1 : 1)
      return
    }

    // Inline Markdown shortcuts: Ctrl+B (bold), Ctrl+I (italic), Ctrl+E (code), Ctrl+Shift+S (strikethrough)
    if (mod && !e.altKey) {
      const lower = e.key.toLowerCase()
      if (!e.shiftKey && lower === 'b') {
        e.preventDefault()
        handleApplyInlineFormat('bold', e.currentTarget)
        return
      }
      if (!e.shiftKey && lower === 'i') {
        e.preventDefault()
        handleApplyInlineFormat('italic', e.currentTarget)
        return
      }
      if (!e.shiftKey && lower === 'e') {
        e.preventDefault()
        handleApplyInlineFormat('code', e.currentTarget)
        return
      }
      if (e.shiftKey && lower === 's') {
        e.preventDefault()
        handleApplyInlineFormat('strike', e.currentTarget)
        return
      }
    }
  }

  const handleSelectWikiCandidate = (targetText: string): void => {
    if (wikiAutocomplete) {
      const before = block.content.slice(0, wikiAutocomplete.triggerStart)
      const after = block.content.slice(wikiAutocomplete.cursorEnd)
      onUpdateBlock(block.id, {
        content: `${before}[[${targetText}]]${after}`
      })
      setWikiAutocomplete(null)
      return
    }
    onUpdateBlock(block.id, {
      content: `${block.content}${block.content.endsWith(' ') || !block.content ? '' : ' '}[[${targetText}]]`
    })
    onOpenWikiPicker(null)
  }

  const handleSlashSelect = (type: BlockType, columnCount?: number): void => {
    // Strip trailing `/query` trigger from current block if present
    const slashTrigger = matchSlashTrigger(block.content)
    if (slashTrigger) {
      const cleaned = block.content.slice(0, slashTrigger.triggerStart).trimEnd()
      onUpdateBlock(block.id, { content: cleaned })
    }
    onSlashInsert(block.id, type, columnCount)
  }

  const renderWikiLinkBadges = (text: string): React.ReactNode => {
    const matches = Array.from(text.matchAll(/\[\[([^\]]+)\]\]/g))
    if (matches.length === 0) return null

    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-ink-muted flex items-center gap-1">
          <Link2 size={11} aria-hidden="true" /> Linked references:
        </span>
        {matches.map((m, i) => {
          const targetTitle = m[1].trim()
          const codeTarget = parseCodeWikiLink(targetTitle)
          if (codeTarget) {
            return (
              <button
                key={`code-${codeTarget.displayLabel}-${i}`}
                type="button"
                onClick={() => {
                  if (!boundRepoPath) {
                    onShowToast(
                      'Bind a Git repository to this notebook to open code references.',
                      'error'
                    )
                    return
                  }
                  onOpenCodeInDiffInspector({
                    repoPath: boundRepoPath,
                    relPath: codeTarget.relPath,
                    startLine: codeTarget.startLine,
                    endLine: codeTarget.endLine
                  })
                }}
                title={`Open ${codeTarget.displayLabel} in Code & Diff Inspector`}
                className="px-2 py-0.5 rounded-[6px] text-[11.5px] font-mono font-medium border bg-[var(--pill-teal-bg)] border-[var(--pill-teal-border)] text-[var(--pill-teal-text)] hover:brightness-110 flex items-center gap-1.5 transition-colors"
              >
                <FileCode size={11.5} aria-hidden="true" />
                <span>{codeTarget.displayLabel}</span>
              </button>
            )
          }

          const targetPage = pages.find(
            (p) => p.title.toLowerCase() === targetTitle.toLowerCase()
          )
          return (
            <button
              key={`${targetTitle}-${i}`}
              type="button"
              onClick={(e) => {
                if (targetPage) onOpenPageInTab(targetPage.id, e.altKey)
              }}
              title={
                targetPage
                  ? `Open ${targetPage.code}: ${targetPage.title} (Alt+Click for Split Pane)`
                  : `Page '${targetTitle}' has not been created yet`
              }
              className={cn(
                'px-2 py-0.5 rounded-[6px] text-[11.5px] font-medium border flex items-center gap-1.5 transition-colors',
                targetPage
                  ? 'bg-[var(--pill-cobalt-bg)] border-[var(--pill-cobalt-border)] text-[var(--pill-cobalt-text)] hover:brightness-110'
                  : 'bg-surface-elevated border-border-hairline text-ink-muted'
              )}
            >
              <span>{targetPage?.icon || '📄'}</span>
              <span>{targetTitle}</span>
              {targetPage && (
                <span className="font-mono text-[10px]">{targetPage.code}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      draggable={isDragging}
      onDragStart={(event) => {
        if (!isDragging) return
        event.dataTransfer.setData('text/plain', block.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => onSetDragging(null)}
      onDragOver={(e) => onDragOverBlock(e, block.id)}
      onDrop={(e) => onDropOnBlock(e, block.id)}
      className={cn(
        'group relative transition-opacity',
        isWide ? 'max-w-full' : 'max-w-[760px] mx-auto',
        isDragging && 'opacity-45'
      )}
    >
      {/* Top Drop-Line Indicator */}
      {dropIndicator === 'before' && (
        <div
          aria-hidden="true"
          className="h-0.5 w-full bg-accent-cobalt rounded-full mb-1 shadow-[0_0_6px_var(--accent-cobalt)]"
        />
      )}

      {/* Hover Block Controls Pill Gutter + Floating Selection Bar */}
      <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-wrap items-center justify-end gap-1.5 mb-1 select-none">
        {hasSelection &&
          (block.type === 'paragraph' ||
            block.type === 'callout' ||
            block.type === 'checklist' ||
            block.type === 'toggle') && (
            <div
              role="toolbar"
              aria-label="Inline Markdown formatting"
              className="inline-flex items-center gap-0.5 p-0.5 rounded-[8px] bg-surface-elevated border border-border-strong shadow-sm"
            >
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleApplyInlineFormat('bold')
                }}
                title="Bold (Ctrl+B)"
                aria-label="Format bold"
                className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary"
              >
                <Bold size={11} aria-hidden="true" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleApplyInlineFormat('italic')
                }}
                title="Italic (Ctrl+I)"
                aria-label="Format italic"
                className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary"
              >
                <Italic size={11} aria-hidden="true" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleApplyInlineFormat('code')
                }}
                title="Inline code (Ctrl+E)"
                aria-label="Format inline code"
                className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary"
              >
                <Code size={11} aria-hidden="true" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleApplyInlineFormat('strike')
                }}
                title="Strikethrough (Ctrl+Shift+S)"
                aria-label="Format strikethrough"
                className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary"
              >
                <Strikethrough size={11} aria-hidden="true" />
              </button>
            </div>
          )}

        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-[8px] bg-surface-elevated border border-border-hairline shadow-sm">
          <span className="font-mono text-[9.5px] uppercase px-1.5 text-ink-muted">
            {block.type}
          </span>
          <span className="h-3 w-[1px] bg-border-hairline mx-0.5" />
          <button
            type="button"
            onPointerDown={() => onSetDragging(block.id)}
            onPointerUp={() => onSetDragging(null)}
            title="Drag to reorder block or move to column"
            aria-label="Drag handle to move block"
            className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical size={11} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onOpenWikiPicker(isWikiPickerOpen ? null : block.id)}
            title="Insert [[Wiki-Link]] to page or repository file"
            aria-label="Insert Wiki-Link to another page"
            className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-accent-cobalt transition-colors"
          >
            <Link2 size={11} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onOpenSlashMenu(isSlashMenuOpen ? null : block.id, '')}
            title="Insert block below (/)"
            aria-label="Insert block below"
            className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-accent-cobalt transition-colors"
          >
            <Plus size={11} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMoveBlock(block.id, -1)}
            title="Move block up (Alt+Up)"
            aria-label="Move block up"
            className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ArrowUp size={11} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMoveBlock(block.id, 1)}
            title="Move block down (Alt+Down)"
            aria-label="Move block down"
            className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ArrowDown size={11} aria-hidden="true" />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onRemoveBlock(block.id)}
              title="Delete block"
              aria-label="Delete block"
              className="p-1 rounded-[5px] hover:bg-[var(--pill-red-bg)] text-ink-secondary hover:text-[var(--pill-red-text)] transition-colors"
            >
              <Trash2 size={11} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Wiki-Link Quick Picker / Live [[ Autocomplete Popover */}
      {(isWikiPickerOpen || wikiAutocomplete !== null) && (
        <WikiAutocompletePopover
          query={wikiAutocomplete?.query || ''}
          currentPageId={page.id}
          pages={pages}
          boundRepoPath={boundRepoPath}
          onSelectTarget={handleSelectWikiCandidate}
          onClose={() => {
            setWikiAutocomplete(null)
            onOpenWikiPicker(null)
          }}
        />
      )}

      {/* Block Body by Type */}
      {block.type === 'h1' && (
        <input
          type="text"
          aria-label="Heading 1 text"
          value={block.content}
          onChange={(e) =>
            handleTextValueChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
              e.target
            )
          }
          onKeyDown={handleEditorKeyDown}
          placeholder="Heading 1..."
          className="w-full bg-transparent font-display font-bold text-[26px] tracking-[-0.02em] text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-border-subtle pb-1.5"
        />
      )}

      {block.type === 'h2' && (
        <input
          type="text"
          aria-label="Heading 2 text"
          value={block.content}
          onChange={(e) =>
            handleTextValueChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
              e.target
            )
          }
          onKeyDown={handleEditorKeyDown}
          placeholder="Heading 2..."
          className="w-full bg-transparent font-display font-semibold text-[20px] tracking-[-0.015em] text-ink-primary placeholder:text-ink-muted focus:outline-none mt-2"
        />
      )}

      {block.type === 'h3' && (
        <input
          type="text"
          aria-label="Heading 3 text"
          value={block.content}
          onChange={(e) =>
            handleTextValueChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
              e.target
            )
          }
          onKeyDown={handleEditorKeyDown}
          placeholder="Heading 3..."
          className="w-full bg-transparent font-display font-semibold text-[16px] tracking-[-0.01em] text-ink-primary placeholder:text-ink-muted focus:outline-none mt-1"
        />
      )}

      {block.type === 'paragraph' && (
        <div>
          <textarea
            aria-label="Paragraph text"
            value={block.content}
            onChange={(e) =>
              handleTextValueChange(
                e.target.value,
                e.target.selectionStart ?? e.target.value.length,
                e.target
              )
            }
            onSelect={(e) => {
              const el = e.currentTarget
              setActiveInputEl(el)
              setHasSelection(el.selectionEnd > el.selectionStart)
            }}
            onBlur={() => setHasSelection(false)}
            onKeyDown={handleEditorKeyDown}
            rows={Math.max(2, Math.ceil(block.content.length / 85))}
            placeholder="Write notes, type '/' for blocks, or '[[' to link pages & repository code..."
            className="w-full bg-transparent text-[14.5px] leading-[1.7] text-ink-primary placeholder:text-ink-muted resize-none focus:outline-none selectable-text"
          />
          {renderFormattedInlinePreview(block.content)}
          {renderWikiLinkBadges(block.content)}
        </div>
      )}

      {block.type === 'checklist' && (
        <div className="flex items-start gap-2.5 py-1">
          <input
            type="checkbox"
            aria-label={`Complete checklist item ${block.content || 'item'}`}
            checked={Boolean(block.checked)}
            onChange={(e) => onUpdateBlock(block.id, { checked: e.target.checked })}
            className="mt-1 w-4 h-4 accent-[var(--accent-cobalt)] rounded cursor-pointer"
          />
          <div className="flex-1">
            <input
              type="text"
              aria-label="Checklist item text"
              value={block.content}
              onChange={(e) =>
                handleTextValueChange(
                  e.target.value,
                  e.target.selectionStart ?? e.target.value.length,
                  e.target
                )
              }
              onSelect={(e) => {
                const el = e.currentTarget
                setActiveInputEl(el)
                setHasSelection((el.selectionEnd ?? 0) > (el.selectionStart ?? 0))
              }}
              onBlur={() => setHasSelection(false)}
              onKeyDown={handleEditorKeyDown}
              placeholder="Checklist item..."
              className={`w-full bg-transparent text-[14.5px] focus:outline-none ${
                block.checked ? 'line-through text-ink-muted' : 'text-ink-primary'
              }`}
            />
            {renderFormattedInlinePreview(block.content)}
            {renderWikiLinkBadges(block.content)}
          </div>
        </div>
      )}

      {block.type === 'callout' && (
        <div className="p-4 rounded-[10px] bg-surface-elevated border border-border-hairline flex gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.18)]">
          <div
            className={`w-1 rounded-full shrink-0 ${
              MARKER_META[block.calloutColor || 'cobalt'].dotBg
            }`}
          />
          <div className="flex-1 space-y-1.5">
            <input
              type="text"
              aria-label="Callout title"
              value={block.calloutTitle || 'Specification Note'}
              onChange={(e) => onUpdateBlock(block.id, { calloutTitle: e.target.value })}
              className="w-full bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--pill-cobalt-text)] focus:outline-none"
            />
            <textarea
              aria-label="Callout body"
              value={block.content}
              onChange={(e) =>
                handleTextValueChange(
                  e.target.value,
                  e.target.selectionStart ?? e.target.value.length,
                  e.target
                )
              }
              onSelect={(e) => {
                const el = e.currentTarget
                setActiveInputEl(el)
                setHasSelection((el.selectionEnd ?? 0) > (el.selectionStart ?? 0))
              }}
              onBlur={() => setHasSelection(false)}
              onKeyDown={handleEditorKeyDown}
              rows={Math.max(2, Math.ceil(block.content.length / 80))}
              className="w-full bg-transparent text-[13.5px] leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text"
            />
            {renderFormattedInlinePreview(block.content)}
            {renderWikiLinkBadges(block.content)}
          </div>
        </div>
      )}

      {block.type === 'toggle' && (
        <div className="rounded-[10px] bg-surface-elevated border border-border-hairline p-3 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={block.toggleOpen ?? true}
              aria-label="Toggle collapsible section"
              onClick={() =>
                onUpdateBlock(block.id, { toggleOpen: !(block.toggleOpen ?? true) })
              }
              className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary transition-colors"
            >
              {block.toggleOpen ?? true ? (
                <ChevronDown size={14} aria-hidden="true" />
              ) : (
                <ChevronRight size={14} aria-hidden="true" />
              )}
            </button>
            <input
              type="text"
              aria-label="Toggle section title"
              value={block.toggleTitle ?? 'Technical details'}
              onChange={(e) => onUpdateBlock(block.id, { toggleTitle: e.target.value })}
              placeholder="Toggle section title..."
              className="flex-1 bg-transparent font-display font-semibold text-sm text-ink-primary focus:outline-none"
            />
          </div>
          {(block.toggleOpen ?? true) && (
            <div className="pl-7 space-y-1.5">
              <textarea
                aria-label="Toggle section body"
                value={block.content}
                onChange={(e) =>
                  handleTextValueChange(
                    e.target.value,
                    e.target.selectionStart ?? e.target.value.length,
                    e.target
                  )
                }
                onSelect={(e) => {
                  const el = e.currentTarget
                  setActiveInputEl(el)
                  setHasSelection(el.selectionEnd > el.selectionStart)
                }}
                onBlur={() => setHasSelection(false)}
                onKeyDown={handleEditorKeyDown}
                rows={Math.max(2, Math.ceil(block.content.length / 80))}
                placeholder="Write collapsible section details..."
                className="w-full bg-transparent text-[13.5px] leading-relaxed text-ink-secondary resize-none focus:outline-none selectable-text"
              />
              {renderFormattedInlinePreview(block.content)}
              {renderWikiLinkBadges(block.content)}
            </div>
          )}
        </div>
      )}

      {block.type === 'divider' && (
        <div className="py-3 flex items-center" role="separator" aria-orientation="horizontal">
          <hr className="w-full border-t border-border-hairline" />
        </div>
      )}

      {block.type === 'code' && (
        <div className="rounded-[10px] bg-surface-chrome border border-border-hairline overflow-hidden">
          <div className="px-3.5 py-2 bg-surface-elevated/80 border-b border-border-hairline flex items-center justify-between text-[11px] text-ink-muted">
            <span className="font-medium">Code snippet</span>
            <input
              type="text"
              aria-label="Code snippet language"
              value={block.language || 'sql'}
              onChange={(e) => onUpdateBlock(block.id, { language: e.target.value })}
              className="w-20 bg-transparent text-right font-mono uppercase text-accent-amber focus:outline-none"
            />
          </div>
          <textarea
            aria-label="Code snippet content"
            value={block.content}
            onChange={(e) => onUpdateBlock(block.id, { content: e.target.value })}
            onKeyDown={handleEditorKeyDown}
            rows={Math.max(3, block.content.split('\n').length)}
            spellCheck={false}
            className="w-full p-3.5 bg-transparent font-mono text-[12.5px] leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text"
          />
        </div>
      )}

      {block.type === 'dbml' && (
        <Suspense fallback={<BlockStudioFallback label="DBML Studio" />}>
          <DBMLStudio
            code={block.content}
            layout={block.dbmlLayout}
            viewMode={block.dbmlViewMode || 'split'}
            wide={block.wide}
            onChange={(updates) => onUpdateBlock(block.id, updates)}
          />
        </Suspense>
      )}

      {block.type === 'mermaid' && (
        <Suspense fallback={<BlockStudioFallback label="Mermaid Diagram Studio" />}>
          <MermaidStudio
            code={block.content}
            viewMode={block.mermaidViewMode || 'split'}
            onChange={(updates) => onUpdateBlock(block.id, updates)}
          />
        </Suspense>
      )}

      {block.type === 'graphviz' && (
        <Suspense fallback={<BlockStudioFallback label="Graphviz DOT Studio" />}>
          <GraphvizStudio
            code={block.content}
            viewMode={block.graphvizViewMode || 'split'}
            engine={block.graphvizEngine}
            onChange={(updates) => onUpdateBlock(block.id, updates)}
          />
        </Suspense>
      )}

      {(block.type === 'image' || block.type === 'file') && <AssetBlock block={block} />}

      {block.type === 'database' && (
        <Suspense fallback={<BlockStudioFallback label="Project Database" />}>
          <ProjectDatabaseBlock
            title={block.databaseTitle || 'PROJECT DATABASE'}
            activeView={block.databaseActiveView || 'gantt'}
            chartType={block.databaseChartType || 'bar'}
            items={block.databaseItems || []}
            onChange={(updates) => onUpdateBlock(block.id, updates)}
          />
        </Suspense>
      )}

      {/* Keyboard-First Slash Command Popover */}
      {isSlashMenuOpen && (
        <SlashCommandMenu
          initialQuery={slashInitialQuery}
          onSelect={handleSlashSelect}
          onClose={() => onOpenSlashMenu(null)}
        />
      )}

      {/* Bottom Drop-Line Indicator */}
      {dropIndicator === 'after' && (
        <div
          aria-hidden="true"
          className="h-0.5 w-full bg-accent-cobalt rounded-full mt-1 shadow-[0_0_6px_var(--accent-cobalt)]"
        />
      )}
    </div>
  )
}
