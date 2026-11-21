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
import { Button, SegmentedControl } from '@renderer/components/ui'

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
    <div className="rounded-[12px] bg-canvas-primary border border-border-hairline overflow-hidden shadow-card my-4">
      {/* Header Bar */}
      <div className="h-[44px] px-4 bg-surface-chrome/75 border-b border-border-hairline flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-accent-violet" />
          <span className="font-display text-[13.5px] font-semibold text-ink-primary">
            Graphviz DOT
          </span>
          <span className="text-[11px] text-ink-muted hidden sm:inline">Offline WASM</span>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={activeEngine}
            onChange={(e) => onChange({ graphvizEngine: resolveGraphvizEngine(e.target.value) })}
            title="Engine layout Graphviz"
            className="h-6 px-2 rounded-[6px] bg-surface-elevated border border-border-hairline font-mono text-[11px] text-ink-secondary hover:text-ink-primary focus:border-accent-cobalt"
          >
            {GRAPHVIZ_ENGINES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <SegmentedControl<'code' | 'split' | 'diagram'>
            size="xs"
            value={viewMode}
            onChange={(nextMode) => onChange({ graphvizViewMode: nextMode })}
            options={[
              { value: 'code', label: 'Code', icon: <Code2 size={11} /> },
              { value: 'split', label: 'Split', icon: <Columns2 size={11} /> },
              { value: 'diagram', label: 'Diagram', icon: <LayoutGrid size={11} /> }
            ]}
          />

          <Button variant="secondary" size="xs" onClick={handleExportSvg}>
            <Download size={11.5} />
            <span>Export SVG</span>
          </Button>
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
            } flex flex-col bg-surface-chrome/45`}
          >
            <textarea
              value={code}
              onChange={(e) => onChange({ content: e.target.value })}
              spellCheck={false}
              placeholder={'digraph G {\n  A -> B\n}'}
              className="flex-1 p-3.5 bg-transparent font-mono text-xs leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text min-h-[260px]"
            />
            {errorMsg && (
              <div className="p-2.5 bg-[var(--pill-red-bg)] border-t border-[var(--pill-red-border)] flex items-start gap-2 font-mono text-[11px] text-[var(--pill-red-text)]">
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
            } relative bg-dot-canvas p-5 flex items-center justify-center overflow-auto min-h-[290px]`}
          >
            <div className="absolute right-3.5 bottom-3.5 z-10 flex items-center gap-0.5 p-1 rounded-[9px] bg-surface-elevated/95 border border-border-hairline font-mono text-[11px] shadow-popover">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                className="h-6 w-6 rounded-[6px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary"
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-2 text-ink-primary tabular-nums"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}
                className="h-6 w-6 rounded-[6px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary"
              >
                <ZoomIn size={12} />
              </button>
            </div>

            {svgOutput ? (
              <div
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="transition-transform duration-150 bg-white rounded-[10px] p-3 shadow-card"
                dangerouslySetInnerHTML={{ __html: svgOutput }}
              />
            ) : (
              <span className="text-xs text-ink-muted">
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
