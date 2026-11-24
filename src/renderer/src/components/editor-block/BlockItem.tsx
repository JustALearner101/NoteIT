import React, { Suspense, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Bold,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  FileCode,
  GitBranch,
  GraduationCap,
  GripVertical,
  Italic,
  Link2,
  Plus,
  Sparkles,
  Strikethrough,
  Trash2,
  Wand2
} from 'lucide-react'
import { useWorkspaceStore, type BlockAIContextPreset } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { cn } from '@renderer/components/ui'
import { parseCodeWikiLink } from '@shared/code-wikilink'
import {
  applyInlineMarkdownShortcut,
  computeAutoGrowRows,
  matchMarkdownBlockShortcut,
  matchSlashTrigger,
  matchWikiAutocompleteTrigger,
  shouldSmartPasteMarkdown,
  TURN_INTO_OPTIONS,
  type InlineMarkdownFormat
} from '@renderer/lib/editor-v2'
import { AssetBlock } from './AssetBlock'
import { InlineRichText } from './InlineRichText'
import { SlashCommandMenu } from './SlashCommandMenu'
import { TableBlock } from './TableBlock'
import { WikiAutocompletePopover } from './WikiAutocompletePopover'
import type { BlockType, DocumentBlock, Page } from '@shared/types/domain'

const MathBlock = React.lazy(() =>
  import('./MathBlock').then((m) => ({
    default: m.MathBlock
  }))
)
const CodeBlockEditor = React.lazy(() =>
  import('./CodeBlockEditor').then((m) => ({
    default: m.CodeBlockEditor
  }))
)

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

export interface BlockItemProps {
  block: DocumentBlock
  page: Page
  pages: Page[]
  boundRepoPath: string
  canDelete: boolean
  isFocused: boolean
  focusRequest: { blockId: string; caret: 'start' | 'end'; nonce: number } | null
  isSlashMenuOpen: boolean
  slashInitialQuery: string
  isWikiPickerOpen: boolean
  isDragging: boolean
  dropIndicator: 'before' | 'after' | null
  onFocusBlock: () => void
  onBlurBlock: () => void
  onSplitOrInsertAfter: (
    blockId: string,
    beforeContent: string,
    afterContent: string,
    nextType: BlockType
  ) => void
  onMergeOrDeleteEmpty: (blockId: string) => void
  onFocusAdjacent: (blockId: string, dir: -1 | 1) => void
  onDuplicateBlock: (blockId: string) => void
  onConvertBlock: (blockId: string, targetType: BlockType) => void
  onSmartPaste: (blockId: string, pastedText: string) => boolean
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
  isFocused,
  focusRequest,
  isSlashMenuOpen,
  slashInitialQuery,
  isWikiPickerOpen,
  isDragging,
  dropIndicator,
  onFocusBlock,
  onBlurBlock,
  onSplitOrInsertAfter,
  onMergeOrDeleteEmpty,
  onFocusAdjacent,
  onDuplicateBlock,
  onConvertBlock,
  onSmartPaste,
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
  const sendBlockToAI = useWorkspaceStore((s) => s.sendBlockToAI)
  const startLearnFromSource = useWorkspaceStore((s) => s.startLearnFromSource)

  const [wikiAutocomplete, setWikiAutocomplete] = useState<{
    query: string
    triggerStart: number
    cursorEnd: number
  } | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false)
  const [isTurnIntoOpen, setIsTurnIntoOpen] = useState(false)
  const [activeInputEl, setActiveInputEl] = useState<
    HTMLTextAreaElement | HTMLInputElement | null
  >(null)
  const primaryInputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const plainPasteNextRef = useRef(false)

  // Focus & position caret whenever BlockEditor requests focus on this block
  useEffect(() => {
    if (!isFocused) return
    window.requestAnimationFrame(() => {
      const el = primaryInputRef.current
      if (!el) return
      if (document.activeElement !== el) {
        el.focus()
      }
      if (focusRequest) {
        const pos = focusRequest.caret === 'start' ? 0 : el.value.length
        try {
          el.setSelectionRange(pos, pos)
        } catch {
          // ignore on non-selectable input
        }
      }
    })
  }, [isFocused, focusRequest?.nonce, focusRequest?.caret])

  const getSelectedExcerpt = (): string | undefined => {
    if (!activeInputEl) return undefined
    const start = activeInputEl.selectionStart ?? 0
    const end = activeInputEl.selectionEnd ?? 0
    if (end <= start) return undefined
    return activeInputEl.value.slice(start, end).trim() || undefined
  }

  const triggerBlockAI = (preset: BlockAIContextPreset, promptDraft?: string): void => {
    setIsAiMenuOpen(false)
    sendBlockToAI({
      pageId: page.id,
      pageCode: page.code,
      pageTitle: page.title,
      blockId: block.id,
      blockType: block.type,
      content: block.content,
      selectedText: getSelectedExcerpt(),
      preset,
      promptDraft
    })
  }

  const triggerLearnBlock = (): void => {
    setIsAiMenuOpen(false)
    const excerpt = (getSelectedExcerpt() || block.content || page.title).trim().slice(0, 140)
    startLearnFromSource({
      title: `${page.title} · Block`,
      goal: `Understand and practice this concept from "${page.title}": ${excerpt}`,
      sourceType: 'page',
      pageId: page.id
    })
  }

  const isWide =
    block.wide ||
    block.type === 'dbml' ||
    block.type === 'mermaid' ||
    block.type === 'graphviz' ||
    block.type === 'database' ||
    block.type === 'table' ||
    block.type === 'image'

  const handleTextValueChange = (
    val: string,
    cursorIdx: number,
    el: HTMLTextAreaElement | HTMLInputElement
  ): void => {
    setActiveInputEl(el)

    // Auto-convert start-of-block Markdown shortcuts in paragraph blocks
    if (block.type === 'paragraph') {
      const shortcut = matchMarkdownBlockShortcut(val)
      if (shortcut) {
        onUpdateBlock(block.id, {
          type: shortcut.type,
          content: shortcut.content,
          ...(shortcut.checked !== undefined ? { checked: shortcut.checked } : {}),
          ...(shortcut.language ? { language: shortcut.language } : {}),
          ...(shortcut.type === 'callout' ? { calloutTitle: 'SPECIFICATION NOTE', calloutColor: 'cobalt' } : {}),
          ...(shortcut.type === 'math' ? { mathViewMode: 'split' } : {})
        })
        return
      }
    }

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
    const el = e.currentTarget
    const selStart = el.selectionStart ?? 0
    const selEnd = el.selectionEnd ?? 0

    // Ctrl+Shift+V marks next paste as raw/plain paste (bypasses Smart Markdown Paste)
    if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
      plainPasteNextRef.current = true
      return
    }

    // Ctrl+D duplicates the current block
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      onDuplicateBlock(block.id)
      return
    }

    // Alt+ArrowUp / Alt+ArrowDown moves the block vertically (single undo step)
    if (e.altKey && !mod && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      onMoveBlock(block.id, e.key === 'ArrowUp' ? -1 : 1)
      return
    }

    // Notion-style Enter flow for paragraph, headings, and checklist
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !mod &&
      !e.altKey &&
      !isSlashMenuOpen &&
      wikiAutocomplete === null
    ) {
      if (block.type === 'paragraph' || block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
        e.preventDefault()
        const before = block.content.slice(0, selStart)
        const after = block.content.slice(selEnd)
        onSplitOrInsertAfter(block.id, before, after, 'paragraph')
        return
      }
      if (block.type === 'checklist') {
        e.preventDefault()
        if (block.content.trim().length === 0) {
          onConvertBlock(block.id, 'paragraph')
        } else {
          const before = block.content.slice(0, selStart)
          const after = block.content.slice(selEnd)
          onSplitOrInsertAfter(block.id, before, after, 'checklist')
        }
        return
      }
    }

    // Backspace at caret 0 deletes empty block or merges into previous text block
    if (
      e.key === 'Backspace' &&
      !mod &&
      !e.shiftKey &&
      !e.altKey &&
      selStart === 0 &&
      selEnd === 0 &&
      (block.type === 'paragraph' ||
        block.type === 'h1' ||
        block.type === 'h2' ||
        block.type === 'h3' ||
        block.type === 'checklist')
    ) {
      e.preventDefault()
      if (block.type !== 'paragraph' && block.content.length > 0) {
        onConvertBlock(block.id, 'paragraph')
      } else {
        onMergeOrDeleteEmpty(block.id)
      }
      return
    }

    // ArrowUp on first line / ArrowDown on last line moves focus across blocks
    if (!mod && !e.shiftKey && !e.altKey && !isSlashMenuOpen && wikiAutocomplete === null) {
      if (e.key === 'ArrowUp' && selStart === 0 && selEnd === 0) {
        e.preventDefault()
        onFocusAdjacent(block.id, -1)
        return
      }
      if (e.key === 'ArrowDown' && selStart === el.value.length && selEnd === el.value.length) {
        e.preventDefault()
        onFocusAdjacent(block.id, 1)
        return
      }
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

  const handleTextPaste = (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
    if (plainPasteNextRef.current) {
      plainPasteNextRef.current = false
      return
    }
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) return
    const text = e.clipboardData?.getData('text/plain') || ''
    if (!shouldSmartPasteMarkdown(text)) return
    const handled = onSmartPaste(block.id, text)
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
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
              <span className="h-3 w-[1px] bg-border-hairline mx-0.5" />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  triggerBlockAI('ask')
                }}
                title="Ask AI about selected text"
                aria-label="Ask AI about selected text"
                className="px-1.5 py-0.5 rounded-[5px] hover:bg-[var(--pill-violet-bg)] text-[var(--marker-violet)] text-[10.5px] font-medium flex items-center gap-1 transition-colors"
              >
                <Sparkles size={10.5} aria-hidden="true" />
                <span>Ask AI</span>
              </button>
            </div>
          )}

        <div className="relative inline-flex items-center gap-0.5 p-0.5 rounded-[8px] bg-surface-elevated border border-border-hairline shadow-sm">
          <button
            type="button"
            onClick={() => setIsTurnIntoOpen((prev) => !prev)}
            title="Turn into another block type"
            aria-label="Turn into another block type"
            aria-expanded={isTurnIntoOpen}
            className="font-mono text-[9.5px] uppercase px-1.5 py-0.5 rounded-[5px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover flex items-center gap-0.5 transition-colors"
          >
            <span>{block.type}</span>
            <ChevronDown size={9} aria-hidden="true" />
          </button>
          {isTurnIntoOpen && (
            <div
              role="menu"
              aria-label="Turn block into"
              className="absolute left-0 top-7 z-40 w-40 rounded-[10px] bg-surface-elevated border border-border-hairline shadow-popover p-1 space-y-0.5 animate-popover-enter"
            >
              {TURN_INTO_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsTurnIntoOpen(false)
                    onConvertBlock(block.id, opt.type)
                  }}
                  className={cn(
                    'w-full px-2 py-1 rounded-[6px] text-left text-xs transition-colors',
                    block.type === opt.type
                      ? 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] font-medium'
                      : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <span className="h-3 w-[1px] bg-border-hairline mx-0.5" />
          <button
            type="button"
            onClick={() => setIsAiMenuOpen((prev) => !prev)}
            aria-expanded={isAiMenuOpen}
            aria-label="AI actions for this block"
            title="Ask AI / Explain / Improve / Diagram / Learn this block"
            className={cn(
              'p-1 rounded-[5px] transition-colors',
              isAiMenuOpen
                ? 'bg-[var(--pill-violet-bg)] text-[var(--pill-violet-text)]'
                : 'hover:bg-[var(--pill-violet-bg)] text-[var(--marker-violet)]'
            )}
          >
            <Sparkles size={11} aria-hidden="true" />
          </button>
          {isAiMenuOpen && (
            <div
              role="menu"
              aria-label="Block AI actions"
              className="absolute right-0 top-7 z-40 w-52 rounded-[10px] bg-surface-elevated border border-border-hairline shadow-popover p-1 space-y-0.5 animate-popover-enter"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => triggerBlockAI('ask')}
                className="w-full px-2.5 py-1.5 rounded-[7px] text-left text-xs text-ink-primary hover:bg-surface-hover flex items-center gap-2 transition-colors"
              >
                <Sparkles size={12} className="text-[var(--marker-violet)] shrink-0" aria-hidden="true" />
                <span>Ask AI about block</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  triggerBlockAI('explain', 'Explain this clearly with concrete examples.')
                }
                className="w-full px-2.5 py-1.5 rounded-[7px] text-left text-xs text-ink-primary hover:bg-surface-hover flex items-center gap-2 transition-colors"
              >
                <BookOpen size={12} className="text-accent-cobalt shrink-0" aria-hidden="true" />
                <span>Explain simply</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  triggerBlockAI(
                    'improve',
                    'Improve the clarity, structure, and technical precision of this block.'
                  )
                }
                className="w-full px-2.5 py-1.5 rounded-[7px] text-left text-xs text-ink-primary hover:bg-surface-hover flex items-center gap-2 transition-colors"
              >
                <Wand2 size={12} className="text-accent-amber shrink-0" aria-hidden="true" />
                <span>Improve &amp; tighten</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  triggerBlockAI(
                    'diagram',
                    'Convert this into a clean Mermaid diagram (or DBML schema if it describes data models).'
                  )
                }
                className="w-full px-2.5 py-1.5 rounded-[7px] text-left text-xs text-ink-primary hover:bg-surface-hover flex items-center gap-2 transition-colors"
              >
                <GitBranch size={12} className="text-accent-teal shrink-0" aria-hidden="true" />
                <span>Turn into diagram</span>
              </button>
              <div className="my-1 border-t border-border-subtle" />
              <button
                type="button"
                role="menuitem"
                onClick={triggerLearnBlock}
                className="w-full px-2.5 py-1.5 rounded-[7px] text-left text-xs text-accent-teal hover:bg-surface-hover flex items-center gap-2 transition-colors"
              >
                <GraduationCap size={12} className="shrink-0" aria-hidden="true" />
                <span>Learn this block</span>
              </button>
            </div>
          )}
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
            onClick={() => onDuplicateBlock(block.id)}
            title="Duplicate block (Ctrl+D)"
            aria-label="Duplicate block"
            className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <Copy size={11} aria-hidden="true" />
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
          ref={(el) => {
            primaryInputRef.current = el
          }}
          type="text"
          aria-label="Heading 1 text"
          value={block.content}
          onFocus={onFocusBlock}
          onBlur={onBlurBlock}
          onChange={(e) =>
            handleTextValueChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
              e.target
            )
          }
          onKeyDown={handleEditorKeyDown}
          onPaste={handleTextPaste}
          placeholder="Heading 1..."
          className="w-full bg-transparent font-display font-bold text-[26px] tracking-[-0.02em] text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-border-subtle pb-1.5"
        />
      )}

      {block.type === 'h2' && (
        <input
          ref={(el) => {
            primaryInputRef.current = el
          }}
          type="text"
          aria-label="Heading 2 text"
          value={block.content}
          onFocus={onFocusBlock}
          onBlur={onBlurBlock}
          onChange={(e) =>
            handleTextValueChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
              e.target
            )
          }
          onKeyDown={handleEditorKeyDown}
          onPaste={handleTextPaste}
          placeholder="Heading 2..."
          className="w-full bg-transparent font-display font-semibold text-[20px] tracking-[-0.015em] text-ink-primary placeholder:text-ink-muted focus:outline-none mt-2"
        />
      )}

      {block.type === 'h3' && (
        <input
          ref={(el) => {
            primaryInputRef.current = el
          }}
          type="text"
          aria-label="Heading 3 text"
          value={block.content}
          onFocus={onFocusBlock}
          onBlur={onBlurBlock}
          onChange={(e) =>
            handleTextValueChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length,
              e.target
            )
          }
          onKeyDown={handleEditorKeyDown}
          onPaste={handleTextPaste}
          placeholder="Heading 3..."
          className="w-full bg-transparent font-display font-semibold text-[16px] tracking-[-0.01em] text-ink-primary placeholder:text-ink-muted focus:outline-none mt-1"
        />
      )}

      {block.type === 'paragraph' && (
        <div>
          {isFocused ? (
            <>
              <textarea
                ref={(el) => {
                  primaryInputRef.current = el
                }}
                aria-label="Paragraph text"
                value={block.content}
                onFocus={onFocusBlock}
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
                onBlur={() => {
                  setHasSelection(false)
                  onBlurBlock()
                }}
                onKeyDown={handleEditorKeyDown}
                onPaste={handleTextPaste}
                rows={computeAutoGrowRows(block.content, 82, 1)}
                placeholder="Write notes, type '/' for blocks, '# ' for headings, or '[[' to link pages..."
                className="w-full bg-transparent text-[14.5px] leading-[1.7] text-ink-primary placeholder:text-ink-muted resize-none focus:outline-none selectable-text"
              />
              {renderWikiLinkBadges(block.content)}
            </>
          ) : (
            <InlineRichText
              text={block.content}
              pages={pages}
              boundRepoPath={boundRepoPath}
              placeholder="Write notes, type '/' for blocks, '# ' for headings, or '[[' to link pages..."
              className="text-[14.5px] leading-[1.7] text-ink-primary"
              onOpenPageInTab={onOpenPageInTab}
              onOpenCodeInDiffInspector={onOpenCodeInDiffInspector}
              onShowToast={onShowToast}
              onRequestEdit={onFocusBlock}
            />
          )}
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
          <div className="flex-1 min-w-0">
            {isFocused ? (
              <>
                <input
                  ref={(el) => {
                    primaryInputRef.current = el
                  }}
                  type="text"
                  aria-label="Checklist item text"
                  value={block.content}
                  onFocus={onFocusBlock}
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
                  onBlur={() => {
                    setHasSelection(false)
                    onBlurBlock()
                  }}
                  onKeyDown={handleEditorKeyDown}
                  onPaste={handleTextPaste}
                  placeholder="Checklist item..."
                  className={`w-full bg-transparent text-[14.5px] focus:outline-none ${
                    block.checked ? 'line-through text-ink-muted' : 'text-ink-primary'
                  }`}
                />
                {renderWikiLinkBadges(block.content)}
              </>
            ) : (
              <InlineRichText
                text={block.content}
                pages={pages}
                boundRepoPath={boundRepoPath}
                placeholder="Checklist item..."
                strikethrough={Boolean(block.checked)}
                className="text-[14.5px] leading-snug text-ink-primary"
                onOpenPageInTab={onOpenPageInTab}
                onOpenCodeInDiffInspector={onOpenCodeInDiffInspector}
                onShowToast={onShowToast}
                onRequestEdit={onFocusBlock}
              />
            )}
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
          <div className="flex-1 space-y-1.5 min-w-0">
            <input
              type="text"
              aria-label="Callout title"
              value={block.calloutTitle || 'Specification Note'}
              onChange={(e) => onUpdateBlock(block.id, { calloutTitle: e.target.value })}
              className="w-full bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--pill-cobalt-text)] focus:outline-none"
            />
            {isFocused ? (
              <>
                <textarea
                  ref={(el) => {
                    primaryInputRef.current = el
                  }}
                  aria-label="Callout body"
                  value={block.content}
                  onFocus={onFocusBlock}
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
                  onBlur={() => {
                    setHasSelection(false)
                    onBlurBlock()
                  }}
                  onKeyDown={handleEditorKeyDown}
                  onPaste={handleTextPaste}
                  rows={computeAutoGrowRows(block.content, 76, 1)}
                  className="w-full bg-transparent text-[13.5px] leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text"
                />
                {renderWikiLinkBadges(block.content)}
              </>
            ) : (
              <InlineRichText
                text={block.content}
                pages={pages}
                boundRepoPath={boundRepoPath}
                placeholder="Write callout note..."
                className="text-[13.5px] leading-relaxed text-ink-primary"
                onOpenPageInTab={onOpenPageInTab}
                onOpenCodeInDiffInspector={onOpenCodeInDiffInspector}
                onShowToast={onShowToast}
                onRequestEdit={onFocusBlock}
              />
            )}
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
              {isFocused ? (
                <>
                  <textarea
                    ref={(el) => {
                      primaryInputRef.current = el
                    }}
                    aria-label="Toggle section body"
                    value={block.content}
                    onFocus={onFocusBlock}
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
                    onBlur={() => {
                      setHasSelection(false)
                      onBlurBlock()
                    }}
                    onKeyDown={handleEditorKeyDown}
                    onPaste={handleTextPaste}
                    rows={computeAutoGrowRows(block.content, 76, 1)}
                    placeholder="Write collapsible section details..."
                    className="w-full bg-transparent text-[13.5px] leading-relaxed text-ink-secondary resize-none focus:outline-none selectable-text"
                  />
                  {renderWikiLinkBadges(block.content)}
                </>
              ) : (
                <InlineRichText
                  text={block.content}
                  pages={pages}
                  boundRepoPath={boundRepoPath}
                  placeholder="Write collapsible section details..."
                  className="text-[13.5px] leading-relaxed text-ink-secondary"
                  onOpenPageInTab={onOpenPageInTab}
                  onOpenCodeInDiffInspector={onOpenCodeInDiffInspector}
                  onShowToast={onShowToast}
                  onRequestEdit={onFocusBlock}
                />
              )}
            </div>
          )}
        </div>
      )}

      {block.type === 'divider' && (
        <div className="py-3 flex items-center" role="separator" aria-orientation="horizontal">
          <hr className="w-full border-t border-border-hairline" />
        </div>
      )}

      {block.type === 'math' && (
        <Suspense fallback={<BlockStudioFallback label="LaTeX Math" />}>
          <MathBlock
            content={block.content}
            viewMode={block.mathViewMode || 'preview'}
            onChange={(updates) => onUpdateBlock(block.id, updates)}
          />
        </Suspense>
      )}

      {block.type === 'table' && (
        <TableBlock
          content={block.content}
          onChange={(nextMarkdown) => onUpdateBlock(block.id, { content: nextMarkdown })}
        />
      )}

      {block.type === 'code' && (
        <Suspense fallback={<BlockStudioFallback label="Code Editor" />}>
          <CodeBlockEditor
            content={block.content}
            language={block.language || 'typescript'}
            onChange={(updates) => onUpdateBlock(block.id, updates)}
          />
        </Suspense>
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
          onAskAI={() => {
            const slashTrigger = matchSlashTrigger(block.content)
            const cleaned = slashTrigger
              ? block.content.slice(0, slashTrigger.triggerStart).trimEnd()
              : block.content
            if (slashTrigger) {
              onUpdateBlock(block.id, { content: cleaned })
            }
            onOpenSlashMenu(null)
            sendBlockToAI({
              pageId: page.id,
              pageCode: page.code,
              pageTitle: page.title,
              blockId: block.id,
              blockType: block.type,
              content: cleaned,
              preset: 'ask'
            })
          }}
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
