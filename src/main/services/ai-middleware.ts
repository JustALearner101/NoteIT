import { extractReasoningMiddleware, wrapLanguageModel, type LanguageModel } from 'ai'
import type { AIProviderKind } from '@shared/types/domain'
import {
  getModelSlots,
  getProviderProfileById,
  resolveExecutionTarget,
  type ResolvedExecutionTarget
} from './provider.service'

/**
 * Wraps a Vercel AI SDK v7 LanguageModel with `extractReasoningMiddleware`
 * so models that emit `<think>...</think>` blocks stream reasoning cleanly as
 * structured `reasoning-delta` parts alongside native reasoning providers.
 */
export function wrapWithReasoningMiddleware(model: LanguageModel): LanguageModel {
  if (typeof model === 'string') return model
  try {
    return wrapLanguageModel({
      model: model as any,
      middleware: extractReasoningMiddleware({ tagName: 'think' })
    })
  } catch {
    return model
  }
}

/**
 * Resolves the configured Background slot as an automatic fallback target
 * when the Primary provider fails due to rate limits, quota, or transient errors.
 */
export function resolveFallbackTarget(primaryKey: string): {
  target: ResolvedExecutionTarget
  label: string
} | null {
  const slots = getModelSlots()
  const bgProfileId = slots.backgroundProfileId
  const bgModelId = slots.backgroundModelId
  const fallbackKey = `${bgProfileId}:${bgModelId}`

  if (!bgProfileId || fallbackKey === primaryKey) {
    return null
  }

  let provider: AIProviderKind = 'gemini'
  if (bgProfileId.startsWith('builtin:')) {
    provider = bgProfileId.replace('builtin:', '') as AIProviderKind
  } else {
    const prof = getProviderProfileById(bgProfileId)
    if (prof) provider = prof.kind
  }

  const target = resolveExecutionTarget({
    provider,
    profileId: bgProfileId,
    modelId: bgModelId
  })

  if (!target) return null
  const label =
    target.mode === 'sdk'
      ? target.label
      : `CLI Bridge · ${target.profile.name}${bgModelId ? ` (${bgModelId})` : ''}`
  return { target, label }
}
