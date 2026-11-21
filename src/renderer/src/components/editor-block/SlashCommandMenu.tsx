import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckSquare,
  ChevronRight,
  Code2,
  Columns2,
  Columns3,
  Database,
  GanttChart,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Minus,
  Network,
  Paperclip,
  Search,
  Sparkles,
  Type
} from 'lucide-react'
import { Kbd, cn } from '@renderer/components/ui'
import {
  filterSlashOptions,
  SLASH_CATEGORIES,
  type SlashCategory,
  type SlashCommandOption
} from '@renderer/lib/editor-v2'
import type { BlockType } from '@shared/types/domain'

interface SlashCommandMenuProps {
  initialQuery?: string
  onSelect: (type: BlockType, columnCount?: number) => void
  onClose: () => void
}

function renderSlashIcon(option: SlashCommandOption): React.ReactNode {
  switch (option.id) {
    case 'paragraph':
      return <Type size={13} className="text-ink-secondary" aria-hidden="true" />
    case 'h1':
      return <Heading1 size={13} className="text-accent-cobalt" aria-hidden="true" />
    case 'h2':
      return <Heading2 size={13} className="text-accent-cobalt" aria-hidden="true" />
    case 'h3':
      return <Heading3 size={13} className="text-accent-cobalt" aria-hidden="true" />
    case 'checklist':
      return <CheckSquare size={13} className="text-[#10B981]" aria-hidden="true" />
    case 'callout':
      return <Info size={13} className="text-accent-amber" aria-hidden="true" />
    case 'toggle':
      return <ChevronRight size={13} className="text-accent-cobalt" aria-hidden="true" />
    case 'code':
      return <Code2 size={13} className="text-[#8B5CF6]" aria-hidden="true" />
    case 'divider':
      return <Minus size={13} className="text-ink-secondary" aria-hidden="true" />
    case 'columns-2':
      return <Columns2 size={13} className="text-marker-teal" aria-hidden="true" />
    case 'columns-3':
      return <Columns3 size={13} className="text-marker-teal" aria-hidden="true" />
    case 'dbml':
      return <Database size={13} className="text-accent-cobalt" aria-hidden="true" />
    case 'mermaid':
      return <Sparkles size={13} className="text-[#10B981]" aria-hidden="true" />
    case 'graphviz':
      return <Network size={13} className="text-[#8B5CF6]" aria-hidden="true" />
    case 'database':
      return <GanttChart size={13} className="text-accent-amber" aria-hidden="true" />
    case 'image':
      return <ImageIcon size={13} className="text-[#10B981]" aria-hidden="true" />
    case 'file':
      return <Paperclip size={13} className="text-accent-amber" aria-hidden="true" />
    default:
      return <Type size={13} className="text-ink-secondary" aria-hidden="true" />
  }
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  initialQuery = '',
  onSelect,
  onClose
}) => {
  const [query, setQuery] = useState(initialQuery)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => filterSlashOptions(query), [query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<SlashCategory, SlashCommandOption[]>()
    for (const cat of SLASH_CATEGORIES) {
      const items = filtered.filter((o) => o.category === cat)
      if (items.length > 0) map.set(cat, items)
    }
    return map
  }, [filtered])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }
    if (filtered.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(filtered.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = filtered[activeIndex] || filtered[0]
      if (target) {
        onSelect(target.type, target.columnCount)
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Insert block slash menu"
      onKeyDown={handleKeyDown}
      className="mt-2 p-2 rounded-[10px] bg-surface-elevated border border-border-hairline shadow-popover z-30 max-w-md animate-popover-enter select-none"
    >
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 mb-1.5 border-b border-border-subtle">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Search size={12} className="text-ink-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="slash-command-listbox"
            aria-label="Filter slash block commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter blocks (e.g. dbml, col, mermaid, toggle)..."
            className="w-full bg-transparent text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close slash menu"
          className="text-ink-muted hover:text-ink-primary"
        >
          <Kbd>Esc</Kbd>
        </button>
      </div>

      <div
        id="slash-command-listbox"
        ref={listRef}
        role="listbox"
        aria-label="Available block types"
        className="max-h-64 overflow-y-auto space-y-2 pr-0.5"
      >
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-ink-muted font-mono">
            No matching block types for &ldquo;{query}&rdquo;
          </div>
        ) : (
          Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category} className="space-y-0.5">
              <div className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                {category}
              </div>
              {items.map((opt) => {
                const flatIdx = filtered.findIndex((f) => f.id === opt.id)
                const isSelected = flatIdx === activeIndex
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(flatIdx)}
                    onClick={() => onSelect(opt.type, opt.columnCount)}
                    className={cn(
                      'w-full px-2.5 py-1.5 rounded-[7px] text-left flex items-center gap-2.5 transition-colors',
                      isSelected
                        ? 'bg-surface-hover text-ink-primary'
                        : 'hover:bg-surface-hover/60 text-ink-secondary'
                    )}
                  >
                    <div className="w-7 h-7 rounded-[7px] bg-surface-chrome border border-border-hairline flex items-center justify-center shrink-0">
                      {renderSlashIcon(opt)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-ink-primary">{opt.label}</div>
                      <div className="text-[11px] text-ink-secondary truncate">{opt.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
