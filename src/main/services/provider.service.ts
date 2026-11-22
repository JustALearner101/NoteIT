import crypto from 'node:crypto'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import type {
  AIModelSlots,
  AIProviderKind,
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
  setSecret
} from './secret.service'
import { detectCliBridges } from './cli-bridge/cli-bridge.service'

const MODEL_SLOTS_KV_KEY = 'ai.model_slots'

const DEFAULT_MODEL_SLOTS: AIModelSlots = {
  primaryProfileId: 'builtin:gemini',
  primaryModelId: 'gemini-2.5-flash',
  backgroundProfileId: 'builtin:gemini',
  backgroundModelId: 'gemini-2.5-flash'
}

export function getProfileSecretKeyName(profileId: string): string {
  return `ai.profile.${profileId.trim()}`
}

export function isCliProviderKind(kind: AIProviderKind): boolean {
  return (
    kind === 'cli-claude' ||
    kind === 'cli-gemini' ||
    kind === 'cli-codex' ||
    kind === 'cli-custom'
  )
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
  let extraHeaders: Record<string, string> = {}
  let cliArgsTemplate: string[] = []
  try {
    const parsed = JSON.parse(row.extra_headers_json || '{}')
    if (parsed && typeof parsed === 'object') extraHeaders = parsed
  } catch {
    extraHeaders = {}
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
    extraHeaders,
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
  const baseUrl = (input.baseUrl ?? existing?.baseUrl ?? '').trim()
  const defaultModel = (input.defaultModel ?? existing?.defaultModel ?? '').trim()
  const extraHeaders = input.extraHeaders ?? existing?.extraHeaders ?? {}
  const cliCommand = (input.cliCommand ?? existing?.cliCommand ?? '').trim()
  const cliArgsTemplate = input.cliArgsTemplate ?? existing?.cliArgsTemplate ?? []
  const enabled = input.enabled ?? existing?.enabled ?? true

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
      JSON.stringify(extraHeaders),
      cliCommand,
      JSON.stringify(cliArgsTemplate),
      enabled ? 1 : 0,
      existing?.createdAt ?? now,
      now
    )

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
      if (profile.kind === 'openai-compat') {
        if (!profile.baseUrl) return null
        const normalizedBase = profile.baseUrl.replace(/\/+$/, '')
        const chosenModel = normalizeModelId(modelId, profile.defaultModel || 'gpt-4o-mini')
        const openai = createOpenAI({
          baseURL: normalizedBase,
          apiKey: key || 'no-key',
          headers: Object.keys(profile.extraHeaders).length > 0 ? profile.extraHeaders : undefined
        })
        return {
          mode: 'sdk',
          model: openai.chat(chosenModel),
          label: `${profile.name} (${chosenModel})`
        }
      }
      if (profile.kind === 'anthropic-compat') {
        if (!profile.baseUrl) return null
        const normalizedBase = profile.baseUrl.replace(/\/+$/, '')
        const chosenModel = normalizeModelId(modelId, profile.defaultModel || 'claude-sonnet-4-20250514')
        const anthropic = createAnthropic({
          baseURL: normalizedBase,
          apiKey: key || 'no-key',
          headers: Object.keys(profile.extraHeaders).length > 0 ? profile.extraHeaders : undefined
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
  if (!rawKey) return null

  if (provider === 'ollama') {
    const normalizedBase = rawKey.startsWith('http')
      ? rawKey.endsWith('/v1')
        ? rawKey
        : `${rawKey.replace(/\/+$/, '')}/v1`
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
      label: `Vercel AI SDK · Ollama (${modelName})`
    }
  }

  if (provider === 'openai') {
    const openai = createOpenAI({ apiKey: rawKey })
    const chosenModel = normalizeModelId(modelId, 'gpt-4o-mini')
    return {
      mode: 'sdk',
      model: openai(chosenModel),
      label: `Vercel AI SDK · OpenAI (${chosenModel})`
    }
  }

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: rawKey })
    const chosenModel = normalizeModelId(modelId, 'claude-3-5-sonnet-latest')
    return {
      mode: 'sdk',
      model: anthropic(chosenModel),
      label: `Vercel AI SDK · Anthropic (${chosenModel})`
    }
  }

  const google = createGoogleGenerativeAI({ apiKey: rawKey })
  const chosenModel = normalizeModelId(modelId, 'gemini-2.5-flash')
  return {
    mode: 'sdk',
    model: google(chosenModel),
    label: `Vercel AI SDK · Google Gemini (${chosenModel})`
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

  const baseUrl = profile.baseUrl.replace(/\/+$/, '')
  if (!baseUrl) {
    return { ok: false, latencyMs: Date.now() - started, message: 'Base URL is required.' }
  }

  try {
    const probeUrl =
      profile.kind === 'anthropic-compat' ? `${baseUrl}/v1/models` : `${baseUrl}/models`
    const headers: Record<string, string> = { ...profile.extraHeaders }
    if (apiKey) {
      if (profile.kind === 'anthropic-compat') {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = headers['anthropic-version'] || '2023-06-01'
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`
      }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(probeUrl, { method: 'GET', headers, signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: `HTTP ${res.status} from ${probeUrl}`
      }
    }

    const json = (await res.json().catch(() => null)) as { data?: Array<{ id?: string }> } | null
    const models = Array.isArray(json?.data)
      ? json.data.map((m) => m.id).filter((id): id is string => Boolean(id)).slice(0, 20)
      : undefined

    return {
      ok: true,
      latencyMs: Date.now() - started,
      message: models?.length
        ? `Connected (${models.length} models discovered)`
        : 'Endpoint reachable (HTTP 200)',
      models
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : String(err)
    }
  }
}
