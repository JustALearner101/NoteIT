import React, { useState } from 'react'
import {
  ChevronRight,
  Database,
  GanttChart,
  Minus,
  Network,
  Sparkles,
  Trash2,
  Type
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Badge } from '@renderer/components/ui'
import { createId } from '@renderer/lib/ids'
import { isImageMime } from '@shared/assets'
import { DEFAULT_DOT } from '@renderer/lib/diagrams/graphviz'
import { ColumnGroup } from '@renderer/components/editor-block/ColumnGroup'
import { BlockItem } from '@renderer/components/editor-block/BlockItem'
import { addDays, todayIso } from '@renderer/lib/database/dates'
import {
  createColumnGroup,
  groupBlocks,
  removeColumn,
  resolveColumnDrop
} from '@renderer/lib/columns'
import {
  createDefaultBlock,
  reorderTopLevelBlocks
} from '@renderer/lib/editor-v2'
import type { AssetRecord, BlockType, DocumentBlock, Page } from '@shared/types/domain'

interface BlockEditorProps {
  page: Page
}

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
  const {
    pages,
    sections,
    notebooks,
    activeNotebookId,
    updatePage,
    openPageInTab,
    openCodeInDiffInspector,
    showToast
  } = useWorkspaceStore()

  const activeSection = sections.find((s) => s.id === page.sectionId)
  const activeNotebook =
    notebooks.find((n) => n.id === (activeSection?.notebookId || activeNotebookId)) ||
    notebooks[0]
  const boundRepoPath = activeSection?.repoPathOverride || activeNotebook?.repoPath || ''

  const [slashMenuForBlockId, setSlashMenuForBlockId] = useState<string | null>(null)
  const [slashInitialQuery, setSlashInitialQuery] = useState<string>('')
  const [wikiPickerForBlockId, setWikiPickerForBlockId] = useState<string | null>(null)
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    blockId: string
    position: 'before' | 'after'
  } | null>(null)

  const updateBlock = (blockId: string, patch: Partial<DocumentBlock>): void => {
    const nextBlocks = page.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b))
    updatePage({ id: page.id, blocks: nextBlocks })
  }

  const insertBlockAfter = (afterId: string | null, type: BlockType): void => {
    const newBlock = createDefaultBlock(type, {
      baseDate: todayIso(),
      addDaysFn: addDays,
      defaultDot: DEFAULT_DOT
    })
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

  const insertColumnGroup = (afterId: string, count: number): void => {
    updatePage({
      id: page.id,
      blocks: createColumnGroup(page.blocks, afterId, count)
    })
    setSlashMenuForBlockId(null)
  }

  const moveBlockToColumnAt = (
    groupId: string,
    blockId: string,
    columnIndex: number
  ): void => {
    const nextBlocks = resolveColumnDrop(page.blocks, blockId, groupId, columnIndex)
    if (!nextBlocks) return
    updatePage({ id: page.id, blocks: nextBlocks })
  }

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

  const handleDragOverBlock = (
    event: React.DragEvent<HTMLDivElement>,
    targetBlockId: string
  ): void => {
    if (!draggingBlockId || draggingBlockId === targetBlockId) return
    if (event.dataTransfer?.types?.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    const rect = event.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position: 'before' | 'after' = event.clientY < midY ? 'before' : 'after'
    setDropTarget((prev) =>
      prev?.blockId === targetBlockId && prev.position === position
        ? prev
        : { blockId: targetBlockId, position }
    )
  }

  const handleDropOnBlock = (
    event: React.DragEvent<HTMLDivElement>,
    targetBlockId: string
  ): void => {
    const fromId = draggingBlockId || event.dataTransfer?.getData('text/plain')
    setDropTarget(null)
    setDraggingBlockId(null)
    if (!fromId || fromId === targetBlockId) return
    if (event.dataTransfer?.files?.length) return
    event.preventDefault()

    const rect = event.currentTarget.getBoundingClientRect()
    const position: 'before' | 'after' =
      event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    const reordered = reorderTopLevelBlocks(page.blocks, fromId, targetBlockId, position)
    if (reordered) {
      updatePage({ id: page.id, blocks: reordered })
    }
  }

  const removeBlock = (blockId: string): void => {
    if (page.blocks.length <= 1) return

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

  const renderBlockNode = (block: DocumentBlock): React.ReactNode => (
    <BlockItem
      key={block.id}
      block={block}
      page={page}
      pages={pages}
      boundRepoPath={boundRepoPath}
      canDelete={page.blocks.length > 1}
      isSlashMenuOpen={slashMenuForBlockId === block.id}
      slashInitialQuery={slashMenuForBlockId === block.id ? slashInitialQuery : ''}
      isWikiPickerOpen={wikiPickerForBlockId === block.id}
      isDragging={draggingBlockId === block.id}
      dropIndicator={dropTarget?.blockId === block.id ? dropTarget.position : null}
      onSetDragging={(id) => {
        setDraggingBlockId(id)
        if (!id) setDropTarget(null)
      }}
      onDragOverBlock={handleDragOverBlock}
      onDropOnBlock={handleDropOnBlock}
      onUpdateBlock={updateBlock}
      onMoveBlock={moveBlock}
      onRemoveBlock={removeBlock}
      onOpenSlashMenu={(id, query = '') => {
        setSlashMenuForBlockId(id)
        setSlashInitialQuery(query)
      }}
      onOpenWikiPicker={setWikiPickerForBlockId}
      onSlashInsert={handleSlashInsert}
      onOpenPageInTab={openPageInTab}
      onOpenCodeInDiffInspector={openCodeInDiffInspector}
      onShowToast={showToast}
    />
  )

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
                renderBlock={(block) => renderBlockNode(block)}
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
            <Type size={12} aria-hidden="true" /> Text
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'toggle')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <ChevronRight size={12} className="text-accent-cobalt" aria-hidden="true" /> Toggle
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'divider')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <Minus size={12} aria-hidden="true" /> Divider
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'dbml')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <Database size={12} className="text-accent-cobalt" aria-hidden="true" /> DBML Studio
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'mermaid')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={12} className="text-accent-teal" aria-hidden="true" /> Mermaid
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'graphviz')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <Network size={12} className="text-accent-violet" aria-hidden="true" /> Graphviz
          </button>
          <button
            type="button"
            onClick={() => insertBlockAfter(null, 'database')}
            className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
          >
            <GanttChart size={12} className="text-accent-amber" aria-hidden="true" /> Database &amp; Board
          </button>
        </div>
      </div>
    </div>
  )
}
