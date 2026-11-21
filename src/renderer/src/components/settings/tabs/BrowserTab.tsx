import React from 'react'
import { ExternalLink, Globe } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Badge } from '@renderer/components/ui'

export const BrowserTab: React.FC = () => {
  const { setActiveMainView, toggleBrowserSplitPane } = useWorkspaceStore()

  return (
    <div className="space-y-6 animate-view-enter">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-xl font-bold text-ink-primary">In-app reference browser</h1>
        <Badge tone="cobalt">Beta</Badge>
      </div>
      <div className="p-6 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
        <p className="text-xs text-ink-secondary leading-relaxed">
          The integrated browser uses Electron&apos;s Chromium engine with an isolated session
          partition (<code className="font-mono text-accent-cobalt">persist:noteit-browser</code>).
          Open external API docs, a localhost dev server, or technical references, then use{' '}
          <strong>Clip to spec</strong> or <strong>Ask AI</strong> to pull page content into NoteIT.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMainView('browser')}
            className="px-3.5 py-2 rounded-md bg-accent-cobalt hover:opacity-90 text-white text-xs font-medium flex items-center gap-2"
          >
            <Globe size={13} aria-hidden="true" />
            <span>Open in-app browser (Ctrl+Shift+B)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMainView('workbench')
              toggleBrowserSplitPane()
            }}
            className="px-3.5 py-2 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
          >
            <ExternalLink size={13} className="text-accent-amber" aria-hidden="true" />
            <span>Open in split pane beside the editor</span>
          </button>
        </div>
      </div>
    </div>
  )
}
