import React, { useEffect, useState } from 'react'
import { Check, KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Badge, Button } from '@renderer/components/ui'

type Provider = 'gemini' | 'openai' | 'anthropic' | 'ollama'
type Approval = 'ask' | 'auto-edit' | 'plan-only'

function secretKeyForProvider(provider: Provider): string {
  return `ai.provider.${provider}`
}

export const AiProvidersTab: React.FC = () => {
  const { preferences, updatePreferences, setActiveMainView, showToast } = useWorkspaceStore()

  const [keyInput, setKeyInput] = useState('')
  const [hasEncryptedKey, setHasEncryptedKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const currentSecretKey = secretKeyForProvider(preferences.aiProvider)

  useEffect(() => {
    let active = true
    async function checkAndMigrateSecret(): Promise<void> {
      // One-time migration: if legacy plaintext aiApiKeyMasked exists in localStorage, encrypt via safeStorage and wipe
      if (preferences.aiApiKeyMasked && preferences.aiApiKeyMasked.trim().length > 0) {
        const legacyPlaintext = preferences.aiApiKeyMasked.trim()
        if (window.noteitAPI?.setSecret) {
          await window.noteitAPI.setSecret({
            key: currentSecretKey,
            value: legacyPlaintext
          })
        }
        updatePreferences({ aiApiKeyMasked: '' })
      }

      if (window.noteitAPI?.hasSecret) {
        const exists = await window.noteitAPI.hasSecret(currentSecretKey)
        if (active) setHasEncryptedKey(exists)
      }
    }
    void checkAndMigrateSecret()
    return () => {
      active = false
    }
  }, [currentSecretKey, preferences.aiApiKeyMasked, updatePreferences])

  const handleSaveSecret = async (): Promise<void> => {
    const trimmed = keyInput.trim()
    if (!trimmed) return
    setIsSaving(true)
    try {
      if (window.noteitAPI?.setSecret) {
        await window.noteitAPI.setSecret({
          key: currentSecretKey,
          value: trimmed
        })
      }
      if (preferences.aiApiKeyMasked) {
        updatePreferences({ aiApiKeyMasked: '' })
      }
      setKeyInput('')
      setHasEncryptedKey(true)
      showToast(`Encrypted API key saved for ${preferences.aiProvider}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save encrypted secret', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSecret = async (): Promise<void> => {
    if (window.noteitAPI?.deleteSecret) {
      await window.noteitAPI.deleteSecret(currentSecretKey)
    }
    setHasEncryptedKey(false)
    setKeyInput('')
    showToast(`Removed stored API key for ${preferences.aiProvider}`)
  }

  return (
    <div className="space-y-6 animate-view-enter">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-primary">AI providers</h1>
        <p className="text-xs text-ink-secondary mt-1">
          Configure the model provider, the approval policy for agent actions, and encrypted OS
          keychain credentials (Electron safeStorage).
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="ai-api-key"
              className="block font-mono text-[10px] uppercase text-ink-muted"
            >
              Encrypted API key / local endpoint (Electron safeStorage)
            </label>
            {hasEncryptedKey ? (
              <Badge tone="teal" size="sm">
                <ShieldCheck size={11} aria-hidden="true" />
                <span>Encrypted key stored in safeStorage</span>
              </Badge>
            ) : (
              <Badge tone="neutral" size="sm">
                <KeyRound size={11} aria-hidden="true" />
                <span>Local simulation mode (no key stored)</span>
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              id="ai-api-key"
              type="password"
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={
                hasEncryptedKey
                  ? '•••••••••••••••••••••••• (enter new key to replace)'
                  : 'sk-... or http://localhost:11434 (leave empty for local simulation mode)'
              }
              className="flex-1 min-w-[240px] px-3 py-1.5 rounded bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary focus:outline-none focus:border-accent-cobalt focus-visible:ring-2 focus-visible:ring-accent-cobalt"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!keyInput.trim()}
              loading={isSaving}
              onClick={() => void handleSaveSecret()}
            >
              <Check size={12} aria-hidden="true" />
              <span>Save Encrypted Key</span>
            </Button>
            {hasEncryptedKey && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleDeleteSecret()}
                title="Delete stored encrypted key"
              >
                <Trash2 size={12} aria-hidden="true" />
                <span>Clear Key</span>
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveMainView('ai-chat')}
            >
              Open AI Chat
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
