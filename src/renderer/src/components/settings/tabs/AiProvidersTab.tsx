import React, { useCallback, useEffect, useState } from 'react'
import {
  Check,
  KeyRound,
  Layers,
  PlugZap,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Trash2
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Badge, Button } from '@renderer/components/ui'
import type {
  AIModelSlots,
  AIProviderKind,
  AIProviderProfile,
  CliBridgeStatus
} from '@shared/types/domain'

type BuiltinProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama'
type Approval = 'ask' | 'auto-edit' | 'plan-only'

function secretKeyForProvider(provider: string): string {
  return `ai.provider.${provider}`
}

const BUILTIN_DEFAULT_MODELS: Record<BuiltinProvider, string> = {
  gemini: 'gemini-2.5-flash',
  anthropic: 'claude-3-5-sonnet-latest',
  openai: 'gpt-4o-mini',
  ollama: 'qwen2.5-coder'
}

export const AiProvidersTab: React.FC = () => {
  const { preferences, updatePreferences, setActiveMainView, showToast } = useWorkspaceStore()

  const activeBuiltin: BuiltinProvider =
    preferences.aiProvider === 'gemini' ||
    preferences.aiProvider === 'openai' ||
    preferences.aiProvider === 'anthropic' ||
    preferences.aiProvider === 'ollama'
      ? preferences.aiProvider
      : 'gemini'

  const [keyInput, setKeyInput] = useState('')
  const [hasEncryptedKey, setHasEncryptedKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Unified Provider Profiles (Custom OpenAI-compat, Anthropic-compat, Custom CLI)
  const [profiles, setProfiles] = useState<AIProviderProfile[]>([])
  const [cliBridges, setCliBridges] = useState<CliBridgeStatus[]>([])
  const [isProbingClis, setIsProbingClis] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [slots, setSlots] = useState<AIModelSlots>({
    primaryProfileId: 'builtin:gemini',
    primaryModelId: 'gemini-2.5-flash',
    backgroundProfileId: 'builtin:gemini',
    backgroundModelId: 'gemini-2.5-flash'
  })

  // Add/Edit Custom Endpoint form state
  const [isAddingProfile, setIsAddingProfile] = useState(false)
  const [formKind, setFormKind] = useState<'openai-compat' | 'anthropic-compat' | 'cli-custom'>('openai-compat')
  const [formName, setFormName] = useState('')
  const [formBaseUrl, setFormBaseUrl] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formCliCommand, setFormCliCommand] = useState('')
  const [formCliArgs, setFormCliArgs] = useState('-p {{prompt}}')

  const currentSecretKey = secretKeyForProvider(activeBuiltin)

  const refreshRegistry = useCallback(async () => {
    try {
      const [profs, currentSlots] = await Promise.all([
        window.noteitAPI?.listProviderProfiles?.() ?? Promise.resolve([]),
        window.noteitAPI?.getModelSlots?.() ?? Promise.resolve(null)
      ])
      setProfiles(profs)
      if (currentSlots) setSlots(currentSlots)
    } catch {
      // ignore in non-electron test env
    }
  }, [])

  const probeClis = useCallback(async () => {
    setIsProbingClis(true)
    try {
      const detected = (await window.noteitAPI?.detectCliBridges?.()) ?? []
      setCliBridges(detected)
    } finally {
      setIsProbingClis(false)
    }
  }, [])

  useEffect(() => {
    void refreshRegistry()
    void probeClis()
  }, [refreshRegistry, probeClis])

  useEffect(() => {
    let active = true
    async function checkAndMigrateSecret(): Promise<void> {
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
        await window.noteitAPI.setSecret({ key: currentSecretKey, value: trimmed })
      }
      if (preferences.aiApiKeyMasked) {
        updatePreferences({ aiApiKeyMasked: '' })
      }
      setKeyInput('')
      setHasEncryptedKey(true)
      showToast(`Encrypted API key saved for ${activeBuiltin}`)
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
    showToast(`Removed stored API key for ${activeBuiltin}`)
  }

  const handleActivateCliBridge = (cli: CliBridgeStatus): void => {
    const kindMap: Record<CliBridgeStatus['id'], AIProviderKind> = {
      claude: 'cli-claude',
      gemini: 'cli-gemini',
      codex: 'cli-codex',
      agy: 'cli-custom'
    }
    const kind = kindMap[cli.id]
    if (cli.id === 'agy') {
      void (async () => {
        const existing = profiles.find((p) => p.kind === 'cli-custom' && p.cliCommand === 'agy')
        const prof =
          existing ||
          (await window.noteitAPI.upsertProviderProfile({
            name: 'Antigravity CLI',
            kind: 'cli-custom',
            cliCommand: 'agy',
            cliArgsTemplate: ['-p', '{{prompt}}'],
            defaultModel: ''
          }))
        await refreshRegistry()
        updatePreferences({ aiProvider: 'cli-custom', aiProfileId: prof.id, aiModel: prof.defaultModel || 'default' })
        showToast('Active AI provider switched to Antigravity CLI (Zero API Key)')
      })()
      return
    }
    updatePreferences({
      aiProvider: kind,
      aiProfileId: undefined,
      aiModel: cli.id === 'claude' ? 'sonnet' : 'default'
    })
    showToast(`Active AI provider switched to ${cli.name} (Zero API Key)`)
  }

  const handleSaveCustomProfile = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!formName.trim()) return
    try {
      const created = await window.noteitAPI.upsertProviderProfile({
        name: formName.trim(),
        kind: formKind,
        baseUrl: formKind === 'cli-custom' ? '' : formBaseUrl.trim(),
        defaultModel: formModel.trim(),
        apiKey: formApiKey.trim() || undefined,
        cliCommand: formKind === 'cli-custom' ? formCliCommand.trim() : '',
        cliArgsTemplate:
          formKind === 'cli-custom'
            ? formCliArgs
                .split(/\s+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : []
      })
      setFormName('')
      setFormBaseUrl('')
      setFormModel('')
      setFormApiKey('')
      setFormCliCommand('')
      setIsAddingProfile(false)
      await refreshRegistry()
      showToast(`Saved provider profile "${created.name}"`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save provider profile', 'error')
    }
  }

  const handleTestProfile = async (profileId: string): Promise<void> => {
    setTestingId(profileId)
    try {
      const res = await window.noteitAPI.testProviderProfile(profileId)
      showToast(
        `${res.ok ? 'Connected' : 'Failed'} (${res.latencyMs}ms): ${res.message}`,
        res.ok ? 'info' : 'error'
      )
    } finally {
      setTestingId(null)
    }
  }

  const handleDeleteProfile = async (id: string, name: string): Promise<void> => {
    await window.noteitAPI.deleteProviderProfile(id)
    if (preferences.aiProfileId === id) {
      updatePreferences({ aiProvider: 'gemini', aiProfileId: undefined, aiModel: 'gemini-2.5-flash' })
    }
    await refreshRegistry()
    showToast(`Deleted provider profile "${name}"`)
  }

  const handleSaveSlots = async (patch: Partial<AIModelSlots>): Promise<void> => {
    const updated = await window.noteitAPI.saveModelSlots(patch)
    setSlots(updated)
    showToast('Model slots updated')
  }

  const slotOptions = [
    { id: 'builtin:cli-claude', label: 'Claude Code CLI (Zero API Key)' },
    { id: 'builtin:cli-gemini', label: 'Gemini CLI (Zero API Key)' },
    { id: 'builtin:cli-codex', label: 'Codex CLI (Zero API Key)' },
    { id: 'builtin:gemini', label: 'Google Gemini (API Key)' },
    { id: 'builtin:anthropic', label: 'Anthropic Claude (API Key)' },
    { id: 'builtin:openai', label: 'OpenAI GPT (API Key)' },
    { id: 'builtin:ollama', label: 'Ollama Local (Offline)' },
    ...profiles.map((p) => ({ id: p.id, label: `${p.name} (${p.kind})` }))
  ]

  return (
    <div className="space-y-6 animate-view-enter">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-primary">AI providers &amp; CLI bridges</h1>
          <p className="text-xs text-ink-secondary mt-1">
            Use your existing authenticated CLIs (zero API key), custom OpenAI/Anthropic-compatible
            endpoints, or encrypted OS keychain keys (Electron safeStorage).
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setActiveMainView('ai-chat')}>
          Open AI Chat
        </Button>
      </div>

      {/* Section 1: Zero-API-Key External CLI Bridges */}
      <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-accent-teal" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink-primary">
                Zero-API-Key External CLI Bridges
              </h2>
              <Badge tone="teal" size="sm">Subscription / Native Auth</Badge>
            </div>
            <p className="text-[11.5px] text-ink-secondary mt-1">
              Reuse CLIs already signed in on your machine. Claude Code bridges NoteIT tools via a
              token-protected loopback MCP server without copying NoteIT API keys.
            </p>
          </div>
          <Button variant="secondary" size="sm" loading={isProbingClis} onClick={() => void probeClis()}>
            <RefreshCw size={12} aria-hidden="true" />
            <span>Check again</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cliBridges.map((cli) => {
            const isSelected =
              (cli.id === 'claude' && preferences.aiProvider === 'cli-claude') ||
              (cli.id === 'gemini' && preferences.aiProvider === 'cli-gemini') ||
              (cli.id === 'codex' && preferences.aiProvider === 'cli-codex') ||
              (cli.id === 'agy' &&
                preferences.aiProvider === 'cli-custom' &&
                profiles.find((p) => p.id === preferences.aiProfileId)?.cliCommand === 'agy')

            return (
              <div
                key={cli.id}
                className="p-3 rounded-lg bg-surface-chrome border border-border-hairline flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-ink-primary truncate">{cli.name}</span>
                    {cli.supportsMcpBridge && (
                      <Badge tone="cobalt" size="sm">MCP</Badge>
                    )}
                    <Badge tone={cli.available ? 'teal' : 'neutral'} size="sm">
                      {cli.available ? 'Ready' : 'Not found'}
                    </Badge>
                  </div>
                  <div className="text-[10.5px] font-mono text-ink-muted truncate mt-0.5">
                    {cli.version || cli.path || `Install "${cli.command}" in PATH`}
                  </div>
                </div>
                <Button
                  variant={isSelected ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={!cli.available}
                  onClick={() => handleActivateCliBridge(cli)}
                >
                  {isSelected ? 'Active' : 'Use CLI'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 2: Custom OpenAI-Compatible & Anthropic-Compatible Endpoints */}
      <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Server size={14} className="text-accent-cobalt" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink-primary">
                Custom OpenAI &amp; Anthropic-Compatible Endpoints
              </h2>
            </div>
            <p className="text-[11.5px] text-ink-secondary mt-1">
              Connect OpenRouter, DeepSeek, Groq, vLLM, LiteLLM, LM Studio, MiniMax, GLM, or custom
              headless CLIs.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddingProfile((v) => !v)}
          >
            <Plus size={12} aria-hidden="true" />
            <span>{isAddingProfile ? 'Cancel' : 'Add endpoint'}</span>
          </Button>
        </div>

        {isAddingProfile && (
          <form
            onSubmit={(e) => void handleSaveCustomProfile(e)}
            className="p-4 rounded-lg bg-surface-chrome border border-border-hairline space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                  Endpoint type
                </label>
                <select
                  value={formKind}
                  onChange={(e) =>
                    setFormKind(e.target.value as 'openai-compat' | 'anthropic-compat' | 'cli-custom')
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-surface-elevated border border-border-hairline text-xs text-ink-primary"
                >
                  <option value="openai-compat">OpenAI-Compatible API (/v1)</option>
                  <option value="anthropic-compat">Anthropic-Compatible API (Messages)</option>
                  <option value="cli-custom">Custom Headless CLI</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                  Profile name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. OpenRouter / DeepSeek / MiniMax"
                  className="w-full px-2.5 py-1.5 rounded bg-surface-elevated border border-border-hairline text-xs text-ink-primary"
                />
              </div>
            </div>

            {formKind !== 'cli-custom' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Base URL
                  </label>
                  <input
                    type="url"
                    required
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder={
                      formKind === 'openai-compat'
                        ? 'https://openrouter.ai/api/v1'
                        : 'https://api.minimaxi.chat/anthropic'
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-primary"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Default Model ID
                  </label>
                  <input
                    type="text"
                    required
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder={
                      formKind === 'openai-compat' ? 'deepseek/deepseek-chat' : 'claude-sonnet-4-20250514'
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    API Key (optional for local servers — stored encrypted)
                  </label>
                  <input
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-2.5 py-1.5 rounded bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-primary"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    CLI Binary / Command
                  </label>
                  <input
                    type="text"
                    required
                    value={formCliCommand}
                    onChange={(e) => setFormCliCommand(e.target.value)}
                    placeholder="agy"
                    className="w-full px-2.5 py-1.5 rounded bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-primary"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Args Template (supports {'{{prompt}}'} &amp; {'{{model}}'})
                  </label>
                  <input
                    type="text"
                    value={formCliArgs}
                    onChange={(e) => setFormCliArgs(e.target.value)}
                    placeholder="-p {{prompt}}"
                    className="w-full px-2.5 py-1.5 rounded bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-primary"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddingProfile(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                <Check size={12} aria-hidden="true" />
                <span>Save Profile</span>
              </Button>
            </div>
          </form>
        )}

        {profiles.length === 0 ? (
          <div className="text-xs text-ink-muted py-2">
            No custom endpoints configured yet. Click &ldquo;Add endpoint&rdquo; to add an
            OpenAI-compatible, Anthropic-compatible, or custom CLI provider.
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((prof) => {
              const isSelected = preferences.aiProfileId === prof.id
              return (
                <div
                  key={prof.id}
                  className="p-3 rounded-lg bg-surface-chrome border border-border-hairline flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-ink-primary">{prof.name}</span>
                      <Badge tone="cobalt" size="sm">{prof.kind}</Badge>
                      {prof.hasApiKey && <Badge tone="teal" size="sm">Key stored</Badge>}
                    </div>
                    <div className="text-[10.5px] font-mono text-ink-muted truncate mt-0.5">
                      {prof.kind === 'cli-custom'
                        ? `${prof.cliCommand} ${prof.cliArgsTemplate.join(' ')}`
                        : `${prof.baseUrl} · model: ${prof.defaultModel || '(default)'}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={testingId === prof.id}
                      onClick={() => void handleTestProfile(prof.id)}
                    >
                      <PlugZap size={11} aria-hidden="true" />
                      <span>Test</span>
                    </Button>
                    <Button
                      variant={isSelected ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        updatePreferences({
                          aiProvider: prof.kind,
                          aiProfileId: prof.id,
                          aiModel: prof.defaultModel || 'default'
                        })
                        showToast(`Active AI provider switched to ${prof.name}`)
                      }}
                    >
                      {isSelected ? 'Active' : 'Use'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleDeleteProfile(prof.id, prof.name)}
                      title="Delete profile"
                    >
                      <Trash2 size={11} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 3: Model Slots (Primary vs Background) */}
      <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-accent-amber" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink-primary">Model Slots (Chat/Learn vs Background)</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase text-ink-muted">
              Primary Slot (AI Chat &amp; Learn Tutor)
            </label>
            <select
              value={slots.primaryProfileId}
              onChange={(e) => void handleSaveSlots({ primaryProfileId: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary"
            >
              {slotOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={slots.primaryModelId}
              onChange={(e) => setSlots((s) => ({ ...s, primaryModelId: e.target.value }))}
              onBlur={() => void handleSaveSlots({ primaryModelId: slots.primaryModelId })}
              placeholder="Model ID (e.g. sonnet, gemini-2.5-pro)"
              className="w-full px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase text-ink-muted">
              Background Slot (Knowledge Graph Extraction)
            </label>
            <select
              value={slots.backgroundProfileId}
              onChange={(e) => void handleSaveSlots({ backgroundProfileId: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary"
            >
              {slotOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={slots.backgroundModelId}
              onChange={(e) => setSlots((s) => ({ ...s, backgroundModelId: e.target.value }))}
              onBlur={() => void handleSaveSlots({ backgroundModelId: slots.backgroundModelId })}
              placeholder="Fast/cheap model ID (e.g. haiku, gemini-2.5-flash)"
              className="w-full px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Built-in Cloud / Ollama API Keys & Approval Policy */}
      <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="ai-provider"
              className="block font-mono text-[10px] uppercase text-ink-muted mb-1"
            >
              Built-in API provider
            </label>
            <select
              id="ai-provider"
              value={activeBuiltin}
              onChange={(e) => {
                const next = e.target.value as BuiltinProvider
                updatePreferences({
                  aiProvider: next,
                  aiProfileId: undefined,
                  aiModel: BUILTIN_DEFAULT_MODELS[next]
                })
              }}
              className="w-full px-3 py-2 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus-visible:ring-2 focus-visible:ring-accent-cobalt"
            >
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI GPT</option>
              <option value="ollama">Ollama local (100% offline)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="ai-model-id"
              className="block font-mono text-[10px] uppercase text-ink-muted mb-1"
            >
              Model ID (customizable)
            </label>
            <input
              id="ai-model-id"
              type="text"
              value={preferences.aiModel}
              onChange={(e) => updatePreferences({ aiModel: e.target.value })}
              placeholder={BUILTIN_DEFAULT_MODELS[activeBuiltin]}
              className="w-full px-3 py-2 rounded bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary"
            />
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
              Encrypted API key / local endpoint for {activeBuiltin} (Electron safeStorage)
            </label>
            {hasEncryptedKey ? (
              <Badge tone="teal" size="sm">
                <ShieldCheck size={11} aria-hidden="true" />
                <span>Encrypted key stored</span>
              </Badge>
            ) : (
              <Badge tone="neutral" size="sm">
                <KeyRound size={11} aria-hidden="true" />
                <span>No API key stored</span>
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
                  : 'sk-... or http://localhost:11434'
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
          </div>
        </div>
      </div>
    </div>
  )
}
