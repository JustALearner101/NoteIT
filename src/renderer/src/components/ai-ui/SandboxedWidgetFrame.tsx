import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Code2, Copy, FilePlus2, Maximize2, Minimize2, RotateCw, Sparkles } from 'lucide-react'
import { Button } from '@renderer/components/ui'

export interface SandboxedWidgetSpec {
  title?: string
  initialHeight?: number
  css?: string
  html: string
  js?: string
}

interface SandboxedWidgetFrameProps {
  spec: SandboxedWidgetSpec
  onFollowUp?: (prompt: string) => void
  onSaveToPage?: (title: string, markdown: string) => void
}

/**
 * Validates postMessage events coming from the isolated `sandbox="allow-scripts"` iframe.
 * Never trusts arbitrary message types or non-string payloads.
 */
export function parseWidgetPostMessage(data: unknown): {
  action: 'follow-up' | 'copy' | 'save-to-page' | 'resize'
  payload: string | number
} | null {
  if (!data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  if (rec.type !== 'noteit-widget-action') return null
  if (
    rec.action === 'follow-up' ||
    rec.action === 'copy' ||
    rec.action === 'save-to-page'
  ) {
    if (typeof rec.payload !== 'string' || !rec.payload.trim()) return null
    return { action: rec.action, payload: rec.payload.slice(0, 4000) }
  }
  if (rec.action === 'resize' && typeof rec.payload === 'number' && Number.isFinite(rec.payload)) {
    return { action: 'resize', payload: Math.min(720, Math.max(160, Math.round(rec.payload))) }
  }
  return null
}

/**
 * Renders a self-contained HTML/CSS/JS interactive widget inside a strict
 * `<iframe sandbox="allow-scripts" srcDoc={...}>` (no `allow-same-origin`, no Electron IPC).
 */
export const SandboxedWidgetFrame: React.FC<SandboxedWidgetFrameProps> = ({
  spec,
  onFollowUp,
  onSaveToPage
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(spec.initialHeight || 320)
  const [expanded, setExpanded] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  const srcDoc = useMemo(() => {
    const safeCss = spec.css || ''
    const safeHtml = spec.html || ''
    const safeJs = spec.js || ''
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob: https:;" />
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 12px; font-family: Inter, system-ui, sans-serif; background: #141417; color: #EDEDEF; }
  ${safeCss}
</style>
</head>
<body>
${safeHtml}
<script>
try {
${safeJs}
} catch (err) {
  document.body.insertAdjacentHTML('beforeend', '<pre style="color:#F87171;font-size:11px;margin-top:8px;">Widget error: ' + String(err) + '</pre>');
}
</script>
</body>
</html>`
  }, [spec.css, spec.html, spec.js])

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return
      const parsed = parseWidgetPostMessage(event.data)
      if (!parsed) return
      if (parsed.action === 'follow-up' && typeof parsed.payload === 'string') {
        onFollowUp?.(parsed.payload)
      } else if (parsed.action === 'copy' && typeof parsed.payload === 'string') {
        void navigator.clipboard?.writeText(parsed.payload)
      } else if (parsed.action === 'save-to-page' && typeof parsed.payload === 'string') {
        onSaveToPage?.(spec.title || 'Interactive Widget', parsed.payload)
      } else if (parsed.action === 'resize' && typeof parsed.payload === 'number') {
        setHeight(parsed.payload)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onFollowUp, onSaveToPage, spec.title])

  return (
    <div className="my-3 rounded-xl bg-surface-chrome border border-border-hairline overflow-hidden shadow-card">
      <div className="px-3 py-1.5 bg-surface-elevated/80 border-b border-border-subtle flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={12} className="text-[var(--marker-violet)] shrink-0" />
          <span className="text-xs font-medium text-ink-primary truncate">
            {spec.title || 'Interactive Sandboxed Widget'}
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-chrome border border-border-subtle text-ink-muted">
            sandbox
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => setShowSource((v) => !v)} title="Toggle source">
            <Code2 size={11} />
            <span>{showSource ? 'Preview' : 'Code'}</span>
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setReloadNonce((n) => n + 1)} title="Reset widget">
            <RotateCw size={11} />
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setExpanded((v) => !v)} title="Toggle height">
            {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </Button>
          {onSaveToPage && (
            <Button
              variant="secondary"
              size="xs"
              onClick={() =>
                onSaveToPage(
                  spec.title || 'Interactive Widget',
                  `\`\`\`html\n${spec.html}\n\`\`\`\n\n\`\`\`js\n${spec.js || ''}\n\`\`\``
                )
              }
            >
              <FilePlus2 size={11} />
              <span>Save</span>
            </Button>
          )}
        </div>
      </div>

      {showSource ? (
        <div className="p-3 bg-surface-chrome space-y-2 max-h-80 overflow-auto font-mono text-[11px] text-ink-secondary">
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => void navigator.clipboard?.writeText(srcDoc)}
            >
              <Copy size={11} />
              <span>Copy HTML</span>
            </Button>
          </div>
          <pre className="whitespace-pre-wrap">{srcDoc}</pre>
        </div>
      ) : (
        <iframe
          key={reloadNonce}
          ref={iframeRef}
          title={spec.title || 'Sandboxed Interactive Widget'}
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          style={{ height: expanded ? Math.max(height, 520) : height }}
          className="w-full border-0 bg-[#141417] block"
        />
      )}
    </div>
  )
}
