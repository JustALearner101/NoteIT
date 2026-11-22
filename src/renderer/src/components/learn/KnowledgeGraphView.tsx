import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  applyNodeChanges
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FileText, Network, Sparkles, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Badge, Button } from '@renderer/components/ui'
import type { KgProposition, KgSnapshot } from '@shared/types/domain'

interface KnowledgeGraphViewProps {
  onOpenSession?: (sessionId: string) => void
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({ onOpenSession }) => {
  const { pages, openPageInTab, setActiveMainView, showToast } = useWorkspaceStore()
  const [snapshot, setSnapshot] = useState<KgSnapshot>({ propositions: [], chains: [] })
  const [nodes, setNodes] = useState<Node[]>([])
  const [domainFilter, setDomainFilter] = useState<string>('ALL')
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null)
  const [extractPageId, setExtractPageId] = useState<string>('')
  const [isExtracting, setIsExtracting] = useState(false)

  const refreshGraph = useCallback(async () => {
    try {
      const snap = await window.noteitAPI.getKnowledgeGraph()
      setSnapshot(snap)
    } catch {
      // ignore in test env
    }
  }, [])

  useEffect(() => {
    void refreshGraph()
  }, [refreshGraph])

  const domains = useMemo(() => {
    const set = new Set<string>()
    for (const p of snapshot.propositions) set.add(p.domainTag || 'General')
    return ['ALL', ...Array.from(set).sort()]
  }, [snapshot.propositions])

  const filteredPropositions = useMemo(() => {
    if (domainFilter === 'ALL') return snapshot.propositions
    return snapshot.propositions.filter((p) => (p.domainTag || 'General') === domainFilter)
  }, [snapshot.propositions, domainFilter])

  useEffect(() => {
    setNodes(
      filteredPropositions.map((p) => ({
        id: p.id,
        position: { x: p.posX, y: p.posY },
        data: {
          label: (
            <div className="text-left space-y-1 max-w-[260px]">
              <div className="text-[10px] font-mono uppercase text-accent-teal">{p.domainTag}</div>
              <div className="text-xs text-ink-primary leading-snug">{p.statement}</div>
            </div>
          )
        },
        style: {
          background: 'var(--bg-surface-elevated, #1C1C21)',
          border:
            p.id === selectedPropId
              ? '1.5px solid var(--accent-cobalt, #7A86F8)'
              : '1px solid var(--border-hairline, #27272E)',
          borderRadius: 10,
          padding: '10px 12px',
          color: 'var(--text-primary, #EDEDEF)',
          width: 280
        }
      }))
    )
  }, [filteredPropositions, selectedPropId])

  const edges = useMemo<Edge[]>(() => {
    const visibleIds = new Set(filteredPropositions.map((p) => p.id))
    const list: Edge[] = []
    for (const ch of snapshot.chains) {
      if (!visibleIds.has(ch.conclusionId)) continue
      for (const pid of ch.premiseIds) {
        if (!visibleIds.has(pid)) continue
        list.push({
          id: `${ch.id}-${pid}-${ch.conclusionId}`,
          source: pid,
          target: ch.conclusionId,
          label: ch.relationLabel,
          animated: true,
          style: { stroke: 'var(--accent-cobalt, #7A86F8)', strokeWidth: 1.5 },
          labelStyle: { fill: 'var(--text-secondary, #A8A8B6)', fontSize: 10 }
        })
      }
    }
    return list
  }, [snapshot.chains, filteredPropositions])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }, [])

  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    void window.noteitAPI.updateKgNodePosition({
      id: node.id,
      x: Math.round(node.position.x),
      y: Math.round(node.position.y)
    })
  }, [])

  const selectedProp: KgProposition | undefined = snapshot.propositions.find(
    (p) => p.id === selectedPropId
  )

  const handleExtractFromPage = async (): Promise<void> => {
    const targetId = extractPageId || pages[0]?.id
    if (!targetId) return
    setIsExtracting(true)
    try {
      const res = await window.noteitAPI.extractKnowledgeGraph({ pageId: targetId })
      setSnapshot(res.snapshot)
      showToast(
        `Extracted ${res.addedPropositions} new proposition(s) & ${res.addedChains} reasoning chain(s)`
      )
    } finally {
      setIsExtracting(false)
    }
  }

  const handleDeleteProp = async (id: string): Promise<void> => {
    await window.noteitAPI.deleteKgProposition(id)
    setSelectedPropId(null)
    await refreshGraph()
    showToast('Proposition removed from Knowledge Graph')
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-canvas-primary">
      {/* Toolbar */}
      <div className="px-4 py-2 bg-surface-chrome border-b border-border-hairline flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-accent-teal" aria-hidden="true" />
          <span className="text-xs font-semibold text-ink-primary">
            Propositional Knowledge Graph
          </span>
          <Badge tone="teal" size="sm">
            {snapshot.propositions.length} propositions · {snapshot.chains.length} chains
          </Badge>

          <select
            aria-label="Filter by domain"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="h-7 px-2 rounded bg-surface-elevated border border-border-hairline text-xs text-ink-primary"
          >
            {domains.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All domains' : d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Select NoteIT page to extract"
            value={extractPageId || pages[0]?.id || ''}
            onChange={(e) => setExtractPageId(e.target.value)}
            className="h-7 px-2 rounded bg-surface-elevated border border-border-hairline text-xs text-ink-primary max-w-[200px]"
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.title}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            loading={isExtracting}
            disabled={pages.length === 0}
            onClick={() => void handleExtractFromPage()}
          >
            <Sparkles size={12} aria-hidden="true" />
            <span>Extract from Page</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        <div className="flex-1 h-full">
          {snapshot.propositions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <Network size={32} className="text-ink-muted opacity-60" />
              <div className="text-sm font-medium text-ink-primary">
                Your Propositional Knowledge Graph is empty
              </div>
              <p className="text-xs text-ink-secondary max-w-md">
                Complete a Learn session and click &ldquo;Extract to KG&rdquo;, or pick any NoteIT
                page above to extract objective propositions and reasoning chains.
              </p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={(_e, node) => setSelectedPropId(node.id)}
              fitView
            >
              <Background gap={20} size={1} />
              <Controls />
              <MiniMap />
            </ReactFlow>
          )}
        </div>

        {selectedProp && (
          <aside className="w-72 shrink-0 bg-surface-chrome border-l border-border-hairline p-4 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <Badge tone="teal" size="sm">{selectedProp.domainTag}</Badge>
              <button
                type="button"
                onClick={() => void handleDeleteProp(selectedProp.id)}
                className="text-ink-muted hover:text-accent-rose p-1"
                title="Delete proposition"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <p className="text-xs text-ink-primary leading-relaxed">{selectedProp.statement}</p>

            <div className="pt-2 border-t border-border-subtle space-y-2">
              <div className="text-[10px] font-mono uppercase text-ink-muted">Provenance</div>
              {selectedProp.sourcePageId && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    openPageInTab(selectedProp.sourcePageId!)
                    setActiveMainView('workbench')
                  }}
                >
                  <FileText size={12} />
                  <span>Open source NoteIT page</span>
                </Button>
              )}
              {selectedProp.sourceSessionId && onOpenSession && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onOpenSession(selectedProp.sourceSessionId!)}
                >
                  <Sparkles size={12} />
                  <span>Open source Learn session</span>
                </Button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
