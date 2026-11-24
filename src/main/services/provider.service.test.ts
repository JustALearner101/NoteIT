import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, getDb, initDatabase } from '../db/client'
import {
  buildModelsProbeUrl,
  deleteProviderProfile,
  getModelSlots,
  getProfileSecretKeyName,
  getProfileSensitiveHeadersKeyName,
  listProviderProfiles,
  resolveExecutionTarget,
  saveModelSlots,
  THIRD_PARTY_PROVIDER_PRESETS,
  upsertProviderProfile
} from './provider.service'
import { hasSecret } from './secret.service'

describe('provider.service (Unified AI Provider Registry & Security)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-prov-test-'))
    initDatabase(tmpDir)
  })

  afterEach(() => {
    closeDb()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates, lists, resolves, and deletes OpenAI-compatible and Anthropic-compatible profiles with encrypted secrets', () => {
    const openRouter = upsertProviderProfile({
      name: 'OpenRouter',
      kind: 'openai-compat',
      baseUrl: 'https://openrouter.ai/api/v1/',
      defaultModel: 'deepseek/deepseek-chat',
      apiKey: 'sk-or-test-1234',
      extraHeaders: {
        'HTTP-Referer': 'https://noteit.local',
        Authorization: 'Bearer super-secret-header-token'
      }
    })

    // Sensitive headers must be encrypted in `secrets` and NEVER stored plaintext in `ai_provider_profiles`
    expect(hasSecret(getProfileSensitiveHeadersKeyName(openRouter.id))).toBe(true)
    const rawRow = getDb()
      .prepare('SELECT extra_headers_json FROM ai_provider_profiles WHERE id = ?')
      .get(openRouter.id) as { extra_headers_json: string }
    expect(rawRow.extra_headers_json).not.toContain('super-secret-header-token')
    expect(openRouter.extraHeaders['HTTP-Referer']).toBe('https://noteit.local')
    expect(openRouter.extraHeaders['Authorization']).toBe('__ENCRYPTED__')

    const miniMax = upsertProviderProfile({
      name: 'Anthropic Proxy',
      kind: 'anthropic-compat',
      baseUrl: 'https://api.example-anthropic.local',
      defaultModel: 'claude-sonnet-4-20250514',
      apiKey: 'sk-ant-proxy-9999'
    })

    const all = listProviderProfiles()
    expect(all).toHaveLength(2)
    expect(all[0].hasApiKey).toBe(true)
    expect(hasSecret(getProfileSecretKeyName(openRouter.id))).toBe(true)
    expect(hasSecret(getProfileSecretKeyName(miniMax.id))).toBe(true)

    const resolvedOpenAI = resolveExecutionTarget({
      provider: 'openai-compat',
      profileId: openRouter.id,
      modelId: 'deepseek/deepseek-r1'
    })
    expect(resolvedOpenAI?.mode).toBe('sdk')
    if (resolvedOpenAI?.mode === 'sdk') {
      expect(resolvedOpenAI.label).toContain('OpenRouter')
      expect(resolvedOpenAI.label).toContain('deepseek/deepseek-r1')
    }

    const resolvedAnthropic = resolveExecutionTarget({
      provider: 'anthropic-compat',
      profileId: miniMax.id,
      modelId: ''
    })
    expect(resolvedAnthropic?.mode).toBe('sdk')
    if (resolvedAnthropic?.mode === 'sdk') {
      expect(resolvedAnthropic.label).toContain('Anthropic Proxy')
      expect(resolvedAnthropic.label).toContain('claude-sonnet-4-20250514')
    }

    deleteProviderProfile(openRouter.id)
    expect(listProviderProfiles()).toHaveLength(1)
    expect(hasSecret(getProfileSecretKeyName(openRouter.id))).toBe(false)
    expect(hasSecret(getProfileSensitiveHeadersKeyName(openRouter.id))).toBe(false)
  })

  it('normalizes /models probe URLs without duplicating /v1', () => {
    expect(buildModelsProbeUrl('anthropic-compat', 'https://api.minimax.io/anthropic/v1/')).toBe(
      'https://api.minimax.io/anthropic/v1/models'
    )
    expect(buildModelsProbeUrl('anthropic-compat', 'https://api.anthropic.com')).toBe(
      'https://api.anthropic.com/v1/models'
    )
    expect(buildModelsProbeUrl('openai-compat', 'https://openrouter.ai/api/v1/')).toBe(
      'https://openrouter.ai/api/v1/models'
    )
    expect(THIRD_PARTY_PROVIDER_PRESETS.some((p) => p.id === 'openrouter')).toBe(true)
    expect(THIRD_PARTY_PROVIDER_PRESETS.some((p) => p.id === 'deepseek')).toBe(true)
  })

  it('resolves built-in CLI bridge targets without requiring any API key', () => {
    const claudeCli = resolveExecutionTarget({
      provider: 'cli-claude',
      modelId: 'opus'
    })
    expect(claudeCli?.mode).toBe('cli')
    if (claudeCli?.mode === 'cli') {
      expect(claudeCli.profile.cliCommand).toBe('claude')
      expect(claudeCli.profile.defaultModel).toBe('opus')
    }

    const customCli = upsertProviderProfile({
      name: 'Antigravity CLI',
      kind: 'cli-custom',
      cliCommand: 'agy',
      cliArgsTemplate: ['-p', '{{prompt}}'],
      defaultModel: 'gemini-3-pro'
    })
    const resolvedCustom = resolveExecutionTarget({
      provider: 'cli-custom',
      profileId: customCli.id
    })
    expect(resolvedCustom?.mode).toBe('cli')
    if (resolvedCustom?.mode === 'cli') {
      expect(resolvedCustom.profile.cliCommand).toBe('agy')
    }
  })

  it('persists and retrieves Primary & Background model slots', () => {
    const initial = getModelSlots()
    expect(initial.primaryProfileId).toBe('builtin:gemini')

    const updated = saveModelSlots({
      primaryProfileId: 'builtin:cli-claude',
      primaryModelId: 'sonnet',
      backgroundProfileId: 'builtin:ollama',
      backgroundModelId: 'qwen2.5-coder'
    })
    expect(updated.primaryProfileId).toBe('builtin:cli-claude')
    expect(updated.backgroundModelId).toBe('qwen2.5-coder')
    expect(getModelSlots()).toEqual(updated)
  })
})
