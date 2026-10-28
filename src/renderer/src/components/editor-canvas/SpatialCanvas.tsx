import React, { useCallback, useMemo } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
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
  Plus,
  StickyNote,
  Trash2
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_COLORS, MARKER_META } from '@renderer/lib/marker-colors'
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
  data: SpatialCanvasNodeData & {
    onUpdateNode: (id: string, patch: Partial<SpatialCanvasNodeData>) => void
    onDeleteNode: (id: string) => void
  }
}

const WorkCardNodeComponent: React.FC<WorkCardCustomNodeProps> = ({ id, data }) => {
  const marker = MARKER_META[data.color || 'cobalt']

  return (
    <div
      className={`w-[290px] rounded-[7px] border shadow-xl transition-all ${
        data.cardType === 'sticky'
          ? 'bg-accent-amber/15 border-accent-amber/50'
          : 'bg-surface-elevated border-border-hairline'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#3B82F6] !border-2 !border-[#111317]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#F59E0B] !border-2 !border-[#111317]"
      />

      {/* Top Precision Handle Bar */}
      <div className="h-7 px-2.5 bg-surface-chrome/90 border-b border-border-hairline rounded-t-[7px] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-3.5 rounded-[2px] ${marker.bgStrip}`} />
          <span className="font-mono text-[10px] text-ink-muted uppercase">
            {data.code || data.cardType.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1 nodrag">
          {MARKER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => data.onUpdateNode(id, { color: c })}
              className={`w-2.5 h-2.5 rounded-full ${MARKER_META[c].bgStrip} ${
                data.color === c ? 'ring-1 ring-white' : 'opacity-45 hover:opacity-100'
              }`}
            />
          ))}
          <button
            onClick={() => data.onDeleteNode(id)}
            className="ml-1 text-ink-muted hover:text-[#EF4444]"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3 space-y-2 nodrag">
        <input
          type="text"
          value={data.title}
          onChange={(e) => data.onUpdateNode(id, { title: e.target.value })}
          className="w-full bg-transparent font-display font-semibold text-sm text-ink-primary focus:outline-none border-b border-transparent focus:border-accent-cobalt"
        />

        {data.cardType === 'metric' && (
          <div className="p-2 rounded bg-surface-chrome border border-border-subtle flex items-baseline justify-between font-mono">
            <span className="text-lg font-bold text-accent-amber tabular-nums">
              {data.metricValue || '99.9%'}
            </span>
            <span className="text-[10px] text-ink-secondary">
              {data.metricDelta || 'TELEMETRY'}
            </span>
          </div>
        )}

        <textarea
          value={data.content}
          onChange={(e) => data.onUpdateNode(id, { content: e.target.value })}
          rows={3}
          className="w-full bg-transparent text-xs leading-relaxed text-ink-secondary resize-none focus:outline-none selectable-text"
        />
      </div>
    </div>
  )
}

const nodeTypes = {
  workCard: WorkCardNodeComponent
}

export const SpatialCanvas: React.FC<SpatialCanvasProps> = ({ page }) => {
  const { updatePage, setTelemetry } = useWorkspaceStore()

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
    return (page.canvasData?.nodes || []).map((n) => ({
      id: n.id,
      type: 'workCard',
      position: n.position,
      data: {
        ...n.data,
        onUpdateNode: handleUpdateNodeData,
        onDeleteNode: handleDeleteNode
      }
    }))
  }, [page.canvasData?.nodes, handleUpdateNodeData, handleDeleteNode])

  const flowEdges: Edge[] = useMemo(() => {
    return (page.canvasData?.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.animated ?? true,
      style: {
        stroke: MARKER_META[e.color || 'cobalt'].hex,
        strokeWidth: 1.8
      },
      labelStyle: {
        fill: '#ECEEF2',
        fontFamily: 'JetBrains Mono',
        fontSize: 10
      },
      labelBgStyle: {
        fill: '#181B22',
        stroke: '#262A34'
      }
    }))
  }, [page.canvasData?.edges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, flowNodes)
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
          id: `edge-${Date.now()}`,
          label: 'RELASI',
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
            label: typeof e.label === 'string' ? e.label : 'RELASI',
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
      id: `node-${Date.now()}`,
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
      className="flex-1 h-full relative bg-blueprint-grid select-none"
    >
      {/* Top Floating Spatial Drafting Toolbar */}
      <div className="absolute top-3 left-4 z-20 flex items-center gap-1.5 p-1.5 rounded-[7px] bg-surface-elevated/95 border border-border-hairline shadow-xl font-mono text-[11px]">
        <span className="px-2 text-[10px] text-accent-amber font-semibold uppercase">
          ⊞ SPATIAL WORKBENCH:
        </span>
        <button
          onClick={() => addCanvasCard('note', 'cobalt')}
          className="px-2.5 py-1 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-ink-primary flex items-center gap-1.5"
        >
          <FileText size={12} className="text-accent-cobalt" />
          <span>+ Kartu Catatan</span>
        </button>
        <button
          onClick={() => addCanvasCard('sticky', 'amber')}
          className="px-2.5 py-1 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-ink-primary flex items-center gap-1.5"
        >
          <StickyNote size={12} className="text-accent-amber" />
          <span>+ Sticky Memo</span>
        </button>
        <button
          onClick={() => addCanvasCard('dbml', 'violet')}
          className="px-2.5 py-1 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-ink-primary flex items-center gap-1.5"
        >
          <Database size={12} className="text-[#8B5CF6]" />
          <span>+ Node Modul DB</span>
        </button>
        <button
          onClick={() => addCanvasCard('metric', 'teal')}
          className="px-2.5 py-1 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-ink-primary flex items-center gap-1.5"
        >
          <Activity size={12} className="text-[#10B981]" />
          <span>+ Kartu Metrik</span>
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
          gap={24}
          size={1.2}
          color="var(--text-muted)"
        />
        <Controls className="!bg-surface-elevated !border-border-hairline !text-ink-primary" />
      </ReactFlow>
    </div>
  )
}
