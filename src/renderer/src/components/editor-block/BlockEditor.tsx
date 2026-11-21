import React, { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Code2,
  Columns2,
  Columns3,
  Database,
  GanttChart,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Link2,
  Network,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  Type
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { Badge, Kbd, cn } from '@renderer/components/ui'
import { createId } from '@renderer/lib/ids'
import { isImageMime } from '@shared/assets'
import { AssetBlock } from '@renderer/components/editor-block/AssetBlock'
import { DBMLStudio } from '@renderer/components/diagrams/dbml/DBMLStudio'
import { MermaidStudio } from '@renderer/components/diagrams/mermaid/MermaidStudio'
import { GraphvizStudio } from '@renderer/components/diagrams/graphviz/GraphvizStudio'
import { DEFAULT_DOT } from '@renderer/lib/diagrams/graphviz'
import { ProjectDatabaseBlock } from '@renderer/components/charts/ProjectDatabaseBlock'
import { ColumnGroup } from '@renderer/components/editor-block/ColumnGroup'
import {
  createColumnGroup,
  groupBlocks,
  removeColumn,
  resolveColumnDrop,
  type ColumnBlock
} from '@renderer/lib/columns'
import type { AssetRecord, BlockType, DocumentBlock, Page } from '@shared/types/domain'

interface BlockEditorProps {
  page: Page
}

const SLASH_OPTIONS: {
  type: BlockType
  label: string
  desc: string
  icon: React.ReactNode
  columnCount?: number
}[] = [
  {
    type: 'paragraph',
    label: 'Text Paragraph',
    desc: 'Standard writing block supporting [[Wiki-Links]]',
    icon: <Type size={13} className="text-ink-secondary" aria-hidden="true" />
  },
  {
    type: 'h1',
    label: 'Heading 1',
    desc: 'Primary section title (Space Grotesk 32px)',
    icon: <Heading1 size={13} className="text-accent-cobalt" aria-hidden="true" />
  },
  {
    type: 'h2',
    label: 'Heading 2',
    desc: 'Specification subsection (Space Grotesk 24px)',
    icon: <Heading2 size={13} className="text-accent-cobalt" aria-hidden="true" />
  },
  {
    type: 'h3',
    label: 'Heading 3',
    desc: 'Technical subheading (Space Grotesk 19px)',
    icon: <Heading3 size={13} className="text-accent-cobalt" aria-hidden="true" />
  },
  {
    type: 'columns',
    label: '2 Columns',
    desc: 'Two side-by-side columns with a resizable divider',
    icon: <Columns2 size={13} className="text-marker-teal" aria-hidden="true" />,
    columnCount: 2
  },
  {
    type: 'columns',
    label: '3 Columns',
    desc: 'Three side-by-side columns for quick comparison',
    icon: <Columns3 size={13} className="text-marker-teal" aria-hidden="true" />,
    columnCount: 3
  },
  {
    type: 'checklist',
    label: 'Checklist',
    desc: 'Task item with an interactive checkbox',
    icon: <CheckSquare size={13} className="text-[#10B981]" aria-hidden="true" />
  },
  {
    type: 'callout',
    label: 'Specification Callout',
    desc: 'Highlighted box with a Drafting Marker accent strip',
    icon: <Info size={13} className="text-accent-amber" aria-hidden="true" />
  },
  {
    type: 'code',
    label: 'Technical Code Block',
    desc: 'Monospace code snippet (SQL, TypeScript, JSON)',
    icon: <Code2 size={13} className="text-[#8B5CF6]" aria-hidden="true" />
  },
  {
    type: 'dbml',
    label: 'Interactive DBML Studio',
    desc: 'DBML schema editor + interactive ERD + SQL DDL compiler',
    icon: <Database size={13} className="text-accent-cobalt" aria-hidden="true" />
  },
  {
    type: 'mermaid',
    label: 'Offline Mermaid Diagram',
    desc: 'Sequence, Flowchart, or State Diagram with live preview',
    icon: <Sparkles size={13} className="text-[#10B981]" aria-hidden="true" />
  },
  {
    type: 'graphviz',
    label: 'Graphviz Diagram (DOT)',
    desc: 'DOT language with dot, neato, fdp, circo, and twopi engines',
    icon: <Network size={13} className="text-[#8B5CF6]" aria-hidden="true" />
  },
  {
    type: 'database',
    label: 'Gantt Chart & Project Database',
    desc: 'Multi-view table: Gantt Timeline, Kanban, & Data Chart',
    icon: <GanttChart size={13} className="text-accent-amber" aria-hidden="true" />
  },
  {
    type: 'image',
    label: 'Image / Screenshot',
    desc: 'Import PNG, JPG, WebP, or SVG into workspace/assets',
    icon: <ImageIcon size={13} className="text-[#10B981]" aria-hidden="true" />
  },
  {
    type: 'file',
    label: 'File Attachment',
    desc: 'Attach a PDF or other file as an embedded card',
    icon: <Paperclip size={13} className="text-accent-amber" aria-hidden="true" />
  }
]

/** Blok aset dari baris tabel assets; content = nama berkas agar ikut masuk FTS. */
function buildAssetBlock(asset: AssetRecord, kind: 'image' | 'file'): DocumentBlock {
  return {
    id: createId('blk'),
    type: kind,
    content: asset.name,
    wide: kind === 'image',
    assetId: asset.id,
    assetExt: asset.ext,
    assetMime: asset.mime,
    assetName: asset.name,
    assetSize: asset.size
  }
}

export const BlockEditor: React.FC<BlockEditorProps> = ({ page }) => {
  const { pages, updatePage, openPageInTab } = useWorkspaceStore()
  const [slashMenuForBlockId, setSlashMenuForBlockId] = useState<string | null>(null)
  const [wikiPickerForBlockId, setWikiPickerForBlockId] = useState<string | null>(null)
  // Blok baru draggable setelah pointerdown di grip: seluruh blok draggable akan
  // merusak seleksi teks di dalam editor.
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null)

  const updateBlock = (blockId: string, patch: Partial<DocumentBlock>): void => {
    const nextBlocks = page.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b))
    updatePage({ id: page.id, blocks: nextBlocks })
  }

  const insertBlockAfter = (afterId: string | null, type: BlockType): void => {
    const firstTaskId = createId('tsk')
    const milestoneTaskId = createId('tsk')
    const newBlock: DocumentBlock = {
      id: createId('blk'),
      type,
      content:
        type === 'dbml'
          ? `Table services [color: cobalt] {\n  id uuid [pk]\n  name varchar(120) [not null]\n}\n\nTable deployments [color: amber] {\n  id uuid [pk]\n  service_id uuid [ref: > services.id]\n  version varchar(32)\n}`
          : type === 'mermaid'
            ? `flowchart LR\n    A["Client Request"] --> B["IPC Bridge"]\n    B --> C["SQLite WAL Engine"]`
            : type === 'graphviz'
              ? DEFAULT_DOT
              : type === 'code'
                ? `-- Write your query or code here\nSELECT * FROM pages_fts WHERE pages_fts MATCH 'dbml';`
                : '',
      checked: false,
      calloutColor: 'cobalt',
      calloutTitle: 'SPECIFICATION NOTE',
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
                startDate: '2026-10-26',
                endDate: '2026-10-30',
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
                startDate: '2026-10-31',
                endDate: '2026-11-01',
                progress: 0,
                isMilestone: true,
                dependsOn: [firstTaskId],
                assignee: 'Team',
                estimateHours: 4
              }
            ]
          : undefined
    }

    insertBlocksAfter(afterId, [newBlock])
  }

  const insertBlocksAfter = (afterId: string | null, blocks: DocumentBlock[]): void => {
    if (blocks.length === 0) {
      setSlashMenuForBlockId(null)
      return
    }

    if (!afterId) {
      updatePage({ id: page.id, blocks: [...page.blocks, ...blocks] })
      setSlashMenuForBlockId(null)
      return
    }

    const idx = page.blocks.findIndex((b) => b.id === afterId)
    const nextBlocks = [...page.blocks]
    nextBlocks.splice(idx < 0 ? nextBlocks.length : idx + 1, 0, ...blocks)
    updatePage({ id: page.id, blocks: nextBlocks })
    setSlashMenuForBlockId(null)
  }

  const insertAssetBlocks = async (
    afterId: string | null,
    kind: 'image' | 'file'
  ): Promise<void> => {
    const result = await window.noteitAPI.importAssets()
    if (!result.assets.length) {
      setSlashMenuForBlockId(null)
      return
    }
    insertBlocksAfter(
      afterId,
      result.assets.map((asset) => buildAssetBlock(asset, kind))
    )
  }

  /**
   * Drop dan paste sama-sama mengirim byte lewat IPC: File.path sudah tidak ada
   * di Electron 35, dan screenshot clipboard memang tidak punya path.
   */
  const insertFiles = async (files: File[], afterId: string | null): Promise<void> => {
    const blocks: DocumentBlock[] = []
    for (const file of files) {
      try {
        const data = new Uint8Array(await file.arrayBuffer())
        const name =
          file.name && file.name.length > 0 ? file.name : `screenshot-${Date.now()}.png`
        const asset = await window.noteitAPI.importAssetBytes({ name, data })
        blocks.push(buildAssetBlock(asset, isImageMime(asset.mime) ? 'image' : 'file'))
      } catch (error) {
        console.error('Failed to import asset:', error)
      }
    }
    insertBlocksAfter(afterId, blocks)
  }

  /** Header grup + sel kolom kosong; model flat, jadi cukup satu updatePage. */
  const insertColumnGroup = (afterId: string, count: number): void => {
    updatePage({
      id: page.id,
      // createColumnGroup memakai kontrak struktural ColumnBlock; blok yang dibuat
      // hanya berisi field umum (id/type/content/column*), valid sebagai DocumentBlock.
      blocks: createColumnGroup(page.blocks, afterId, count) as DocumentBlock[]
    })
    setSlashMenuForBlockId(null)
  }

  /** Drop blok ke kolom lain; resolveColumnDrop mengembalikan null untuk no-op. */
  const moveBlockToColumnAt = (
    groupId: string,
    blockId: string,
    columnIndex: number
  ): void => {
    const nextBlocks = resolveColumnDrop(page.blocks, blockId, groupId, columnIndex)
    if (!nextBlocks) return
    updatePage({ id: page.id, blocks: nextBlocks })
  }

  /** Isi kolom dipindah ke kolom tetangga oleh removeColumn, bukan dibuang. */
  const removeColumnAt = (groupId: string, columnIndex: number): void => {
    updatePage({
      id: page.id,
      blocks: removeColumn(page.blocks, groupId, columnIndex)
    })
  }

  const handleSlashInsert = (
    afterId: string,
    type: BlockType,
    columnCount?: number
  ): void => {
    if (type === 'columns') {
      insertColumnGroup(afterId, columnCount ?? 2)
      return
    }
    if (type === 'image' || type === 'file') {
      void insertAssetBlocks(afterId, type)
      return
    }
    insertBlockAfter(afterId, type)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer?.types?.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (files.length === 0) return
    event.preventDefault()
    void insertFiles(files, null)
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>): void => {
    const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
      file.type.startsWith('image/')
    )
    if (files.length === 0) return
    event.preventDefault()
    void insertFiles(files, null)
  }

  const moveBlock = (blockId: string, dir: -1 | 1): void => {
    const idx = page.blocks.findIndex((b) => b.id === blockId)
    const targetIdx = idx + dir
    if (idx < 0 || targetIdx < 0 || targetIdx >= page.blocks.length) return
    const nextBlocks = [...page.blocks]
    const [removed] = nextBlocks.splice(idx, 1)
    nextBlocks.splice(targetIdx, 0, removed)
    updatePage({ id: page.id, blocks: nextBlocks })
  }

  const removeBlock = (blockId: string): void => {
    if (page.blocks.length <= 1) return

    // Hapus header grup: anak-anaknya dikeluarkan jadi blok biasa (tidak ikut hilang).
    const group = groupBlocks(page.blocks).find(
      (node) => node.kind === 'group' && node.header.id === blockId
    )
    if (group && group.kind === 'group') {
      const childIds = new Set(group.children.map((child) => child.block.id))
      updatePage({
        id: page.id,
        blocks: page.blocks
          .filter((b) => b.id !== blockId)
          .map((b) => {
            if (!childIds.has(b.id)) return b
            const ejected: DocumentBlock = { ...b }
            delete ejected.columnGroupId
            delete ejected.columnIndex
            return ejected
          })
      })
      return
    }

    updatePage({
      id: page.id,
      blocks: page.blocks.filter((b) => b.id !== blockId)
    })
  }

  const renderWikiLinkBadges = (text: string): React.ReactNode => {
    const matches = Array.from(text.matchAll(/\[\[([^\]]+)\]\]/g))
    if (matches.length === 0) return null

    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-ink-muted flex items-center gap-1">
          <Link2 size={11} /> Linked pages:
        </span>
        {matches.map((m, i) => {
          const targetTitle = m[1].trim()
          const targetPage = pages.find(
            (p) => p.title.toLowerCase() === targetTitle.toLowerCase()
          )
          return (
            <button
              key={`${targetTitle}-${i}`}
              type="button"
              onClick={(e) => {
                if (targetPage) openPageInTab(targetPage.id, e.altKey)
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
                <span className="font-mono text-[10px] opacity-75">{targetPage.code}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  /** Satu blok editor. columnIndex hanya untuk memenuhi kontrak renderBlock ColumnGroup. */
  const renderBlockNode = (
    block: DocumentBlock,
    columnIndex?: number
  ): React.ReactNode => {
    const isWide =
      block.wide ||
      block.type === 'dbml' ||
      block.type === 'mermaid' ||
      block.type === 'graphviz' ||
      block.type === 'database' ||
      block.type === 'image'

    return (
      <div
        key={block.id}
        draggable={draggingBlockId === block.id}
        onDragStart={(event) => {
          if (draggingBlockId !== block.id) return
          event.dataTransfer.setData('text/plain', block.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={() => setDraggingBlockId(null)}
        className={`group relative ${isWide ? 'max-w-full' : 'max-w-[760px] mx-auto'}`}
      >
        {/* Hover Block Controls Pill Gutter */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 mb-1 select-none">
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-[8px] bg-surface-elevated border border-border-hairline shadow-sm">
            <span className="font-mono text-[9.5px] uppercase px-1.5 text-ink-muted">
              {block.type}
            </span>
            <span className="h-3 w-[1px] bg-border-hairline mx-0.5" />
            <button
              type="button"
              onPointerDown={() => setDraggingBlockId(block.id)}
              onPointerUp={() => setDraggingBlockId(null)}
              title="Drag to another column"
              aria-label="Drag handle to move block"
              className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary cursor-grab active:cursor-grabbing transition-colors"
            >
              <GripVertical size={11} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() =>
                setWikiPickerForBlockId(
                  wikiPickerForBlockId === block.id ? null : block.id
                )
              }
              title="Insert [[Wiki-Link]] to another page"
              aria-label="Insert Wiki-Link to another page"
              className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-accent-cobalt transition-colors"
            >
              <Link2 size={11} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSlashMenuForBlockId(slashMenuForBlockId === block.id ? null : block.id)
              }
              title="Insert block below (/)"
              aria-label="Insert block below"
              className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-accent-cobalt transition-colors"
            >
              <Plus size={11} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => moveBlock(block.id, -1)}
              title="Move up"
              aria-label="Move block up"
              className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary transition-colors"
            >
              <ArrowUp size={11} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => moveBlock(block.id, 1)}
              title="Move down"
              aria-label="Move block down"
              className="p-1 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary transition-colors"
            >
              <ArrowDown size={11} aria-hidden="true" />
            </button>
            {page.blocks.length > 1 && (
              <button
                type="button"
                onClick={() => removeBlock(block.id)}
                title="Delete block"
                aria-label="Delete block"
                className="p-1 rounded-[5px] hover:bg-[var(--pill-red-bg)] text-ink-secondary hover:text-[var(--pill-red-text)] transition-colors"
              >
                <Trash2 size={11} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Wiki-Link Quick Picker Popup */}
        {wikiPickerForBlockId === block.id && (
          <div className="mb-2.5 p-3 rounded-[10px] bg-surface-elevated border border-border-strong shadow-popover z-20 animate-popover-enter">
            <div className="text-[11px] font-medium text-ink-secondary mb-2">
              Link page ([[Wiki-Link]])
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pages
                .filter((p) => p.id !== page.id)
                .map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => {
                      updateBlock(block.id, {
                        content: `${block.content} [[${target.title}]]`
                      })
                      setWikiPickerForBlockId(null)
                    }}
                    className="px-2.5 py-1.5 rounded-[7px] bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5 transition-colors"
                  >
                    <span>{target.icon}</span>
                    <span>{target.title}</span>
                    <span className="font-mono text-[10px] text-ink-muted">
                      {target.code}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Block Body by Type */}
        {block.type === 'h1' && (
          <input
            type="text"
            aria-label="Heading 1 text"
            value={block.content}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            placeholder="Heading 1..."
            className="w-full bg-transparent font-display font-bold text-[26px] tracking-[-0.02em] text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-border-subtle pb-1.5"
          />
        )}

        {block.type === 'h2' && (
          <input
            type="text"
            aria-label="Heading 2 text"
            value={block.content}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            placeholder="Heading 2..."
            className="w-full bg-transparent font-display font-semibold text-[20px] tracking-[-0.015em] text-ink-primary placeholder:text-ink-muted focus:outline-none mt-2"
          />
        )}

        {block.type === 'h3' && (
          <input
            type="text"
            aria-label="Heading 3 text"
            value={block.content}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            placeholder="Heading 3..."
            className="w-full bg-transparent font-display font-semibold text-[16px] tracking-[-0.01em] text-ink-primary placeholder:text-ink-muted focus:outline-none mt-1"
          />
        )}

        {block.type === 'paragraph' && (
          <div>
            <textarea
              aria-label="Paragraph text"
              value={block.content}
              onChange={(e) => {
                const val = e.target.value
                updateBlock(block.id, { content: val })
                if (val.endsWith('/')) {
                  setSlashMenuForBlockId(block.id)
                }
              }}
              rows={Math.max(2, Math.ceil(block.content.length / 85))}
              placeholder="Write notes or type '/' to insert a DBML, Mermaid, or Gantt Chart block..."
              className="w-full bg-transparent text-[14.5px] leading-[1.7] text-ink-primary placeholder:text-ink-muted resize-none focus:outline-none selectable-text"
            />
            {renderWikiLinkBadges(block.content)}
          </div>
        )}

        {block.type === 'checklist' && (
          <div className="flex items-start gap-2.5 py-1">
            <input
              type="checkbox"
              aria-label={`Complete checklist item ${block.content || 'item'}`}
              checked={Boolean(block.checked)}
              onChange={(e) => updateBlock(block.id, { checked: e.target.checked })}
              className="mt-1 w-4 h-4 accent-[var(--accent-cobalt)] rounded cursor-pointer"
            />
            <div className="flex-1">
              <input
                type="text"
                aria-label="Checklist item text"
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                placeholder="Checklist item..."
                className={`w-full bg-transparent text-[14.5px] focus:outline-none ${
                  block.checked ? 'line-through text-ink-muted' : 'text-ink-primary'
                }`}
              />
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
                onChange={(e) => updateBlock(block.id, { calloutTitle: e.target.value })}
                className="w-full bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--pill-cobalt-text)] focus:outline-none"
              />
              <textarea
                aria-label="Callout body"
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                rows={Math.max(2, Math.ceil(block.content.length / 80))}
                className="w-full bg-transparent text-[13.5px] leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text"
              />
              {renderWikiLinkBadges(block.content)}
            </div>
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
                onChange={(e) => updateBlock(block.id, { language: e.target.value })}
                className="w-20 bg-transparent text-right font-mono uppercase text-accent-amber focus:outline-none"
              />
            </div>
            <textarea
              aria-label="Code snippet content"
              value={block.content}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              rows={Math.max(3, block.content.split('\n').length)}
              spellCheck={false}
              className="w-full p-3.5 bg-transparent font-mono text-[12.5px] leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text"
            />
          </div>
        )}

        {block.type === 'dbml' && (
          <DBMLStudio
            code={block.content}
            layout={block.dbmlLayout}
            viewMode={block.dbmlViewMode || 'split'}
            wide={block.wide}
            onChange={(updates) => updateBlock(block.id, updates)}
          />
        )}

        {block.type === 'mermaid' && (
          <MermaidStudio
            code={block.content}
            viewMode={block.mermaidViewMode || 'split'}
            onChange={(updates) => updateBlock(block.id, updates)}
          />
        )}

        {block.type === 'graphviz' && (
          <GraphvizStudio
            code={block.content}
            viewMode={block.graphvizViewMode || 'split'}
            engine={block.graphvizEngine}
            onChange={(updates) => updateBlock(block.id, updates)}
          />
        )}

        {(block.type === 'image' || block.type === 'file') && (
          <AssetBlock block={block} />
        )}

        {block.type === 'database' && (
          <ProjectDatabaseBlock
            title={block.databaseTitle || 'PROJECT DATABASE'}
            activeView={block.databaseActiveView || 'gantt'}
            chartType={block.databaseChartType || 'bar'}
            items={block.databaseItems || []}
            onChange={(updates) => updateBlock(block.id, updates)}
          />
        )}

        {/* Slash Command Menu Popover */}
        {slashMenuForBlockId === block.id && (
          <div className="mt-2 p-2 rounded-[10px] bg-surface-elevated border border-border-hairline shadow-popover z-30 max-w-md animate-popover-enter">
            <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 border-b border-border-subtle text-[11px] font-medium text-ink-muted">
              <span>Insert block</span>
              <button
                type="button"
                onClick={() => setSlashMenuForBlockId(null)}
                className="hover:text-ink-primary"
              >
                <Kbd>Esc</Kbd>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-0.5 max-h-64 overflow-y-auto">
              {SLASH_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleSlashInsert(block.id, opt.type, opt.columnCount)}
                  className="px-2.5 py-2 rounded-[7px] hover:bg-surface-hover text-left flex items-center gap-2.5 transition-colors"
                >
                  <div className="w-7 h-7 rounded-[7px] bg-surface-chrome border border-border-hairline flex items-center justify-center shrink-0">
                    {opt.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-ink-primary">{opt.label}</div>
                    <div className="text-[11px] text-ink-secondary truncate">
                      {opt.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-7"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <div className="space-y-3 pb-24">
        {groupBlocks(page.blocks).map((node) =>
          node.kind === 'group' ? (
            <div key={node.header.id} className="group relative">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 mb-1 select-none">
                <Badge tone="neutral" className="font-mono text-[9.5px] uppercase">
                  columns
                </Badge>
                {page.blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(node.header.id)}
                    title="Delete column group"
                    aria-label="Delete column group"
                    className="p-1 rounded-[6px] bg-surface-elevated hover:bg-[var(--pill-red-bg)] border border-border-hairline text-ink-secondary hover:text-[var(--pill-red-text)]"
                  >
                    <Trash2 size={11} aria-hidden="true" />
                  </button>
                )}
              </div>
              <ColumnGroup
                header={node.header}
                widths={node.widths}
                columns={node.columns}
                // ColumnGroup memakai kontrak struktural ColumnBlock; isinya selalu DocumentBlock.
                renderBlock={(block, index) => renderBlockNode(block as DocumentBlock, index)}
                onWidthsChange={(widths) =>
                  updateBlock(node.header.id, { columnWidths: widths })
                }
                onRemoveColumn={(columnIndex) => removeColumnAt(node.header.id, columnIndex)}
                onDropBlock={(blockId, columnIndex) =>
                  moveBlockToColumnAt(node.header.id, blockId, columnIndex)
                }
              />
            </div>
          ) : (
            <React.Fragment key={node.block.id}>{renderBlockNode(node.block)}</React.Fragment>
          )
        )}

        {/* Bottom Quick Insert Bar */}
        <div className="max-w-[760px] mx-auto pt-5 mt-4 border-t border-border-subtle flex flex-wrap items-center gap-2 select-none">
          <span className="text-[11.5px] font-medium text-ink-muted mr-1">
            Add block:
          </span>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'paragraph')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <Type size={12} /> Text
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'dbml')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <Database size={12} className="text-accent-cobalt" /> DBML Studio
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'mermaid')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={12} className="text-accent-teal" /> Mermaid
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'graphviz')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <Network size={12} className="text-accent-violet" /> Graphviz
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'database')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <GanttChart size={12} className="text-accent-amber" /> Database &amp; Board
          </button>
        </div>
      </div>
    </div>
  )
}
