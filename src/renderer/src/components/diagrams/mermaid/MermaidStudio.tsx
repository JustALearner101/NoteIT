import React, { useEffect, useId, useState } from 'react'
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
import { Button, SegmentedControl } from '@renderer/components/ui'
import { sanitizeSvg } from '@shared/svg-sanitize'

interface MermaidStudioProps {
  code: string
  viewMode?: 'code' | 'split' | 'diagram'
  onChange: (updates: {
    content?: string
    mermaidViewMode?: 'code' | 'split' | 'diagram'
  }) => void
}

export const MermaidStudio: React.FC<MermaidStudioProps> = ({
  code,
  viewMode = 'split',
  onChange
}) => {
  const { theme, showToast } = useWorkspaceStore()
  const uniqueId = useId().replace(/:/g, '-')
  const [svgOutput, setSvgOutput] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let active = true

    async function renderDiagram(): Promise<void> {
      if (!code.trim()) {
        setSvgOutput('')
        setErrorMsg(null)
        return
      }
      try {
        const mermaidModule = await import('mermaid')
        const mermaidInstance = mermaidModule.default
        mermaidInstance.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'neutral',
          securityLevel: 'strict',
          fontFamily: 'JetBrains Mono, monospace'
        })
        const { svg } = await mermaidInstance.render(
          `mermaid-svg-${uniqueId}-${Date.now()}`,
          code
        )
        if (active) {
          setSvgOutput(sanitizeSvg(svg))
          setErrorMsg(null)
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg(
            err?.message?.split('\n')[0] ||
              'Invalid Mermaid diagram syntax. Check the header declaration (e.g. sequenceDiagram, flowchart LR).'
          )
        }
      }
    }

    renderDiagram()
    return () => {
      active = false
    }
  }, [code, theme, uniqueId])

  const handleExportSvg = async (): Promise<void> => {
    if (!svgOutput) return
    const res = await window.noteitAPI.exportContent({
      filename: 'noteit-mermaid-diagram',
      content: svgOutput,
      extension: 'svg'
    })
    if (res.saved) {
      showToast('Mermaid diagram exported to .SVG file')
    }
  }

  return (
    <div className="rounded-[12px] bg-canvas-primary border border-border-hairline overflow-hidden shadow-card my-4">
      {/* Header Bar */}
      <div className="h-[44px] px-4 bg-surface-chrome/75 border-b border-border-hairline flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-accent-teal" />
          <span className="font-display text-[13.5px] font-semibold text-ink-primary">
            Mermaid Diagram
          </span>
          <span className="text-[11px] text-ink-muted hidden sm:inline">Offline renderer</span>
        </div>

        <div className="flex items-center gap-1.5">
          <SegmentedControl<'code' | 'split' | 'diagram'>
            size="xs"
            value={viewMode}
            onChange={(nextMode) => onChange({ mermaidViewMode: nextMode })}
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
              aria-label="Mermaid diagram code"
              value={code}
              onChange={(e) => onChange({ content: e.target.value })}
              spellCheck={false}
              className="flex-1 p-3.5 bg-transparent font-mono text-xs leading-relaxed text-ink-primary resize-none focus:outline-none selectable-text min-h-[260px]"
            />
            {errorMsg && (
              <div className="p-2.5 bg-[var(--pill-red-bg)] border-t border-[var(--pill-red-border)] flex items-start gap-2 font-mono text-[11px] text-[var(--pill-red-text)]">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
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
                aria-label="Zoom out Mermaid diagram"
                onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                className="h-6 w-6 rounded-[6px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary"
              >
                <ZoomOut size={12} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Reset Mermaid diagram zoom"
                onClick={() => setZoom(1)}
                className="px-2 text-ink-primary tabular-nums"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="Zoom in Mermaid diagram"
                onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}
                className="h-6 w-6 rounded-[6px] hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary"
              >
                <ZoomIn size={12} aria-hidden="true" />
              </button>
            </div>

            {svgOutput ? (
              <div
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="transition-transform duration-150"
                dangerouslySetInnerHTML={{ __html: svgOutput }}
              />
            ) : (
              <span className="text-xs text-ink-muted">
                Type Mermaid code to render the diagram live.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
