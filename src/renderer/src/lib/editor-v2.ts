import type { BlockType, DocumentBlock } from '@shared/types/domain'
import { createId } from './ids'

export type SlashCategory = 'Text' | 'Layout' | 'Diagrams' | 'Data' | 'Media'

export interface SlashCommandOption {
  id: string
  type: BlockType
  label: string
  desc: string
  category: SlashCategory
  keywords: string[]
  columnCount?: number
}

export const SLASH_CATEGORIES: readonly SlashCategory[] = [
  'Text',
  'Layout',
  'Diagrams',
  'Data',
  'Media'
]

export const SLASH_COMMAND_OPTIONS: readonly SlashCommandOption[] = [
  {
    id: 'paragraph',
    type: 'paragraph',
    label: 'Text Paragraph',
    desc: 'Standard writing block supporting [[Wiki-Links]] and inline Markdown',
    category: 'Text',
    keywords: ['text', 'paragraph', 'p', 'body']
  },
  {
    id: 'h1',
    type: 'h1',
    label: 'Heading 1',
    desc: 'Primary section title (Space Grotesk 26px)',
    category: 'Text',
    keywords: ['h1', 'heading', 'title', 'header']
  },
  {
    id: 'h2',
    type: 'h2',
    label: 'Heading 2',
    desc: 'Specification subsection (Space Grotesk 20px)',
    category: 'Text',
    keywords: ['h2', 'heading', 'subtitle', 'section']
  },
  {
    id: 'h3',
    type: 'h3',
    label: 'Heading 3',
    desc: 'Technical subheading (Space Grotesk 16px)',
    category: 'Text',
    keywords: ['h3', 'heading', 'subheading']
  },
  {
    id: 'checklist',
    type: 'checklist',
    label: 'Checklist',
    desc: 'Task item with an interactive checkbox',
    category: 'Text',
    keywords: ['checklist', 'todo', 'task', 'checkbox', 'check']
  },
  {
    id: 'callout',
    type: 'callout',
    label: 'Specification Callout',
    desc: 'Highlighted box with a Drafting Marker accent strip',
    category: 'Text',
    keywords: ['callout', 'note', 'info', 'alert', 'warning']
  },
  {
    id: 'toggle',
    type: 'toggle',
    label: 'Collapsible Toggle Section',
    desc: 'Expandable details block for deep technical notes',
    category: 'Text',
    keywords: ['toggle', 'collapse', 'details', 'accordion', 'fold']
  },
  {
    id: 'code',
    type: 'code',
    label: 'Technical Code Block',
    desc: 'Monospace code snippet (SQL, TypeScript, JSON)',
    category: 'Text',
    keywords: ['code', 'snippet', 'sql', 'ts', 'json']
  },
  {
    id: 'divider',
    type: 'divider',
    label: 'Horizontal Divider',
    desc: 'Subtle hairline section separator',
    category: 'Layout',
    keywords: ['divider', 'hr', 'line', 'separator', 'rule']
  },
  {
    id: 'columns-2',
    type: 'columns',
    label: '2 Columns',
    desc: 'Two side-by-side columns with a resizable divider',
    category: 'Layout',
    keywords: ['columns', '2col', 'col', 'split', 'layout'],
    columnCount: 2
  },
  {
    id: 'columns-3',
    type: 'columns',
    label: '3 Columns',
    desc: 'Three side-by-side columns for quick comparison',
    category: 'Layout',
    keywords: ['columns', '3col', 'col', 'grid', 'layout'],
    columnCount: 3
  },
  {
    id: 'dbml',
    type: 'dbml',
    label: 'Interactive DBML Studio',
    desc: 'DBML schema editor + interactive ERD + SQL DDL compiler',
    category: 'Diagrams',
    keywords: ['dbml', 'schema', 'erd', 'sql', 'table', 'database']
  },
  {
    id: 'mermaid',
    type: 'mermaid',
    label: 'Offline Mermaid Diagram',
    desc: 'Sequence, Flowchart, or State Diagram with live preview',
    category: 'Diagrams',
    keywords: ['mermaid', 'diagram', 'flowchart', 'sequence', 'state']
  },
  {
    id: 'graphviz',
    type: 'graphviz',
    label: 'Graphviz Diagram (DOT)',
    desc: 'DOT language with dot, neato, fdp, circo, and twopi engines',
    category: 'Diagrams',
    keywords: ['graphviz', 'dot', 'dag', 'graph', 'network']
  },
  {
    id: 'database',
    type: 'database',
    label: 'Gantt Chart & Project Database',
    desc: 'Multi-view table: Gantt Timeline, Kanban, & Data Chart',
    category: 'Data',
    keywords: ['database', 'gantt', 'kanban', 'roadmap', 'table', 'chart', 'calendar']
  },
  {
    id: 'image',
    type: 'image',
    label: 'Image / Screenshot',
    desc: 'Import PNG, JPG, WebP, or SVG into workspace/assets',
    category: 'Media',
    keywords: ['image', 'img', 'png', 'photo', 'screenshot', 'picture']
  },
  {
    id: 'file',
    type: 'file',
    label: 'File Attachment',
    desc: 'Attach a PDF or other file as an embedded card',
    category: 'Media',
    keywords: ['file', 'pdf', 'attachment', 'upload', 'document']
  }
]

/**
 * Fuzzy-filters slash command options by query (e.g. "dbml", "/col", "mer").
 */
export function filterSlashOptions(
  query: string,
  options: readonly SlashCommandOption[] = SLASH_COMMAND_OPTIONS
): SlashCommandOption[] {
  const normalized = query.trim().replace(/^\/+/, '').toLowerCase()
  if (!normalized) return [...options]

  // 1. Primary match on label, type, or keywords
  const primaryMatches = options.filter((opt) => {
    const primaryHaystacks = [
      opt.label.toLowerCase(),
      opt.type.toLowerCase(),
      ...opt.keywords
    ]
    return primaryHaystacks.some((h) => h.includes(normalized))
  })
  if (primaryMatches.length > 0) {
    return primaryMatches
  }

  // 2. Secondary match on category or description
  const secondaryMatches = options.filter((opt) => {
    return (
      opt.category.toLowerCase().includes(normalized) ||
      opt.desc.toLowerCase().includes(normalized)
    )
  })
  if (secondaryMatches.length > 0) {
    return secondaryMatches
  }

  // 2. Fallback subsequence fuzzy match against label + keywords
  return options.filter((opt) => {
    const combined = `${opt.label} ${opt.keywords.join(' ')}`.toLowerCase()
    let qIdx = 0
    for (let i = 0; i < combined.length && qIdx < normalized.length; i++) {
      if (combined[i] === normalized[qIdx]) qIdx++
    }
    return qIdx === normalized.length
  })
}

/**
 * Extracts active slash query at the end of a block's text if it ends with `/query`.
 * Returns `null` if no active slash trigger is present.
 */
export function matchSlashTrigger(text: string): {
  query: string
  triggerStart: number
} | null {
  const match = /(?:^|\s)\/([a-zA-Z0-9_-]{0,20})$/.exec(text)
  if (!match) return null
  const slashIdx = text.lastIndexOf('/')
  return {
    query: match[1] || '',
    triggerStart: slashIdx
  }
}

/**
 * Detects an unclosed `[[query` trigger at the cursor position (or end of text).
 */
export function matchWikiAutocompleteTrigger(
  text: string,
  cursorIndex: number = text.length
): {
  query: string
  triggerStart: number
  cursorEnd: number
} | null {
  const prefix = text.slice(0, Math.max(0, Math.min(cursorIndex, text.length)))
  const lastOpen = prefix.lastIndexOf('[[')
  if (lastOpen < 0) return null

  const afterOpen = prefix.slice(lastOpen + 2)
  if (afterOpen.includes(']]') || afterOpen.includes('\n')) return null

  return {
    query: afterOpen,
    triggerStart: lastOpen,
    cursorEnd: prefix.length
  }
}

export type InlineMarkdownFormat = 'bold' | 'italic' | 'code' | 'strike' | 'link'

const FORMAT_MARKERS: Record<
  Exclude<InlineMarkdownFormat, 'link'>,
  { prefix: string; suffix: string; placeholder: string }
> = {
  bold: { prefix: '**', suffix: '**', placeholder: 'bold text' },
  italic: { prefix: '*', suffix: '*', placeholder: 'italic text' },
  code: { prefix: '`', suffix: '`', placeholder: 'code' },
  strike: { prefix: '~~', suffix: '~~', placeholder: 'strikethrough' }
}

/**
 * Wraps or unwraps the selected text range `[selectionStart, selectionEnd)` with Markdown syntax.
 */
export function applyInlineMarkdownShortcut(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  format: InlineMarkdownFormat
): {
  text: string
  selectionStart: number
  selectionEnd: number
} {
  const start = Math.max(0, Math.min(selectionStart, text.length))
  const end = Math.max(start, Math.min(selectionEnd, text.length))
  const before = text.slice(0, start)
  const selected = text.slice(start, end)
  const after = text.slice(end)

  if (format === 'link') {
    const label = selected || 'link text'
    const url = 'https://'
    const replacement = `[${label}](${url})`
    const urlStart = start + label.length + 3
    return {
      text: `${before}${replacement}${after}`,
      selectionStart: urlStart,
      selectionEnd: urlStart + url.length
    }
  }

  const { prefix, suffix, placeholder } = FORMAT_MARKERS[format]

  // Toggle off if already wrapped directly around selection
  if (
    before.endsWith(prefix) &&
    after.startsWith(suffix) &&
    selected.length > 0
  ) {
    const nextBefore = before.slice(0, before.length - prefix.length)
    const nextAfter = after.slice(suffix.length)
    return {
      text: `${nextBefore}${selected}${nextAfter}`,
      selectionStart: start - prefix.length,
      selectionEnd: end - prefix.length
    }
  }

  // Toggle off if selection itself includes the surrounding markers
  if (
    selected.length >= prefix.length + suffix.length &&
    selected.startsWith(prefix) &&
    selected.endsWith(suffix)
  ) {
    const inner = selected.slice(prefix.length, selected.length - suffix.length)
    return {
      text: `${before}${inner}${after}`,
      selectionStart: start,
      selectionEnd: start + inner.length
    }
  }

  const innerText = selected || placeholder
  const replacement = `${prefix}${innerText}${suffix}`
  return {
    text: `${before}${replacement}${after}`,
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + innerText.length
  }
}

/**
 * Reorders top-level blocks in a flat `DocumentBlock[]` array (moving `fromBlockId` before/after `toBlockId`).
 * If `fromBlockId` is a column group header, its children stay intact because `groupBlocks` resolves children by `columnGroupId`.
 */
export function reorderTopLevelBlocks(
  blocks: readonly DocumentBlock[],
  fromBlockId: string,
  toBlockId: string,
  position: 'before' | 'after' = 'after'
): DocumentBlock[] | null {
  if (!fromBlockId || !toBlockId || fromBlockId === toBlockId) return null
  const fromIdx = blocks.findIndex((b) => b.id === fromBlockId)
  const toIdx = blocks.findIndex((b) => b.id === toBlockId)
  if (fromIdx < 0 || toIdx < 0) return null

  const next = blocks.slice()
  const [moved] = next.splice(fromIdx, 1)
  const adjustedToIdx = next.findIndex((b) => b.id === toBlockId)
  if (adjustedToIdx < 0) return null

  const insertIdx = position === 'before' ? adjustedToIdx : adjustedToIdx + 1
  next.splice(insertIdx, 0, moved)

  // Return null if order did not actually change
  const unchanged = next.every((b, idx) => b.id === blocks[idx].id)
  return unchanged ? null : next
}

export function createDefaultBlock(
  type: BlockType,
  defaults?: { baseDate?: string; addDaysFn?: (iso: string, days: number) => string; defaultDot?: string }
): DocumentBlock {
  const firstTaskId = createId('tsk')
  const milestoneTaskId = createId('tsk')
  const baseDate = defaults?.baseDate || new Date().toISOString().slice(0, 10)
  const addDaysFn = defaults?.addDaysFn || ((iso: string) => iso)

  return {
    id: createId('blk'),
    type,
    content:
      type === 'dbml'
        ? `Table services [color: cobalt] {\n  id uuid [pk]\n  name varchar(120) [not null]\n}\n\nTable deployments [color: amber] {\n  id uuid [pk]\n  service_id uuid [ref: > services.id]\n  version varchar(32)\n}`
        : type === 'mermaid'
          ? `flowchart LR\n    A["Client Request"] --> B["IPC Bridge"]\n    B --> C["SQLite WAL Engine"]`
          : type === 'graphviz'
            ? defaults?.defaultDot || 'digraph G {\n  A -> B;\n}'
            : type === 'code'
              ? `-- Write your query or code here\nSELECT * FROM pages_fts WHERE pages_fts MATCH 'dbml';`
              : '',
    checked: false,
    calloutColor: 'cobalt',
    calloutTitle: 'SPECIFICATION NOTE',
    toggleTitle: type === 'toggle' ? 'Technical details' : undefined,
    toggleOpen: type === 'toggle' ? true : undefined,
    wide: type === 'dbml' || type === 'mermaid' || type === 'graphviz' || type === 'database',
    dbmlViewMode: 'split',
    mermaidViewMode: 'split',
    graphvizViewMode: 'split',
    graphvizEngine: 'dot',
    databaseTitle: 'MODULE SCHEDULE & METRICS',
    databaseActiveView: 'gantt',
    databaseChartType: 'bar',
    databaseItems:
      type === 'database'
        ? [
            {
              id: firstTaskId,
              code: 'TSK-01',
              title: 'Design Data Contract',
              category: 'Core',
              color: 'cobalt',
              status: 'in_progress',
              startDate: baseDate,
              endDate: addDaysFn(baseDate, 4),
              progress: 60,
              isMilestone: false,
              dependsOn: [],
              assignee: 'Engineer',
              estimateHours: 16
            },
            {
              id: milestoneTaskId,
              code: 'M1',
              title: 'Architecture Sign-Off',
              category: 'Milestone',
              color: 'amber',
              status: 'backlog',
              startDate: addDaysFn(baseDate, 5),
              endDate: addDaysFn(baseDate, 6),
              progress: 0,
              isMilestone: true,
              dependsOn: [firstTaskId],
              assignee: 'Team',
              estimateHours: 4
            }
          ]
        : undefined
  }
}
