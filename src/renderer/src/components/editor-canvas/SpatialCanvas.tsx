import React, { useCallback, useMemo, useState } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  applyNodeChanges
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Activity,
  Database,
  FileText,
  Maximize2,
  Minus,
  Plus,
  Sparkles,
  StickyNote,
  Trash2
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_COLORS, MARKER_META } from '@renderer/lib/marker-colors'
import { createId } from '@renderer/lib/ids'
import { cn } from '@renderer/components/ui'
import type {
  MarkerColor,
  Page,
  SpatialCanvasNode,
  SpatialCanvasNodeData
} from '@shared/types/domain'

interface SpatialCanvasProps {
  page: Page
}

interface WorkCardCustomNodeProps {
  id: string
  selected?: boolean
  data: SpatialCanvasNodeData & {
    onUpdateNode: (id: string, patch: Partial<SpatialCanvasNodeData>) => void
    onDeleteNode: (id: string) => void
  }
}

const CARD_TYPE_META: Record<
  SpatialCanvasNodeData['cardType'],
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  note: { label: 'SPEC NOTE', icon: FileText },
  sticky: { label: 'MEMO', icon: StickyNote },
  dbml: { label: 'DATA NODE', icon: Database },
  mermaid: { label: 'DIAGRAM', icon: Sparkles },
  metric: { label: 'METRIC', icon: Activity }
}

const WorkCardNodeComponent: React.FC<WorkCardCustomNodeProps> = ({ id, selected, data }) => {
  const marker = MARKER_META[data.color || 'cobalt']
  const typeMeta = CARD_TYPE_META[data.cardType || 'note'] || CARD_TYPE_META.note
  const TypeIcon = typeMeta.icon

  return (
    <div className="relative group">
      {/* Floating Quick-Action Pill Toolbar above Selected Node (mirrors Reference Image 3) */}
      {selected && (
        <div className="nodrag absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] bg-surface-elevated border border-border-hairline shadow-popover animate-popover-enter">
          {MARKER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={MARKER_META[c].label}
              onClick={() => data.onUpdateNode(id, { color: c })}
              className={cn(
                'w-3 h-3 rounded-full transition-transform',
                MARKER_META[c].dotBg,
                data.color === c
                  ? 'ring-2 ring-ink-primary scale-110'
                  : 'opacity-50 hover:opacity-100'
              )}
            />
          ))}
          <span className="h-3.5 w-[1px] bg-border-hairline mx-0.5" />
          <button
            type="button"
            onClick={() => data.onDeleteNode(id)}
            title="Hapus Node"
            className="p-0.5 rounded-[5px] text-ink-muted hover:text-accent-rose hover:bg-[var(--pill-red-bg)] transition-colors"
          >
            <Trash2 size={12.5} />
          </button>
        </div>
      )}

      {/* Node Card Shell (mirrors Reference Image 3 rounded-[12px] matte node & selected indigo glow) */}
      <div
        className={cn(
          'w-[288px] rounded-[12px] border transition-all duration-150',
          selected
            ? 'bg-[var(--node-selected-bg)] border-[var(--node-selected-border)] shadow-node-selected'
            : data.cardType === 'sticky'
              ? 'bg-surface-elevated border-[var(--pill-amber-border)] shadow-card hover:border-accent-amber'
              : 'bg-surface-elevated border-border-hairline shadow-card hover:border-border-strong'
        )}
      >
        {/* Left & Right Connector Handles (luminous Periwinkle on select, subtle zinc otherwise) */}
        <Handle
          type="target"
          position={Position.Left}
          className={cn(
            '!transition-all !duration-150',
            selected
              ? '!w-3.5 !h-3.5 !bg-accent-cobalt !border-2 !border-[var(--node-selected-bg)] !shadow-[0_0_0_3px_rgba(110,123,242,0.28)]'
              : '!w-2.5 !h-2.5 !bg-surface-hover !border !border-border-strong hover:!bg-accent-cobalt hover:!border-accent-cobalt'
          )}
        />
        <Handle
          type="source"
          position={Position.Right}
          className={cn(
            '!transition-all !duration-150',
            selected
              ? '!w-3.5 !h-3.5 !bg-accent-cobalt !border-2 !border-[var(--node-selected-bg)] !shadow-[0_0_0_3px_rgba(110,123,242,0.28)]'
              : '!w-2.5 !h-2.5 !bg-surface-hover !border !border-border-strong hover:!bg-accent-cobalt hover:!border-accent-cobalt'
          )}
        />

        {/* Card Content */}
        <div className="p-3.5 space-y-2.5">
          {/* Header: Icon Tile + Uppercase Micro Type Eyebrow + Crisp Editable Title */}
          <div className="flex items-start gap-2.5">
            <div
              className={cn(
                'w-7 h-7 rounded-[7px] border flex items-center justify-center shrink-0 mt-0.5',
                marker.badgeBg
              )}
            >
              <TypeIcon size={13.5} />
            </div>

            <div className="min-w-0 flex-1 nodrag">
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted leading-none mb-1">
                {typeMeta.label}
              </div>
              <input
                type="text"
                value={data.title}
                onChange={(e) => data.onUpdateNode(id, { title: e.target.value })}
                className="w-full bg-transparent font-display font-semibold text-[13.5px] leading-snug text-ink-primary focus:outline-none border-b border-transparent focus:border-accent-cobalt"
              />
            </div>
          </div>

          {/* Optional Metric Telemetry Box */}
          {data.cardType === 'metric' && (
            <div className="nodrag px-3 py-2 rounded-[8px] bg-surface-chrome/90 border border-border-subtle flex items-baseline justify-between font-mono">
              <span className="text-lg font-bold text-accent-amber tabular-nums">
                {data.metricValue || '99.9%'}
              </span>
              <span className="text-[10px] text-ink-muted uppercase tracking-wider">
                {data.metricDelta || 'SLA'}
              </span>
            </div>
          )}

          {/* Description Body */}
          <textarea
            value={data.content}
            onChange={(e) => data.onUpdateNode(id, { content: e.target.value })}
            rows={2}
            className="nodrag w-full bg-transparent text-[12px] leading-relaxed text-ink-secondary resize-none focus:outline-none selectable-text"
          />

          {/* Bottom Recessed Pill Footer (mirrors Image 3 "1 output" pill + utility dot) */}
          <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-2">
            <span className="px-2 py-[3px] rounded-[6px] bg-surface-chrome/90 border border-border-hairline font-mono text-[10px] text-ink-secondary tabular-nums">
              {data.code || 'NODE'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', marker.dotBg)} />
              {!selected && (
                <button
                  type="button"
                  onClick={() => data.onDeleteNode(id)}
                  title="Hapus Node"
                  className="nodrag opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-muted hover:text-accent-rose transition-opacity"
                >
                  <Trash2 size={11.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Floating bottom-right zoom pill inside ReactFlow (mirrors Reference Image 3: - 90% + Fit) */
const CanvasZoomPill: React.FC = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { zoom } = useViewport()

  return (
    <div className="absolute right-4 bottom-4 z-20 flex items-center gap-0.5 p-1 rounded-[9px] bg-surface-elevated/95 border border-border-hairline shadow-popover select-none">
      <button
        type="button"
        onClick={() => void zoomOut({ duration: 150 })}
        title="Zoom out"
        className="h-6 w-6 rounded-[6px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
      >
        <Minus size={12} />
      </button>
      <span className="px-2 font-mono text-[11px] text-ink-primary tabular-nums min-w-[44px] text-center">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={() => void zoomIn({ duration: 150 })}
        title="Zoom in"
        className="h-6 w-6 rounded-[6px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
      >
        <Plus size={12} />
      </button>
      <span className="h-3.5 w-[1px] bg-border-hairline mx-0.5" />
      <button
        type="button"
        onClick={() => void fitView({ duration: 200, padding: 0.2 })}
        title="Fit canvas view"
        className="h-6 w-6 rounded-[6px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
      >
        <Maximize2 size={11.5} />
      </button>
    </div>
  )
}

const nodeTypes = {
  workCard: WorkCardNodeComponent
}

interface NodeUiState {
  measured?: { width?: number; height?: number }
  selected?: boolean
  dragging?: boolean
}

export const SpatialCanvas: React.FC<SpatialCanvasProps> = ({ page }) => {
  const { updatePage, setTelemetry } = useWorkspaceStore()
  const [nodeUiState, setNodeUiState] = useState<Record<string, NodeUiState>>({})

  const handleUpdateNodeData = useCallback(
    (nodeId: string, patch: Partial<SpatialCanvasNodeData>) => {
      const nextNodes = (page.canvasData?.nodes || []).map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
      )
      updatePage({
        id: page.id,
        canvasData: {
          ...page.canvasData,
          nodes: nextNodes
        }
      })
    },
    [page, updatePage]
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const nextNodes = (page.canvasData?.nodes || []).filter((n) => n.id !== nodeId)
      const nextEdges = (page.canvasData?.edges || []).filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      )
      setNodeUiState((prev) => {
        if (!(nodeId in prev)) return prev
        const next = { ...prev }
        delete next[nodeId]
        return next
      })
      updatePage({
        id: page.id,
        canvasData: {
          ...page.canvasData,
          nodes: nextNodes,
          edges: nextEdges
        }
      })
    },
    [page, updatePage]
  )

  const flowNodes: Node[] = useMemo(() => {
    return (page.canvasData?.nodes || []).map((n) => {
      const ui = nodeUiState[n.id]
      return {
        id: n.id,
        type: 'workCard',
        position: n.position,
        measured: ui?.measured,
        selected: ui?.selected ?? false,
        dragging: ui?.dragging ?? false,
        data: {
          ...n.data,
          onUpdateNode: handleUpdateNodeData,
          onDeleteNode: handleDeleteNode
        }
      }
    })
  }, [page.canvasData?.nodes, nodeUiState, handleUpdateNodeData, handleDeleteNode])

  const selectedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [id, ui] of Object.entries(nodeUiState)) {
      if (ui.selected) ids.add(id)
    }
    return ids
  }, [nodeUiState])

  const flowEdges: Edge[] = useMemo(() => {
    return (page.canvasData?.edges || []).map((e) => {
      const isHighlighted = selectedNodeIds.has(e.source) || selectedNodeIds.has(e.target)
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'default',
        label: e.label,
        animated: isHighlighted || (e.animated ?? false),
        style: {
          stroke: isHighlighted ? 'var(--accent-cobalt)' : 'var(--border-strong)',
          strokeWidth: isHighlighted ? 2 : 1.5
        },
        labelStyle: {
          fill: isHighlighted ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontFamily: 'Inter, sans-serif',
          fontSize: 10,
          fontWeight: 500
        },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 5,
        labelBgStyle: {
          fill: 'var(--bg-surface-elevated)',
          stroke: isHighlighted ? 'var(--accent-cobalt)' : 'var(--border-hairline)'
        }
      }
    })
  }, [page.canvasData?.edges, selectedNodeIds])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, flowNodes)

      // Preserve ReactFlow v12 UI-only layout state (measured dimensions, selection, dragging)
      // so nodes remain visible after ResizeObserver measurement and selection stays reactive.
      setNodeUiState((prev) => {
        let changed = false
        const next: Record<string, NodeUiState> = { ...prev }
        const presentIds = new Set<string>()
        for (const u of updated) {
          presentIds.add(u.id)
          const cur = prev[u.id]
          const nextMeasured = u.measured
          const nextSelected = Boolean(u.selected)
          const nextDragging = Boolean(u.dragging)
          if (
            !cur ||
            cur.measured?.width !== nextMeasured?.width ||
            cur.measured?.height !== nextMeasured?.height ||
            Boolean(cur.selected) !== nextSelected ||
            Boolean(cur.dragging) !== nextDragging
          ) {
            next[u.id] = {
              measured: nextMeasured,
              selected: nextSelected,
              dragging: nextDragging
            }
            changed = true
          }
        }
        for (const id of Object.keys(prev)) {
          if (!presentIds.has(id)) {
            delete next[id]
            changed = true
          }
        }
        return changed ? next : prev
      })

      const hasDomainChange = changes.some(
        (c) => c.type === 'position' || c.type === 'remove' || c.type === 'add' || c.type === 'replace'
      )
      if (!hasDomainChange) return

      const domainNodes: SpatialCanvasNode[] = updated.map((u) => {
        const orig = page.canvasData.nodes.find((o) => o.id === u.id)
        return {
          id: u.id,
          type: 'workCard',
          position: {
            x: Math.round(u.position.x / 12) * 12,
            y: Math.round(u.position.y / 12) * 12
          },
          data: orig?.data || (u.data as unknown as SpatialCanvasNodeData)
        }
      })

      updatePage({
        id: page.id,
        canvasData: {
          ...page.canvasData,
          nodes: domainNodes
        }
      })
    },
    [flowNodes, page, updatePage]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const newEdges = addEdge(
        {
          ...connection,
          id: createId('edge'),
          label: 'Relasi',
          animated: true
        },
        flowEdges
      )

      updatePage({
        id: page.id,
        canvasData: {
          ...page.canvasData,
          edges: newEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: typeof e.label === 'string' ? e.label : 'Relasi',
            animated: true,
            color: 'cobalt'
          }))
        }
      })
    },
    [flowEdges, page, updatePage]
  )

  const addCanvasCard = (
    cardType: SpatialCanvasNodeData['cardType'],
    color: MarkerColor
  ): void => {
    const count = (page.canvasData?.nodes || []).length + 1
    const newNode: SpatialCanvasNode = {
      id: createId('cn'),
      type: 'workCard',
      position: {
        x: 120 + ((count * 60) % 420),
        y: 100 + ((count * 50) % 260)
      },
      data: {
        title:
          cardType === 'sticky'
            ? 'Memo Arsitektur'
            : cardType === 'metric'
              ? 'Target SLA Sistem'
              : cardType === 'dbml'
                ? 'Modul Tabel Skema'
                : 'Kartu Spesifikasi Baru',
        content:
          'Tarik titik port di sisi kiri/kanan kartu untuk menghubungkan node secara visual.',
        color,
        cardType,
        code: `NODE-${String(count).padStart(2, '0')}`,
        metricValue: cardType === 'metric' ? '< 5.0 ms' : undefined,
        metricDelta: cardType === 'metric' ? 'LATENCY TARGET' : undefined
      }
    }

    updatePage({
      id: page.id,
      canvasData: {
        ...page.canvasData,
        nodes: [...(page.canvasData?.nodes || []), newNode]
      }
    })
  }

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setTelemetry({
          cursorX: e.clientX - rect.left,
          cursorY: e.clientY - rect.top
        })
      }}
      className="flex-1 h-full relative bg-canvas-primary select-none"
    >
      {/* Left Floating Vertical Tool Dock (mirrors Reference Image 3 left dock) */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 p-1.5 rounded-[10px] bg-surface-elevated/95 border border-border-hairline shadow-popover">
        <button
          type="button"
          onClick={() => addCanvasCard('note', 'cobalt')}
          title="Tambah Kartu Catatan"
          className="w-8 h-8 rounded-[7px] hover:bg-surface-hover text-ink-secondary hover:text-accent-cobalt flex items-center justify-center transition-colors"
        >
          <FileText size={15} />
        </button>
        <button
          type="button"
          onClick={() => addCanvasCard('sticky', 'amber')}
          title="Tambah Sticky Memo"
          className="w-8 h-8 rounded-[7px] hover:bg-surface-hover text-ink-secondary hover:text-accent-amber flex items-center justify-center transition-colors"
        >
          <StickyNote size={15} />
        </button>
        <button
          type="button"
          onClick={() => addCanvasCard('dbml', 'violet')}
          title="Tambah Node Modul DB"
          className="w-8 h-8 rounded-[7px] hover:bg-surface-hover text-ink-secondary hover:text-accent-violet flex items-center justify-center transition-colors"
        >
          <Database size={15} />
        </button>
        <button
          type="button"
          onClick={() => addCanvasCard('metric', 'teal')}
          title="Tambah Kartu Metrik"
          className="w-8 h-8 rounded-[7px] hover:bg-surface-hover text-ink-secondary hover:text-accent-teal flex items-center justify-center transition-colors"
        >
          <Activity size={15} />
        </button>
      </div>

      {/* Bottom-Center Floating Action Pill Bar (mirrors Reference Image 3: + Ask AI | + Node) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 rounded-[11px] bg-surface-elevated/95 border border-border-hairline shadow-popover">
        <button
          type="button"
          onClick={() => addCanvasCard('note', 'cobalt')}
          className="h-7 px-3 rounded-[7px] btn-primary-sheen text-xs font-medium flex items-center gap-1.5 transition-all"
        >
          <Plus size={13} />
          <span>Add Note</span>
        </button>
        <button
          type="button"
          onClick={() => addCanvasCard('sticky', 'amber')}
          className="h-7 px-2.5 rounded-[7px] bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-primary flex items-center gap-1.5 transition-colors"
        >
          <StickyNote size={12.5} className="text-accent-amber" />
          <span>Memo</span>
        </button>
        <button
          type="button"
          onClick={() => addCanvasCard('dbml', 'violet')}
          className="h-7 px-2.5 rounded-[7px] bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-primary flex items-center gap-1.5 transition-colors"
        >
          <Database size={12.5} className="text-accent-violet" />
          <span>DB Node</span>
        </button>
        <button
          type="button"
          onClick={() => addCanvasCard('metric', 'teal')}
          className="h-7 px-2.5 rounded-[7px] bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-primary flex items-center gap-1.5 transition-colors"
        >
          <Activity size={12.5} className="text-accent-teal" />
          <span>Metric</span>
        </button>
      </div>

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onMove={(_e, viewport) => {
          setTelemetry({ zoomPercent: viewport.zoom * 100 })
        }}
        fitView
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          color="var(--grid-dot)"
        />
        <MiniMap
          position="bottom-right"
          style={{ marginBottom: 48, marginRight: 16, width: 148, height: 88 }}
          nodeColor={(node) =>
            node.selected ? 'var(--accent-cobalt)' : 'var(--border-strong)'
          }
          nodeStrokeColor={(node) =>
            node.selected ? 'var(--accent-cobalt)' : 'var(--border-hairline)'
          }
          nodeStrokeWidth={2}
          nodeBorderRadius={4}
          pannable
          zoomable
        />
        <CanvasZoomPill />
      </ReactFlow>
    </div>
  )
}
