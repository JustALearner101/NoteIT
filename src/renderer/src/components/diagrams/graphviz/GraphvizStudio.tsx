import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Code2,
  Columns2,
  Download,
  LayoutGrid,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import {
  GRAPHVIZ_ENGINES,
  renderGraphvizToSvg,
  resolveGraphvizEngine
} from '@renderer/lib/diagrams/graphviz'

interface GraphvizStudioProps {
  code: string
  viewMode?: 'code' | 'split' | 'diagram'
  engine?: string
  onChange: (updates: {
    content?: string
    graphvizViewMode?: 'code' | 'split' | 'diagram'
    graphvizEngine?: 'dot' | 'neato' | 'fdp' | 'circo' | 'twopi'
  }) => void
}

export const GraphvizStudio: React.FC<GraphvizStudioProps> = ({
  code,
  viewMode = 'split',
  engine,
  onChange
}) => {
  const { showToast } = useWorkspaceStore()
  const [svgOutput, setSvgOutput] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  const activeEngine = resolveGraphvizEngine(engine)

  useEffect(() => {
    let active = true

    async function renderDiagram(): Promise<void> {
      try {
        const svg = await renderGraphvizToSvg(code, activeEngine)
        if (!active) return
        setSvgOutput(svg)
        setErrorMsg(null)
      } catch (err: any) {
        if (!active) return
        // Kosongkan SVG lama: diagram basi + pesan error sekaligus menyesatkan.
        setSvgOutput('')
        setErrorMsg(
          err?.message?.split('\n')[0] ||
            'Sintaks DOT tidak valid. Periksa deklarasi header (mis. digraph G { A -> B }).'
        )
      }
    }

    renderDiagram()
    return () => {
      active = false
    }
  }, [code, activeEngine])

  const handleExportSvg = async (): Promise<void> => {
    if (!svgOutput) return
    const res = await window.noteitAPI.exportContent({
      filename: 'noteit-graphviz-diagram',
      content: svgOutput,
      extension: 'svg'
    })
    if (res.saved) {
      showToast('Diagram Graphviz diekspor ke berkas .SVG')
    }
  }

  return (
    <div className="rounded-[8px] bg-surface-elevated border border-border-hairline overflow-hidden shadow-sm my-3">
      {/* Header Bar */}
      <div className="h-9 px-3 bg-surface-chrome border-b border-border-hairline flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
          <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-ink-primary">
            GRAPHVIZ DOT DIAGRAM (OFFLINE WASM)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={activeEngine}
            onChange={(e) => onChange({ graphvizEngine: resolveGraphvizEngine(e.target.value) })}
            title="Engine layout Graphviz"
            className="h-6 px-1.5 rounded bg-surface-elevated border border-border-hairline font-mono text-[10px] text-ink-secondary hover:text-ink-primary focus:outline-none"
          >
            {GRAPHVIZ_ENGINES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="p-0.5 rounded bg-surface-elevated border border-border-hairline flex items-center font-mono text-[10px]">
            <button
              onClick={() => onChange({ graphvizViewMode: 'code' })}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === 'code'
                  ? 'bg-accent-cobalt text-white'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Code2 size={11} />
              <span>Code</span>
            </button>
            <button
              onClick={() => onChange({ graphvizViewMode: 'split' })}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === 'split'
                  ? 'bg-accent-cobalt text-white'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Columns2 size={11} />
              <span>Split</span>
            </button>
            <button
              onClick={() => onChange({ graphvizViewMode: 'diagram' })}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === 'diagram'
                  ? 'bg-accent-cobalt text-white'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <LayoutGrid size={11} />
              <span>Diagram</span>
            </button>
          </div>

          <button
            onClick={handleExportSvg}
            className="h-6 px-2 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline font-mono text-[10px] text-ink-secondary hover:text-ink-primary flex items-center gap-1"
          >
            <Download size={11} />
            <span>Ekspor SVG</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className={`grid ${
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
        } min-h-[290px]`}
      >
        {(viewMode === 'code' || viewMode === 'split') && (
          <div
            className={`${
              viewMode === 'split' ? 'lg:col-span-5 border-r border-border-hairline' : ''
            } flex flex-col bg-surface-chrome/50`}
          >
            <textarea
              value={code}
              onChange={(e) => onChange({ content: e.target.value })}
              spellCheck={false}
              placeholder={'digraph G {\n  A -> B\n}'}
              className="flex-1 p-3 bg-transparent font-mono text-xs leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text min-h-[260px]"
            />
            {errorMsg && (
              <div className="p-2.5 bg-[#EF4444]/10 border-t border-[#EF4444]/40 flex items-start gap-2 font-mono text-[11px] text-[#EF4444]">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {(viewMode === 'diagram' || viewMode === 'split') && (
          <div
            className={`${
              viewMode === 'split' ? 'lg:col-span-7' : ''
            } relative bg-blueprint-grid p-4 flex items-center justify-center overflow-auto min-h-[290px]`}
          >
            <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1 p-1 rounded bg-surface-elevated/90 border border-border-hairline font-mono text-[11px]">
              <button
                onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                className="p-1 rounded hover:bg-surface-hover text-ink-secondary"
              >
                <ZoomOut size={12} />
              </button>
              <button onClick={() => setZoom(1)} className="px-1.5 text-ink-primary tabular-nums">
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}
                className="p-1 rounded hover:bg-surface-hover text-ink-secondary"
              >
                <ZoomIn size={12} />
              </button>
            </div>

            {svgOutput ? (
              <div
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="transition-transform duration-150 bg-white rounded-[6px] p-2"
                dangerouslySetInnerHTML={{ __html: svgOutput }}
              />
            ) : (
              <span className="font-mono text-xs text-ink-muted">
                {errorMsg
                  ? 'Diagram tidak dapat dirender — perbaiki kode DOT di editor.'
                  : 'Ketik kode DOT untuk merender diagram secara langsung.'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
