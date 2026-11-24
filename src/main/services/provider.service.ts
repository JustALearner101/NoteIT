import crypto from 'node:crypto'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, type LanguageModel } from 'ai'
import type {
  AIModelSlots,
  AIProviderKind,
  AIProviderPreset,
  AIProviderProfile,
  AIProviderProfileInput,
  AIProviderTestResult
} from '@shared/types/domain'
import { getDb } from '../db/client'
import {
  deleteSecret,
  getProviderSecretKeyName,
  getSecret,
  hasSecret,
  isSensitiveHeaderName,
  redactSecrets,
  setSecret
} from './secret.service'
import { detectCliBridges } from './cli-bridge/cli-bridge.service'

const MODEL_SLOTS_KV_KEY = 'ai.model_slots'
const REDACTED_HEADER_PLACEHOLDER = '__ENCRYPTED__'

const DEFAULT_MODEL_SLOTS: AIModelSlots = {
  primaryProfileId: 'builtin:gemini',
  primaryModelId: 'gemini-2.5-flash',
  backgroundProfileId: 'builtin:gemini',
  backgroundModelId: 'gemini-2.5-flash'
}

export const THIRD_PARTY_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai-compat',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    extraHeaders: {
      'HTTP-Referer': 'https://noteit.local',
      'X-Title': 'NoteIT'
    },
    description: 'Access 300+ models through one unified OpenAI-compatible gateway.'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai-compat',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    description: 'DeepSeek V3 & R1 reasoning models.'
  },
  {
    id: 'groq',
    name: 'Groq',
    kind: 'openai-compat',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    description: 'Ultra-low-latency LPU inference.'
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    kind: 'openai-compat',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    description: 'xAI Grok models via OpenAI-compatible API.'
  },
  {
    id: 'together',
    name: 'Together AI',
    kind: 'openai-compat',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    description: 'Fast open-weights serverless inference.'
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    kind: 'openai-compat',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/deepseek-v3',
    description: 'High-throughput OpenAI-compatible inference.'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    kind: 'openai-compat',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    description: 'Local offline server (no API key required).'
  },
  {
    id: 'minimax',
    name: 'MiniMax (Anthropic-Compat)',
    kind: 'anthropic-compat',
    baseUrl: 'https://api.minimax.io/anthropic/v1',
    defaultModel: 'MiniMax-M1',
    description: 'MiniMax via Anthropic Messages-compatible endpoint.'
  },
  {
    id: 'zhipu-glm',
    name: 'Zhipu GLM',
    kind: 'openai-compat',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    description: 'Zhipu AI GLM-4 models.'
  }
]

export function getProfileSecretKeyName(profileId: string): string {
  return `ai.profile.${profileId.trim()}`
}

export function getProfileSensitiveHeadersKeyName(profileId: string): string {
  return `ai.profile.${profileId.trim()}.headers`
}

export function isCliProviderKind(kind: AIProviderKind): boolean {
  return (
    kind === 'cli-claude' ||
    kind === 'cli-gemini' ||
    kind === 'cli-codex' ||
    kind === 'cli-custom'
  )
}

/**
 * Normalizes a custom endpoint base URL without duplicating `/v1`.
 */
export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

/**
 * Resolves the `/models` discovery URL for OpenAI-compat or Anthropic-compat endpoints
 * without accidentally producing `/v1/v1/models`.
 */
export function buildModelsProbeUrl(kind: AIProviderKind, baseUrl: string): string {
  const clean = normalizeBaseUrl(baseUrl)
  if (kind === 'anthropic-compat') {
    return /\/v1$/i.test(clean) ? `${clean}/models` : `${clean}/v1/models`
  }
  return `${clean}/models`
}

/**
 * Splits custom headers into public (safe for SQLite/renderer) and sensitive (encrypted in `secrets`).
 */
function partitionHeaders(
  headers: Record<string, string>,
  existingEncryptedHeaders: Record<string, string>
): { publicHeaders: Record<string, string>; sensitiveHeaders: Record<string, string> } {
  const publicHeaders: Record<string, string> = {}
  const sensitiveHeaders: Record<string, string> = {}

  for (const [rawKey, rawVal] of Object.entries(headers)) {
    const key = rawKey.trim()
    const val = String(rawVal ?? '').trim()
    if (!key || !val) continue

    if (isSensitiveHeaderName(key)) {
      // Preserve previously encrypted value if UI sent back the redacted placeholder
      if (val === REDACTED_HEADER_PLACEHOLDER && existingEncryptedHeaders[key]) {
        sensitiveHeaders[key] = existingEncryptedHeaders[key]
      } else if (val !== REDACTED_HEADER_PLACEHOLDER) {
        sensitiveHeaders[key] = val
      }
    } else {
      publicHeaders[key] = val
    }
  }

  return { publicHeaders, sensitiveHeaders }
}

function readDecryptedSensitiveHeaders(profileId: string): Record<string, string> {
  const raw = getSecret(getProfileSensitiveHeadersKeyName(profileId))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>
    }
  } catch {
    // ignore malformed
  }
  return {}
}

/**
 * Main-process-only helper that merges public extraHeaders with encrypted sensitive headers.
 */
function resolveMergedHeadersForProfile(profileId: string, publicHeaders: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const [k, v] of Object.entries(publicHeaders)) {
    if (v !== REDACTED_HEADER_PLACEHOLDER) {
      merged[k] = v
    }
  }
  const sensitive = readDecryptedSensitiveHeaders(profileId)
  return { ...merged, ...sensitive }
}

interface ProviderProfileRow {
  id: string
  name: string
  kind: string
  base_url: string
  default_model: string
  extra_headers_json: string
  cli_command: string
  cli_args_json: string
  enabled: number
  created_at: number
  updated_at: number
}

function rowToProfile(row: ProviderProfileRow): AIProviderProfile {
  let publicHeaders: Record<string, string> = {}
  let cliArgsTemplate: string[] = []
  try {
    const parsed = JSON.parse(row.extra_headers_json || '{}')
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed as Record<string, string>)) {
        // Defense-in-depth: never leak any sensitive header value to renderer even on legacy rows
        publicHeaders[k] = isSensitiveHeaderName(k) ? REDACTED_HEADER_PLACEHOLDER : String(v)
      }
    }
  } catch {
    publicHeaders = {}
  }

  // Expose encrypted sensitive header names as redacted placeholders so UI knows they exist
  const sensitiveKeyNames = Object.keys(readDecryptedSensitiveHeaders(row.id))
  for (const keyName of sensitiveKeyNames) {
    publicHeaders[keyName] = REDACTED_HEADER_PLACEHOLDER
  }

  try {
    const parsed = JSON.parse(row.cli_args_json || '[]')
    if (Array.isArray(parsed)) cliArgsTemplate = parsed.map(String)
  } catch {
    cliArgsTemplate = []
  }

  return {
    id: row.id,
    name: row.name,
    kind: row.kind as AIProviderKind,
    baseUrl: row.base_url || '',
    defaultModel: row.default_model || '',
    extraHeaders: publicHeaders,
    cliCommand: row.cli_command || '',
    cliArgsTemplate,
    enabled: Boolean(row.enabled),
    hasApiKey: hasSecret(getProfileSecretKeyName(row.id)),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listProviderProfiles(): AIProviderProfile[] {
  const rows = getDb()
    .prepare('SELECT * FROM ai_provider_profiles ORDER BY created_at ASC')
    .all() as unknown as ProviderProfileRow[]
  return rows.map(rowToProfile)
}

export function getProviderProfileById(id: string): AIProviderProfile | null {
  const row = getDb()
    .prepare('SELECT * FROM ai_provider_profiles WHERE id = ?')
    .get(id) as unknown as ProviderProfileRow | undefined
  return row ? rowToProfile(row) : null
}

export function upsertProviderProfile(input: AIProviderProfileInput): AIProviderProfile {
  const now = Date.now()
  const existing = input.id ? getProviderProfileById(input.id) : null
  const id = existing?.id || input.id?.trim() || `prof-${crypto.randomBytes(6).toString('hex')}`
  const name = input.name.trim()
  if (!name) {
    throw new Error('Provider profile name is required.')
  }

  const kind = input.kind
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? existing?.baseUrl ?? '')
  const defaultModel = (input.defaultModel ?? existing?.defaultModel ?? '').trim()
  const cliCommand = (input.cliCommand ?? existing?.cliCommand ?? '').trim()
  const cliArgsTemplate = input.cliArgsTemplate ?? existing?.cliArgsTemplate ?? []
  const enabled = input.enabled ?? existing?.enabled ?? true

  const existingEncryptedHeaders = existing ? readDecryptedSensitiveHeaders(id) : {}
  const incomingHeaders = input.extraHeaders ?? existing?.extraHeaders ?? {}
  const { publicHeaders, sensitiveHeaders } = partitionHeaders(
    incomingHeaders,
    existingEncryptedHeaders
  )

  getDb()
    .prepare(
      `INSERT INTO ai_provider_profiles (
        id, name, kind, base_url, default_model, extra_headers_json,
        cli_command, cli_args_json, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        kind = excluded.kind,
        base_url = excluded.base_url,
        default_model = excluded.default_model,
        extra_headers_json = excluded.extra_headers_json,
        cli_command = excluded.cli_command,
        cli_args_json = excluded.cli_args_json,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at`
    )
    .run(
      id,
      name,
      kind,
      baseUrl,
      defaultModel,
      JSON.stringify(publicHeaders),
      cliCommand,
      JSON.stringify(cliArgsTemplate),
      enabled ? 1 : 0,
      existing?.createdAt ?? now,
      now
    )

  if (Object.keys(sensitiveHeaders).length > 0) {
    setSecret(getProfileSensitiveHeadersKeyName(id), JSON.stringify(sensitiveHeaders))
  } else {
    deleteSecret(getProfileSensitiveHeadersKeyName(id))
  }

  if (input.apiKey !== undefined) {
    const trimmedKey = input.apiKey.trim()
    if (trimmedKey) {
      setSecret(getProfileSecretKeyName(id), trimmedKey)
    }
  }

  return getProviderProfileById(id)!
}

export function deleteProviderProfile(id: string): { ok: boolean } {
  getDb().prepare('DELETE FROM ai_provider_profiles WHERE id = ?').run(id)
  deleteSecret(getProfileSecretKeyName(id))
  deleteSecret(getProfileSensitiveHeadersKeyName(id))
  return { ok: true }
}

export function getModelSlots(): AIModelSlots {
  const row = getDb()
    .prepare('SELECT value_json FROM app_kv WHERE key = ?')
    .get(MODEL_SLOTS_KV_KEY) as { value_json: string } | undefined
  if (!row?.value_json) return { ...DEFAULT_MODEL_SLOTS }
  try {
    const parsed = JSON.parse(row.value_json) as Partial<AIModelSlots>
    return {
      primaryProfileId: parsed.primaryProfileId || DEFAULT_MODEL_SLOTS.primaryProfileId,
      primaryModelId: parsed.primaryModelId || DEFAULT_MODEL_SLOTS.primaryModelId,
      backgroundProfileId: parsed.backgroundProfileId || DEFAULT_MODEL_SLOTS.backgroundProfileId,
      backgroundModelId: parsed.backgroundModelId || DEFAULT_MODEL_SLOTS.backgroundModelId
    }
  } catch {
    return { ...DEFAULT_MODEL_SLOTS }
  }
}

export function saveModelSlots(patch: Partial<AIModelSlots>): AIModelSlots {
  const next: AIModelSlots = {
    ...getModelSlots(),
    ...patch
  }
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO app_kv (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
    )
    .run(MODEL_SLOTS_KV_KEY, JSON.stringify(next), now)
  return next
}

function normalizeModelId(raw: string | undefined, fallback: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed || trimmed.toLowerCase().startsWith('default')) return fallback
  // Strip UI suffixes like " · High" or " · Fast"
  const cleaned = trimmed.split('·')[0].trim()
  if (!cleaned || /\s/.test(cleaned)) return fallback
  return cleaned
}

export type ResolvedExecutionTarget =
  | {
      mode: 'sdk'
      model: LanguageModel
      label: string
    }
  | {
      mode: 'cli'
      profile: Pick<AIProviderProfile, 'kind' | 'name' | 'defaultModel' | 'cliCommand' | 'cliArgsTemplate'>
    }
  | null

/**
 * Resolves an AI execution target from either a saved custom profile, a CLI bridge,
 * or a built-in provider (gemini / openai / anthropic / ollama).
 * Secrets are ALWAYS read from the encrypted main-process `secrets` store.
 */
export function resolveExecutionTarget(params: {
  provider: AIProviderKind
  modelId?: string
  profileId?: string
  apiKey?: string
}): ResolvedExecutionTarget {
  const { provider, modelId, profileId, apiKey } = params

  // 1. Explicit saved profile ID (Custom OpenAI-compat, Custom Anthropic-compat, Custom CLI, etc.)
  if (profileId && !profileId.startsWith('builtin:')) {
    const profile = getProviderProfileById(profileId)
    if (profile && profile.enabled) {
      if (isCliProviderKind(profile.kind)) {
        return { mode: 'cli', profile }
      }
      const key = (getSecret(getProfileSecretKeyName(profile.id)) || apiKey || '').trim()
      const mergedHeaders = resolveMergedHeadersForProfile(profile.id, profile.extraHeaders)
      const headersOpt = Object.keys(mergedHeaders).length > 0 ? mergedHeaders : undefined

      if (profile.kind === 'openai-compat') {
        if (!profile.baseUrl) return null
        const normalizedBase = normalizeBaseUrl(profile.baseUrl)
        const chosenModel = normalizeModelId(modelId, profile.defaultModel || 'gpt-4o-mini')
        const openai = createOpenAI({
          baseURL: normalizedBase,
          apiKey: key || 'no-key',
          headers: headersOpt
        })
        return {
          mode: 'sdk',
          model: openai.chat(chosenModel),
          label: `${profile.name} (${chosenModel})`
        }
      }
      if (profile.kind === 'anthropic-compat') {
        if (!profile.baseUrl) return null
        const normalizedBase = normalizeBaseUrl(profile.baseUrl)
        const chosenModel = normalizeModelId(modelId, profile.defaultModel || 'claude-sonnet-4-20250514')
        const anthropic = createAnthropic({
          baseURL: normalizedBase,
          apiKey: key || 'no-key',
          headers: headersOpt
        })
        return {
          mode: 'sdk',
          model: anthropic(chosenModel),
          label: `${profile.name} (${chosenModel})`
        }
      }
    }
  }

  // 2. Direct built-in CLI bridge kinds (Zero-API-Key!)
  if (provider === 'cli-claude') {
    return {
      mode: 'cli',
      profile: {
        kind: 'cli-claude',
        name: 'Claude Code CLI',
        defaultModel: normalizeModelId(modelId, 'sonnet'),
        cliCommand: 'claude',
        cliArgsTemplate: []
      }
    }
  }
  if (provider === 'cli-gemini') {
    return {
      mode: 'cli',
      profile: {
        kind: 'cli-gemini',
        name: 'Gemini CLI',
        defaultModel: normalizeModelId(modelId, ''),
        cliCommand: 'gemini',
        cliArgsTemplate: []
      }
    }
  }
  if (provider === 'cli-codex') {
    return {
      mode: 'cli',
      profile: {
        kind: 'cli-codex',
        name: 'Codex CLI',
        defaultModel: normalizeModelId(modelId, ''),
        cliCommand: 'codex',
        cliArgsTemplate: []
      }
    }
  }

  // 3. Built-in SDK providers (with dynamic modelId support!)
  const storedSecret = getSecret(getProviderSecretKeyName(provider))
  const rawKey = (storedSecret || apiKey || '').trim()

  if (provider === 'ollama') {
    const baseInput = rawKey || 'http://localhost:11434'
    const normalizedBase = baseInput.startsWith('http')
      ? baseInput.endsWith('/v1')
        ? baseInput
        : `${baseInput.replace(/\/+$/, '')}/v1`
      : 'http://localhost:11434/v1'
    const ollama = createOpenAI({
      baseURL: normalizedBase,
      apiKey: 'ollama'
    })
    const fallbackOllama = (modelId || '').toLowerCase().includes('llama') ? 'llama3.2' : 'qwen2.5-coder'
    const modelName = normalizeModelId(modelId, fallbackOllama)
    return {
      mode: 'sdk',
      model: ollama.chat(modelName),
      label: `Ollama (${modelName})`
    }
  }

  if (!rawKey) return null

  if (provider === 'openai') {
    const openai = createOpenAI({ apiKey: rawKey })
    const chosenModel = normalizeModelId(modelId, 'gpt-4o-mini')
    return {
      mode: 'sdk',
      model: openai(chosenModel),
      label: `OpenAI (${chosenModel})`
    }
  }

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: rawKey })
    const chosenModel = normalizeModelId(modelId, 'claude-sonnet-4-20250514')
    return {
      mode: 'sdk',
      model: anthropic(chosenModel),
      label: `Anthropic (${chosenModel})`
    }
  }

  const google = createGoogleGenerativeAI({ apiKey: rawKey })
  const chosenModel = normalizeModelId(modelId, 'gemini-2.5-flash')
  return {
    mode: 'sdk',
    model: google(chosenModel),
    label: `Google Gemini (${chosenModel})`
  }
}

async function runLiveOneTokenPing(model: LanguageModel): Promise<{ ok: boolean; error?: string }> {
  try {
    await generateText({
      model,
      prompt: 'Reply with OK.',
      maxOutputTokens: 4
    })
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: redactSecrets(err instanceof Error ? err.message : String(err))
    }
  }
}

function extractModelsFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>

  // OpenAI / Anthropic / OpenRouter format: { data: [{ id: "..." }] }
  if (Array.isArray(obj.data)) {
    return obj.data
      .map((item) => (item && typeof item === 'object' ? String((item as Record<string, unknown>).id || '') : ''))
      .filter(Boolean)
      .slice(0, 60)
  }

  // Gemini format: { models: [{ name: "models/gemini-2.5-flash" }] }
  // Ollama format: { models: [{ name: "qwen2.5-coder:latest" }] }
  if (Array.isArray(obj.models)) {
    return obj.models
      .map((item) => {
        if (!item || typeof item !== 'object') return ''
        const rawName = String((item as Record<string, unknown>).name || (item as Record<string, unknown>).id || '')
        return rawName.replace(/^models\//, '')
      })
      .filter(Boolean)
      .slice(0, 60)
  }

  return []
}

/**
 * Tests a built-in provider (gemini / openai / anthropic / ollama) live.
 */
export async function testBuiltinProvider(
  provider: 'gemini' | 'openai' | 'anthropic' | 'ollama',
  modelId?: string
): Promise<AIProviderTestResult> {
  const started = Date.now()
  const storedKey = getSecret(getProviderSecretKeyName(provider)) || ''

  if (provider !== 'ollama' && !storedKey.trim()) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: `No API key saved for ${provider}. Save an encrypted key first.`
    }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    let res: Response
    if (provider === 'ollama') {
      const base = (storedKey.trim() || 'http://localhost:11434').replace(/\/v1\/?$/, '').replace(/\/+$/, '')
      res = await fetch(`${base}/api/tags`, { method: 'GET', signal: controller.signal })
    } else if (provider === 'gemini') {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(storedKey.trim())}`,
        { method: 'GET', signal: controller.signal }
      )
    } else if (provider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': storedKey.trim(),
          'anthropic-version': '2023-06-01'
        },
        signal: controller.signal
      })
    } else {
      res = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${storedKey.trim()}` },
        signal: controller.signal
      })
    }
    clearTimeout(timer)

    if (res.ok) {
      let models: string[] = []
      try {
        models = extractModelsFromPayload(await res.json())
      } catch {
        // non-JSON ok response
      }
      return {
        ok: true,
        latencyMs: Date.now() - started,
        message:
          models.length > 0
            ? `Connected! Discovered ${models.length} model(s).`
            : 'Connected successfully.',
        models
      }
    }

    // If /models returned 404/405, fallback to 1-token live completion
    if (res.status === 404 || res.status === 405) {
      const target = resolveExecutionTarget({ provider, modelId })
      if (target?.mode === 'sdk') {
        const ping = await runLiveOneTokenPing(target.model)
        return {
          ok: ping.ok,
          latencyMs: Date.now() - started,
          message: ping.ok ? `Connected via live completion (${target.label}).` : ping.error || 'Live test failed.'
        }
      }
    }

    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: redactSecrets(`HTTP ${res.status} ${res.statusText}`)
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: redactSecrets(err instanceof Error ? err.message : String(err))
    }
  }
}

export async function testProviderProfile(
  profileOrId: string | AIProviderProfileInput
): Promise<AIProviderTestResult> {
  const started = Date.now()
  const profile =
    typeof profileOrId === 'string'
      ? getProviderProfileById(profileOrId)
      : {
          id: profileOrId.id || '',
          name: profileOrId.name,
          kind: profileOrId.kind,
          baseUrl: profileOrId.baseUrl || '',
          defaultModel: profileOrId.defaultModel || '',
          extraHeaders: profileOrId.extraHeaders || {},
          cliCommand: profileOrId.cliCommand || '',
          cliArgsTemplate: profileOrId.cliArgsTemplate || [],
          enabled: true,
          hasApiKey: Boolean(profileOrId.apiKey),
          createdAt: 0,
          updatedAt: 0
        }

  if (!profile) {
    return { ok: false, latencyMs: Date.now() - started, message: 'Provider profile not found.' }
  }

  if (isCliProviderKind(profile.kind)) {
    const bridges = await detectCliBridges()
    const targetCmd =
      profile.cliCommand ||
      (profile.kind === 'cli-claude'
        ? 'claude'
        : profile.kind === 'cli-gemini'
          ? 'gemini'
          : profile.kind === 'cli-codex'
            ? 'codex'
            : '')
    const match = bridges.find((b) => b.command === targetCmd)
    if (match?.available) {
      return {
        ok: true,
        latencyMs: Date.now() - started,
        message: `Found ${match.command} (${match.version || match.path || 'available'})`
      }
    }
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: `CLI "${targetCmd || 'unknown'}" not found in PATH.`
    }
  }

  const apiKey =
    (typeof profileOrId !== 'string' && profileOrId.apiKey?.trim()) ||
    (profile.id ? getSecret(getProfileSecretKeyName(profile.id)) : null) ||
    ''

  const baseUrl = normalizeBaseUrl(profile.baseUrl)
  if (!baseUrl) {
    return { ok: false, latencyMs: Date.now() - started, message: 'Base URL is required.' }
  }

  const headers: Record<string, string> = profile.id
    ? resolveMergedHeadersForProfile(profile.id, profile.extraHeaders)
    : { ...profile.extraHeaders }

  if (apiKey) {
    if (profile.kind === 'anthropic-compat') {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = headers['anthropic-version'] || '2023-06-01'
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
  }

  try {
    const probeUrl = buildModelsProbeUrl(profile.kind, baseUrl)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(probeUrl, { method: 'GET', headers, signal: controller.signal })
    clearTimeout(timer)

    if (res.ok) {
      let models: string[] = []
      try {
        models = extractModelsFromPayload(await res.json())
      } catch {
        // non-JSON ok response
      }
      return {
        ok: true,
        latencyMs: Date.now() - started,
        message:
          models.length > 0
            ? `Connected! Discovered ${models.length} model(s).`
            : 'Endpoint reachable and authenticated.',
        models
      }
    }

    // Many third-party gateways (MiniMax, GLM, proxies) don't implement GET /models (404/405).
    // Fall back to a real 1-token completion against the configured default model.
    if (res.status === 404 || res.status === 405 || res.status === 501) {
      const modelName = profile.defaultModel || (profile.kind === 'anthropic-compat' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini')
      const headersOpt = Object.keys(headers).length > 0 ? headers : undefined
      const model =
        profile.kind === 'anthropic-compat'
          ? createAnthropic({ baseURL: baseUrl, apiKey: apiKey || 'no-key', headers: headersOpt })(modelName)
          : createOpenAI({ baseURL: baseUrl, apiKey: apiKey || 'no-key', headers: headersOpt }).chat(modelName)

      const ping = await runLiveOneTokenPing(model)
      return {
        ok: ping.ok,
        latencyMs: Date.now() - started,
        message: ping.ok
          ? `Connected via live 1-token test (${modelName}).`
          : ping.error || `HTTP ${res.status} ${res.statusText}`
      }
    }

    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: redactSecrets(`HTTP ${res.status} ${res.statusText}`)
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: redactSecrets(err instanceof Error ? err.message : String(err))
    }
  }
}

export async function fetchProviderModels(input: {
  profileId?: string
  builtinProvider?: 'gemini' | 'openai' | 'anthropic' | 'ollama'
}): Promise<{ ok: boolean; models: string[]; error?: string }> {
  if (input.builtinProvider) {
    const res = await testBuiltinProvider(input.builtinProvider)
    return { ok: res.ok, models: res.models || [], error: res.ok ? undefined : res.message }
  }
  if (input.profileId) {
    const res = await testProviderProfile(input.profileId)
    return { ok: res.ok, models: res.models || [], error: res.ok ? undefined : res.message }
  }
  return { ok: false, models: [], error: 'No provider specified.' }
}
