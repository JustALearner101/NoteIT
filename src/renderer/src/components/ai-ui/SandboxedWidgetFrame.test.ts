import { describe, expect, it } from 'vitest'
import { parseWidgetPostMessage } from './SandboxedWidgetFrame'

describe('SandboxedWidgetFrame postMessage allowlist', () => {
  it('accepts valid noteit-widget-action messages and clamps resize heights', () => {
    expect(
      parseWidgetPostMessage({
        type: 'noteit-widget-action',
        action: 'follow-up',
        payload: 'Explain this graph'
      })
    ).toEqual({ action: 'follow-up', payload: 'Explain this graph' })

    expect(
      parseWidgetPostMessage({
        type: 'noteit-widget-action',
        action: 'resize',
        payload: 1200
      })
    ).toEqual({ action: 'resize', payload: 720 })
  })

  it('rejects unknown message types, arbitrary actions, and empty payloads', () => {
    expect(parseWidgetPostMessage({ type: 'other', action: 'follow-up', payload: 'hi' })).toBeNull()
    expect(
      parseWidgetPostMessage({ type: 'noteit-widget-action', action: 'exec', payload: 'rm -rf' })
    ).toBeNull()
    expect(
      parseWidgetPostMessage({ type: 'noteit-widget-action', action: 'follow-up', payload: '   ' })
    ).toBeNull()
  })
})
