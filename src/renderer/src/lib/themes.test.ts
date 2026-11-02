import { describe, expect, it } from 'vitest'
import {
  BUILTIN_THEMES,
  DEFAULT_PREFERENCES,
  resolveThemeById,
  type ThemeDefinition
} from './themes'

describe('themes engine', () => {
  it('memuat 9 preset bawaan termasuk Orca Carbon, Code.Zone Amber, dan Finns Cosmic Nebula', () => {
    expect(BUILTIN_THEMES.length).toBeGreaterThanOrEqual(8)
    const ids = BUILTIN_THEMES.map((t) => t.id)
    expect(ids).toContain('graphite-slate')
    expect(ids).toContain('archival-vellum')
    expect(ids).toContain('orca-carbon')
    expect(ids).toContain('codezone-amber')
    expect(ids).toContain('finns-nebula')
  })

  it('resolveThemeById mengembalikan preset bawaan yang cocok', () => {
    const finns = resolveThemeById('finns-nebula')
    expect(finns.name).toBe('Finns Cosmic Nebula')
    expect(finns.ambientGlow).toBe(true)
  })

  it('resolveThemeById mengembalikan tema kustom jika ditemukan', () => {
    const custom: ThemeDefinition = {
      id: 'custom-cyber',
      name: 'Cyber Custom',
      tagline: 'Custom test',
      colorScheme: 'dark',
      ambientGlow: true,
      isCustom: true,
      colors: BUILTIN_THEMES[0].colors
    }
    const resolved = resolveThemeById('custom-cyber', [custom])
    expect(resolved.id).toBe('custom-cyber')
    expect(resolved.name).toBe('Cyber Custom')
  })

  it('resolveThemeById jatuh ke tema default bila id tidak dikenal', () => {
    const fallback = resolveThemeById('tidak-ada')
    expect(fallback.id).toBe(DEFAULT_PREFERENCES.activeThemeId)
  })
})
