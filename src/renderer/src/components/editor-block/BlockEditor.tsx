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
  /** Khusus 'columns': jumlah kolom yang dibuat createColumnGroup. */
  columnCount?: number
}[] = [
  {
    type: 'paragraph',
    label: 'Paragraf Teks',
    desc: 'Blok penulisan standar mendukung [[Wiki-Link]]',
    icon: <Type size={13} className="text-ink-secondary" />
  },
  {
    type: 'h1',
    label: 'Heading 1',
    desc: 'Judul bagian utama (Space Grotesk 32px)',
    icon: <Heading1 size={13} className="text-accent-cobalt" />
  },
  {
    type: 'h2',
    label: 'Heading 2',
    desc: 'Sub-bagian spesifikasi (Space Grotesk 24px)',
    icon: <Heading2 size={13} className="text-accent-cobalt" />
  },
  {
    type: 'h3',
    label: 'Heading 3',
    desc: 'Sub-judul teknis (Space Grotesk 19px)',
    icon: <Heading3 size={13} className="text-accent-cobalt" />
  },
  {
    type: 'columns',
    label: '2 Kolom',
    desc: 'Dua kolom berdampingan dengan divider yang bisa digeser',
    icon: <Columns2 size={13} className="text-marker-teal" />,
    columnCount: 2
  },
  {
    type: 'columns',
    label: '3 Kolom',
    desc: 'Tiga kolom berdampingan untuk perbandingan cepat',
    icon: <Columns3 size={13} className="text-marker-teal" />,
    columnCount: 3
  },
  {
    type: 'checklist',
    label: 'Daftar Periksa (Checklist)',
    desc: 'Item tugas dengan kotak centang interaktif',
    icon: <CheckSquare size={13} className="text-[#10B981]" />
  },
  {
    type: 'callout',
    label: 'Callout Spesifikasi',
    desc: 'Kotak sorotan dengan strip warna Drafting Marker',
    icon: <Info size={13} className="text-accent-amber" />
  },
  {
    type: 'code',
    label: 'Blok Kode Teknis',
    desc: 'Potongan kode monospace (SQL, TypeScript, JSON)',
    icon: <Code2 size={13} className="text-[#8B5CF6]" />
  },
  {
    type: 'dbml',
    label: 'Interactive DBML Studio',
    desc: 'Editor skema DBML + ERD interaktif + SQL DDL Compiler',
    icon: <Database size={13} className="text-accent-cobalt" />
  },
  {
    type: 'mermaid',
    label: 'Diagram Mermaid Offline',
    desc: 'Sequence, Flowchart, atau State Diagram live preview',
    icon: <Sparkles size={13} className="text-[#10B981]" />
  },
  {
    type: 'graphviz',
    label: 'Diagram Graphviz (DOT)',
    desc: 'DOT language dengan engine dot, neato, fdp, circo, twopi',
    icon: <Network size={13} className="text-[#8B5CF6]" />
  },
  {
    type: 'database',
    label: 'Gantt Chart & Project Database',
    desc: 'Tabel multi-view: Gantt Timeline, Kanban, & Data Chart',
    icon: <GanttChart size={13} className="text-accent-amber" />
  },
  {
    type: 'image',
    label: 'Gambar / Screenshot',
    desc: 'Impor PNG, JPG, WebP, atau SVG ke workspace/assets',
    icon: <ImageIcon size={13} className="text-[#10B981]" />
  },
  {
    type: 'file',
    label: 'Berkas Lampiran',
    desc: 'Lampirkan PDF atau berkas lain sebagai kartu berkas',
    icon: <Paperclip size={13} className="text-accent-amber" />
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
                ? `-- Tulis kueri atau kode di sini\nSELECT * FROM pages_fts WHERE pages_fts MATCH 'dbml';`
                : '',
      checked: false,
      calloutColor: 'cobalt',
      calloutTitle: 'CATATAN SPESIFIKASI',
      wide: type === 'dbml' || type === 'mermaid' || type === 'graphviz' || type === 'database',
      dbmlViewMode: 'split',
      mermaidViewMode: 'split',
      graphvizViewMode: 'split',
      graphvizEngine: 'dot',
      databaseTitle: 'JADWAL & METRIK MODUL',
      databaseActiveView: 'gantt',
      databaseChartType: 'bar',
      databaseItems:
        type === 'database'
          ? [
              {
                id: firstTaskId,
                code: 'TSK-01',
                title: 'Rancang Kontrak Data',
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
                title: 'Sign-Off Arsitektur',
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
        console.error('Gagal mengimpor aset:', error)
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
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] text-ink-muted flex items-center gap-1">
          <Link2 size={10} /> TAUTAN HALAMAN:
        </span>
        {matches.map((m, i) => {
          const targetTitle = m[1].trim()
          const targetPage = pages.find(
            (p) => p.title.toLowerCase() === targetTitle.toLowerCase()
          )
          return (
            <button
              key={`${targetTitle}-${i}`}
              onClick={(e) => {
                if (targetPage) openPageInTab(targetPage.id, e.altKey)
              }}
              title={
                targetPage
                  ? `Buka ${targetPage.code}: ${targetPage.title} (Alt+Klik untuk Split-Pane)`
                  : `Halaman '${targetTitle}' belum dibuat`
              }
              className={`px-2 py-0.5 rounded font-mono text-[11px] border flex items-center gap-1 transition-colors ${
                targetPage
                  ? 'bg-accent-cobalt/15 border-accent-cobalt/40 text-accent-cobalt hover:bg-accent-cobalt/25'
                  : 'bg-surface-elevated border-border-hairline text-ink-muted'
              }`}
            >
              <span>{targetPage?.icon || '📄'}</span>
              <span>[[{targetTitle}]]</span>
              {targetPage && (
                <span className="text-[9px] opacity-75">({targetPage.code})</span>
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
        className={`group relative ${isWide ? 'max-w-full' : 'max-w-[780px] mx-auto'}`}
      >
        {/* Hover Block Controls Gutter */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 mb-1 select-none">
          <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-surface-chrome border border-border-hairline text-ink-muted">
            {block.type}
          </span>
          <button
            onClick={() =>
              setWikiPickerForBlockId(
                wikiPickerForBlockId === block.id ? null : block.id
              )
            }
            title="Sisipkan [[Wiki-Link]] ke Halaman Lain"
            className="p-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary hover:text-accent-cobalt"
          >
            <Link2 size={11} />
          </button>
          <button
            onClick={() =>
              setSlashMenuForBlockId(slashMenuForBlockId === block.id ? null : block.id)
            }
            title="Sisipkan Blok di Bawah (/)"
            className="p-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary hover:text-accent-cobalt"
          >
            <Plus size={11} />
          </button>
          <button
            onClick={() => moveBlock(block.id, -1)}
            title="Pindah ke Atas"
            className="p-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary"
          >
            <ArrowUp size={11} />
          </button>
          <button
            onClick={() => moveBlock(block.id, 1)}
            title="Pindah ke Bawah"
            className="p-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary"
          >
            <ArrowDown size={11} />
          </button>
          {page.blocks.length > 1 && (
            <button
              onClick={() => removeBlock(block.id)}
              title="Hapus Blok"
              className="p-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary hover:text-[#EF4444]"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>

        {/* Wiki-Link Quick Picker Popup */}
        {wikiPickerForBlockId === block.id && (
          <div className="mb-2 p-2 rounded-[6px] bg-surface-elevated border border-accent-cobalt shadow-lg z-20">
            <div className="font-mono text-[10px] text-accent-cobalt uppercase mb-1.5">
              PILIH HALAMAN UNTUK DITAUTKAN ([[WIKI-LINK]]):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pages
                .filter((p) => p.id !== page.id)
                .map((target) => (
                  <button
                    key={target.id}
                    onClick={() => {
                      updateBlock(block.id, {
                        content: `${block.content} [[${target.title}]]`
                      })
                      setWikiPickerForBlockId(null)
                    }}
                    className="px-2 py-1 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5"
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
            value={block.content}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            placeholder="Heading 1..."
            className="w-full bg-transparent font-display font-bold text-2xl text-ink-primary focus:outline-none border-b border-border-subtle pb-1"
          />
        )}

        {block.type === 'h2' && (
          <input
            type="text"
            value={block.content}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            placeholder="Heading 2..."
            className="w-full bg-transparent font-display font-semibold text-xl text-ink-primary focus:outline-none mt-2"
          />
        )}

        {block.type === 'h3' && (
          <input
            type="text"
            value={block.content}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            placeholder="Heading 3..."
            className="w-full bg-transparent font-display font-semibold text-base text-ink-primary focus:outline-none mt-1"
          />
        )}

        {block.type === 'paragraph' && (
          <div>
            <textarea
              value={block.content}
              onChange={(e) => {
                const val = e.target.value
                updateBlock(block.id, { content: val })
                if (val.endsWith('/')) {
                  setSlashMenuForBlockId(block.id)
                }
              }}
              rows={Math.max(2, Math.ceil(block.content.length / 85))}
              placeholder="Ketik catatan atau tekan '/' untuk menyisipkan blok DBML, Mermaid, atau Gantt Chart..."
              className="w-full bg-transparent text-[15px] leading-[1.65] text-ink-primary resize-none focus:outline-none selectable-text"
            />
            {renderWikiLinkBadges(block.content)}
          </div>
        )}

        {block.type === 'checklist' && (
          <div className="flex items-start gap-2.5 py-0.5">
            <input
              type="checkbox"
              checked={Boolean(block.checked)}
              onChange={(e) => updateBlock(block.id, { checked: e.target.checked })}
              className="mt-1.5 w-4 h-4 accent-[#3B82F6] rounded cursor-pointer"
            />
            <div className="flex-1">
              <input
                type="text"
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                placeholder="Item daftar periksa..."
                className={`w-full bg-transparent text-[15px] focus:outline-none ${
                  block.checked ? 'line-through text-ink-muted' : 'text-ink-primary'
                }`}
              />
              {renderWikiLinkBadges(block.content)}
            </div>
          </div>
        )}

        {block.type === 'callout' && (
          <div className="p-3.5 rounded-[6px] bg-surface-elevated border border-border-hairline flex gap-3">
            <div
              className={`w-1 rounded-full shrink-0 ${
                MARKER_META[block.calloutColor || 'cobalt'].bgStrip
              }`}
            />
            <div className="flex-1 space-y-1">
              <input
                type="text"
                value={block.calloutTitle || 'SPESIFIKASI TEKNIS'}
                onChange={(e) => updateBlock(block.id, { calloutTitle: e.target.value })}
                className="w-full bg-transparent font-mono text-[11px] font-semibold tracking-wider uppercase text-accent-cobalt focus:outline-none"
              />
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                rows={Math.max(2, Math.ceil(block.content.length / 80))}
                className="w-full bg-transparent text-sm leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text"
              />
              {renderWikiLinkBadges(block.content)}
            </div>
          </div>
        )}

        {block.type === 'code' && (
          <div className="rounded-[6px] bg-surface-chrome border border-border-hairline overflow-hidden">
            <div className="px-3 py-1 bg-surface-elevated border-b border-border-hairline flex items-center justify-between font-mono text-[10px] text-ink-muted">
              <span>CODE SNIPPET</span>
              <input
                type="text"
                value={block.language || 'sql'}
                onChange={(e) => updateBlock(block.id, { language: e.target.value })}
                className="w-20 bg-transparent text-right uppercase text-accent-amber focus:outline-none"
              />
            </div>
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              rows={Math.max(3, block.content.split('\n').length)}
              spellCheck={false}
              className="w-full p-3 bg-transparent font-mono text-xs leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text"
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
          <div className="mt-2 p-2 rounded-[8px] bg-surface-elevated border border-border-hairline shadow-2xl z-30 max-w-md">
            <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-border-subtle font-mono text-[10px] text-ink-muted">
              <span>SISIPKAN BLOK WORKBENCH (/)</span>
              <button
                onClick={() => setSlashMenuForBlockId(null)}
                className="hover:text-ink-primary"
              >
                ESC
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1 max-h-64 overflow-y-auto">
              {SLASH_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleSlashInsert(block.id, opt.type, opt.columnCount)}
                  className="px-2.5 py-1.5 rounded-[5px] hover:bg-surface-hover text-left flex items-center gap-2.5 transition-colors"
                >
                  <div className="w-6 h-6 rounded bg-surface-chrome border border-border-hairline flex items-center justify-center shrink-0">
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
      className="flex-1 overflow-y-auto px-6 py-6"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <div className="space-y-2.5 pb-20">
        {groupBlocks(page.blocks).map((node) =>
          node.kind === 'group' ? (
            <div key={node.header.id} className="group relative">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 mb-1 select-none">
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-surface-chrome border border-border-hairline text-ink-muted">
                  columns
                </span>
                {page.blocks.length > 1 && (
                  <button
                    onClick={() => removeBlock(node.header.id)}
                    title="Hapus Grup Kolom"
                    className="p-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary hover:text-[#EF4444]"
                  >
                    <Trash2 size={11} />
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
              />
            </div>
          ) : (
            <React.Fragment key={node.block.id}>{renderBlockNode(node.block)}</React.Fragment>
          )
        )}

        {/* Bottom Quick Insert Bar */}
        <div className="max-w-[780px] mx-auto pt-4 border-t border-dashed border-border-hairline flex flex-wrap items-center gap-2 select-none">
          <span className="font-mono text-[10px] text-ink-muted uppercase mr-1">
            + TAMBAH BLOK CEPAT:
          </span>
          <button
            onClick={() => insertBlockAfter(null, 'paragraph')}
            className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline font-mono text-[11px] text-ink-secondary hover:text-ink-primary flex items-center gap-1"
          >
            <Type size={11} /> Teks
          </button>
          <button
            onClick={() => insertBlockAfter(null, 'dbml')}
            className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline font-mono text-[11px] text-accent-cobalt flex items-center gap-1"
          >
            <Database size={11} /> + DBML Studio
          </button>
          <button
            onClick={() => insertBlockAfter(null, 'mermaid')}
            className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline font-mono text-[11px] text-[#10B981] flex items-center gap-1"
          >
            <Sparkles size={11} /> + Diagram Mermaid
          </button>
          <button
            onClick={() => insertBlockAfter(null, 'graphviz')}
            className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline font-mono text-[11px] text-[#8B5CF6] flex items-center gap-1"
          >
            <Network size={11} /> + Graphviz DOT
          </button>
          <button
            onClick={() => insertBlockAfter(null, 'database')}
            className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline font-mono text-[11px] text-accent-amber flex items-center gap-1"
          >
            <GanttChart size={11} /> + Gantt & Chart
          </button>
        </div>
      </div>
    </div>
  )
}
