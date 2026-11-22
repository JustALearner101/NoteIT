import { describe, expect, it } from 'vitest'
import {
  buildOfflineIntelligentUiFallback,
  extractOpenUiArtifact,
  routePresentationMode
} from './ui-router.service'

describe('ui-router.service (Intelligent UI Presentation Router)', () => {
  it('routes simulation prompts to sandbox-html, calculator/chart prompts to openui, and plain questions to markdown', () => {
    expect(routePresentationMode('Build a 3D airplane pitch roll yaw simulation', 'auto')).toBe(
      'sandbox-html'
    )
    expect(routePresentationMode('Buat kalkulator cicilan dengan slider', 'auto')).toBe('openui')
    expect(routePresentationMode('What is SQLite WAL?', 'auto')).toBe('markdown')
    expect(routePresentationMode('What is SQLite WAL?', 'intelligent-ui')).toBe('openui')
    expect(routePresentationMode('Build a 3D simulation', 'markdown')).toBe('markdown')
  })

  it('extracts fenced ```openui blocks cleanly from assistant responses', () => {
    const raw =
      'Here is your interactive comparison:\n\n```openui\nroot = Card([Title("SQLite vs Postgres")])\n```\n\nHope that helps!'
    const { prose, artifact } = extractOpenUiArtifact(raw)
    expect(prose).toContain('Here is your interactive comparison:')
    expect(prose).not.toContain('```openui')
    expect(artifact?.kind).toBe('openui')
    expect(artifact?.openuiSource).toBe('root = Card([Title("SQLite vs Postgres")])')
  })

  it('provides offline fallback artifacts for both openui and sandbox-html', () => {
    const openui = buildOfflineIntelligentUiFallback('loan calculator', 'openui')
    expect(openui?.artifact.kind).toBe('openui')
    expect(openui?.artifact.openuiSource).toContain('root =')

    const sandbox = buildOfflineIntelligentUiFallback('wave simulation', 'sandbox-html')
    expect(sandbox?.artifact.kind).toBe('sandbox-html')
    expect(sandbox?.artifact.sandbox?.html).toContain('<canvas')
  })
})
