import { describe, expect, it } from 'vitest'
import {
  APP_SHORTCUTS,
  SHORTCUT_BY_ID,
  findMatchingShortcut,
  formatShortcutKeys,
  getShortcutsByCategory,
  matchesShortcutEvent,
  type ShortcutCombo,
  type ShortcutKeyEventLike
} from './shortcuts'

function keyEvent(overrides: Partial<ShortcutKeyEventLike> = {}): ShortcutKeyEventLike {
  return {
    key: '',
    code: undefined,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
    defaultPrevented: false,
    ...overrides
  }
}

function comboSignature(c: ShortcutCombo): string {
  return [
    c.ctrlOnly ? 'ctrlOnly' : c.mod ? 'mod' : 'nomod',
    c.shift ? 'shift' : 'noshift',
    c.alt ? 'alt' : 'noalt',
    c.key.toLowerCase()
  ].join('+')
}

describe('shortcuts registry', () => {
  it('defines all 21 required shortcuts with unique IDs and non-empty English metadata', () => {
    expect(APP_SHORTCUTS.length).toBe(21)
    const ids = new Set(APP_SHORTCUTS.map((s) => s.id))
    expect(ids.size).toBe(APP_SHORTCUTS.length)

    for (const shortcut of APP_SHORTCUTS) {
      expect(shortcut.label.trim().length).toBeGreaterThan(0)
      expect(shortcut.description.trim().length).toBeGreaterThan(0)
      expect(shortcut.keys.trim().length).toBeGreaterThan(0)
      expect(shortcut.keyTokens.length).toBeGreaterThan(0)
    }
  })

  it('has zero colliding key combos across all shortcuts (especially Ctrl+Shift+D vs Ctrl+Alt+D)', () => {
    const seen = new Map<string, string>()
    for (const shortcut of APP_SHORTCUTS) {
      const combos = [shortcut.combo, ...(shortcut.altCombos ?? [])]
      for (const c of combos) {
        const sig = comboSignature(c)
        expect(seen.has(sig), `Collision on ${sig} between ${seen.get(sig)} and ${shortcut.id}`).toBe(false)
        seen.set(sig, shortcut.id)
      }
    }

    expect(SHORTCUT_BY_ID['dispatch-spec'].keys).toBe('Ctrl+Shift+D')
    expect(SHORTCUT_BY_ID['open-daily-note'].keys).toBe('Ctrl+Alt+D')
    expect(SHORTCUT_BY_ID['open-daily-note'].electronAccelerator).toBe('CommandOrControl+Alt+D')
  })

  it('matches Ctrl+Shift+D only for dispatch-spec and Ctrl+Alt+D only for open-daily-note', () => {
    const shiftD = keyEvent({ key: 'd', ctrlKey: true, shiftKey: true })
    const altD = keyEvent({ key: 'd', ctrlKey: true, altKey: true })
    const plainD = keyEvent({ key: 'd', ctrlKey: true })

    expect(matchesShortcutEvent(shiftD, 'dispatch-spec')).toBe(true)
    expect(matchesShortcutEvent(shiftD, 'open-daily-note')).toBe(false)

    expect(matchesShortcutEvent(altD, 'open-daily-note')).toBe(true)
    expect(matchesShortcutEvent(altD, 'dispatch-spec')).toBe(false)

    expect(matchesShortcutEvent(plainD, 'dispatch-spec')).toBe(false)
    expect(matchesShortcutEvent(plainD, 'open-daily-note')).toBe(false)
  })

  it('matches Ctrl+/ via Slash code or key and rejects Ctrl+Shift+/ (Ctrl+?)', () => {
    expect(
      matchesShortcutEvent(keyEvent({ key: '/', code: 'Slash', ctrlKey: true }), 'shortcut-cheatsheet')
    ).toBe(true)

    expect(
      matchesShortcutEvent(
        keyEvent({ key: '?', code: 'Slash', ctrlKey: true, shiftKey: false }),
        'shortcut-cheatsheet'
      )
    ).toBe(true)

    expect(
      matchesShortcutEvent(
        keyEvent({ key: '?', code: 'Slash', ctrlKey: true, shiftKey: true }),
        'shortcut-cheatsheet'
      )
    ).toBe(false)
  })

  it('matches Ctrl+` via Backquote code or key and ~ fallback', () => {
    expect(
      matchesShortcutEvent(keyEvent({ key: '`', code: 'Backquote', ctrlKey: true }), 'toggle-terminal')
    ).toBe(true)

    expect(
      matchesShortcutEvent(keyEvent({ key: '`', code: 'IntlBackslash', ctrlKey: true }), 'toggle-terminal')
    ).toBe(true)

    expect(
      matchesShortcutEvent(keyEvent({ key: '~', ctrlKey: true }), 'toggle-terminal')
    ).toBe(true)
  })

  it('matches Ctrl+Z vs Ctrl+Shift+Z vs Ctrl+Y cleanly', () => {
    const undoEv = keyEvent({ key: 'z', ctrlKey: true })
    const redoShiftZ = keyEvent({ key: 'Z', ctrlKey: true, shiftKey: true })
    const redoY = keyEvent({ key: 'y', metaKey: true })

    expect(matchesShortcutEvent(undoEv, 'undo')).toBe(true)
    expect(matchesShortcutEvent(undoEv, 'redo')).toBe(false)
    expect(matchesShortcutEvent(redoShiftZ, 'redo')).toBe(true)
    expect(matchesShortcutEvent(redoShiftZ, 'undo')).toBe(false)
    expect(matchesShortcutEvent(redoY, 'redo')).toBe(true)
  })

  it('requires ctrlKey (not metaKey) for Ctrl+Tab and Ctrl+Shift+Tab', () => {
    expect(matchesShortcutEvent(keyEvent({ key: 'Tab', ctrlKey: true }), 'next-tab')).toBe(true)
    expect(matchesShortcutEvent(keyEvent({ key: 'Tab', metaKey: true }), 'next-tab')).toBe(false)
    expect(
      matchesShortcutEvent(keyEvent({ key: 'Tab', ctrlKey: true, shiftKey: true }), 'prev-tab')
    ).toBe(true)
    expect(
      matchesShortcutEvent(keyEvent({ key: 'Tab', metaKey: true, shiftKey: true }), 'prev-tab')
    ).toBe(false)
  })

  it('never matches while IME composition is active', () => {
    expect(
      matchesShortcutEvent(keyEvent({ key: 'k', ctrlKey: true, isComposing: true }), 'command-palette')
    ).toBe(false)
    expect(
      findMatchingShortcut(keyEvent({ key: '/', code: 'Slash', ctrlKey: true, isComposing: true }))
    ).toBeNull()
  })

  it('never matches events with defaultPrevented: true', () => {
    expect(
      matchesShortcutEvent(
        keyEvent({ key: 'k', ctrlKey: true, defaultPrevented: true }),
        'command-palette'
      )
    ).toBe(false)
    expect(
      matchesShortcutEvent(keyEvent({ key: 'z', ctrlKey: true, defaultPrevented: true }), 'undo')
    ).toBe(false)
    expect(
      findMatchingShortcut(keyEvent({ key: 'z', ctrlKey: true, defaultPrevented: true }))
    ).toBeNull()
    expect(
      findMatchingShortcut(
        keyEvent({ key: '/', code: 'Slash', ctrlKey: true, defaultPrevented: true })
      )
    ).toBeNull()
  })

  it('formats shortcut keys for Windows/Linux and macOS and groups by category', () => {
    expect(formatShortcutKeys('command-palette', 'win')).toBe('Ctrl+K')
    expect(formatShortcutKeys('command-palette', 'mac')).toBe('⌘K')
    expect(formatShortcutKeys('dispatch-spec', 'mac')).toBe('⌘⇧D')
    expect(formatShortcutKeys('open-daily-note', 'mac')).toBe('⌘⌥D')

    const groups = getShortcutsByCategory()
    expect(groups.length).toBe(5)
    const total = groups.reduce((sum, g) => sum + g.items.length, 0)
    expect(total).toBe(APP_SHORTCUTS.length)
  })
})
