import React from 'react'
import { Plug } from 'lucide-react'

/** Shell for the Universal MCP client settings; populated in Wave 2. */
export const McpServersTab: React.FC = () => (
  <div className="space-y-6 animate-view-enter">
    <div>
      <h1 className="font-display text-xl font-bold text-ink-primary">MCP servers</h1>
      <p className="text-xs text-ink-secondary mt-1">
        Connect Model Context Protocol servers so the in-app AI agent can use external tools.
      </p>
    </div>
    <div className="p-6 rounded-xl bg-surface-elevated border border-dashed border-border-hairline flex items-center gap-3 text-xs text-ink-secondary">
      <Plug size={16} className="text-accent-cobalt" aria-hidden="true" />
      <span>No MCP servers configured yet.</span>
    </div>
  </div>
)
