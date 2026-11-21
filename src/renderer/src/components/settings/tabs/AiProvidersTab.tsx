import React from 'react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'

type Provider = 'gemini' | 'openai' | 'anthropic' | 'ollama'
type Approval = 'ask' | 'auto-edit' | 'plan-only'

export const AiProvidersTab: React.FC = () => {
  const { preferences, updatePreferences, setActiveMainView } = useWorkspaceStore()

  return (
    <div className="space-y-6 animate-view-enter">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-primary">AI providers</h1>
        <p className="text-xs text-ink-secondary mt-1">
          Configure the model provider, the approval policy for agent actions, and AI Chat behavior.
        </p>
      </div>

      <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="ai-provider"
              className="block font-mono text-[10px] uppercase text-ink-muted mb-1"
            >
              Default AI provider
            </label>
            <select
              id="ai-provider"
              value={preferences.aiProvider}
              onChange={(e) => updatePreferences({ aiProvider: e.target.value as Provider })}
              className="w-full px-3 py-2 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus-visible:ring-2 focus-visible:ring-accent-cobalt"
            >
              <option value="gemini">Google Gemini (recommended)</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI GPT</option>
              <option value="ollama">Ollama local (100% offline)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="ai-approval"
              className="block font-mono text-[10px] uppercase text-ink-muted mb-1"
            >
              Default approval policy
            </label>
            <select
              id="ai-approval"
              value={preferences.aiApprovalMode}
              onChange={(e) => updatePreferences({ aiApprovalMode: e.target.value as Approval })}
              className="w-full px-3 py-2 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus-visible:ring-2 focus-visible:ring-accent-cobalt"
            >
              <option value="ask">Ask for approval before editing pages</option>
              <option value="auto-edit">Auto-apply proposed changes</option>
              <option value="plan-only">Plan and discuss only</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="ai-api-key"
            className="block font-mono text-[10px] uppercase text-ink-muted mb-1"
          >
            API key / local endpoint (optional)
          </label>
          <div className="flex gap-2">
            <input
              id="ai-api-key"
              type="password"
              autoComplete="off"
              value={preferences.aiApiKeyMasked}
              onChange={(e) => updatePreferences({ aiApiKeyMasked: e.target.value })}
              placeholder="sk-... or http://localhost:11434 (leave empty for local simulation mode)"
              className="flex-1 px-3 py-1.5 rounded bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary focus:outline-none focus:border-accent-cobalt focus-visible:ring-2 focus-visible:ring-accent-cobalt"
            />
            <button
              type="button"
              onClick={() => setActiveMainView('ai-chat')}
              className="px-3 py-1.5 rounded bg-accent-cobalt text-white text-xs font-medium"
            >
              Open AI Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
