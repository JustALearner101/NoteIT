export type ShortcutCategory = 'navigation' | 'workspace' | 'ade' | 'editor' | 'global'

export type ShortcutScope = 'global' | 'renderer' | 'workbench' | 'settings' | 'drawer'

export interface ShortcutCombo {
  key: string
  codes?: readonly string[]
  mod?: boolean // ctrlKey || metaKey
  ctrlOnly?: boolean // ctrlKey && !metaKey (e.g. Ctrl+Tab)
  shift?: boolean
  alt?: boolean
}

export interface ShortcutKeyEventLike {
  key: string
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  isComposing?: boolean
  defaultPrevented?: boolean
}

export type ShortcutId =
  | 'command-palette'
  | 'shortcut-cheatsheet'
  | 'toggle-settings'
  | 'settings-search'
  | 'toggle-ai-chat'
  | 'toggle-ai-split'
  | 'toggle-browser'
  | 'toggle-mission-control'
  | 'toggle-terminal'
  | 'toggle-sidebar'
  | 'switch-page-mode'
  | 'dispatch-spec'
  | 'launch-mission'
  | 'open-daily-note'
  | 'quick-capture'
  | 'close-tab'
  | 'reopen-tab'
  | 'next-tab'
  | 'prev-tab'
  | 'undo'
  | 'redo'

export interface ShortcutDefinition {
  id: ShortcutId
  label: string
  description: string
  keys: string
  keyTokens: readonly string[]
  category: ShortcutCategory
  scope: ShortcutScope
  combo: ShortcutCombo
  altCombos?: readonly ShortcutCombo[]
  electronAccelerator?: string
}

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation & Views',
  workspace: 'Workspace & Tabs',
  ade: 'ADE & Agent Dispatch',
  editor: 'Document & Canvas Editor',
  global: 'Global Desktop'
}

const CATEGORY_ORDER: readonly ShortcutCategory[] = [
  'navigation',
  'workspace',
  'ade',
  'editor',
  'global'
]

export const APP_SHORTCUTS: readonly ShortcutDefinition[] = [
  {
    id: 'command-palette',
    label: 'Command Palette & FTS5 Search',
    description: 'Search pages, DBML tables, tags, or run quick actions with >',
    keys: 'Ctrl+K',
    keyTokens: ['Ctrl', 'K'],
    category: 'navigation',
    scope: 'renderer',
    combo: { key: 'k', mod: true, shift: false, alt: false }
  },
  {
    id: 'shortcut-cheatsheet',
    label: 'Keyboard Shortcuts Cheatsheet',
    description: 'Open or close the keyboard shortcuts reference modal',
    keys: 'Ctrl+/',
    keyTokens: ['Ctrl', '/'],
    category: 'navigation',
    scope: 'renderer',
    combo: { key: '/', codes: ['Slash'], mod: true, shift: false, alt: false }
  },
  {
    id: 'toggle-settings',
    label: 'Open or Close Settings',
    description: 'Toggle the workspace settings and theme studio view',
    keys: 'Ctrl+,',
    keyTokens: ['Ctrl', ','],
    category: 'navigation',
    scope: 'renderer',
    combo: { key: ',', codes: ['Comma'], mod: true, shift: false, alt: false }
  },
  {
    id: 'settings-search',
    label: 'Search Inside Settings',
    description: 'Focus the filter input inside Settings',
    keys: 'Ctrl+F',
    keyTokens: ['Ctrl', 'F'],
    category: 'navigation',
    scope: 'settings',
    combo: { key: 'f', mod: true, shift: false, alt: false }
  },
  {
    id: 'toggle-ai-chat',
    label: 'Toggle AI Assistant',
    description: 'Switch between the active view and AI Chat',
    keys: 'Ctrl+Shift+C',
    keyTokens: ['Ctrl', 'Shift', 'C'],
    category: 'navigation',
    scope: 'renderer',
    combo: { key: 'c', mod: true, shift: true, alt: false }
  },
  {
    id: 'toggle-ai-split',
    label: 'Toggle AI Studio Split Pane',
    description: 'Open or close AI Studio side-by-side next to your active note',
    keys: 'Ctrl+Alt+C',
    keyTokens: ['Ctrl', 'Alt', 'C'],
    category: 'navigation',
    scope: 'renderer',
    combo: { key: 'c', mod: true, shift: false, alt: true }
  },
  {
    id: 'toggle-browser',
    label: 'Toggle In-App Reference Browser',
    description: 'Switch between the active view and the embedded browser',
    keys: 'Ctrl+Shift+B',
    keyTokens: ['Ctrl', 'Shift', 'B'],
    category: 'navigation',
    scope: 'renderer',
    combo: { key: 'b', mod: true, shift: true, alt: false }
  },
  {
    id: 'toggle-sidebar',
    label: 'Toggle Left Sidebar',
    description: 'Collapse or expand the workspace navigation rail',
    keys: 'Ctrl+\\',
    keyTokens: ['Ctrl', '\\'],
    category: 'workspace',
    scope: 'renderer',
    combo: { key: '\\', codes: ['Backslash'], mod: true, shift: false, alt: false }
  },
  {
    id: 'switch-page-mode',
    label: 'Switch Page Mode (Doc / Canvas)',
    description: 'Toggle the active page between Block Document and Spatial Canvas',
    keys: 'Ctrl+Shift+M',
    keyTokens: ['Ctrl', 'Shift', 'M'],
    category: 'workspace',
    scope: 'renderer',
    combo: { key: 'm', mod: true, shift: true, alt: false }
  },
  {
    id: 'close-tab',
    label: 'Close Active Tab',
    description: 'Close the currently active page tab',
    keys: 'Ctrl+W',
    keyTokens: ['Ctrl', 'W'],
    category: 'workspace',
    scope: 'renderer',
    combo: { key: 'w', mod: true, shift: false, alt: false }
  },
  {
    id: 'reopen-tab',
    label: 'Reopen Last Closed Tab',
    description: 'Restore the most recently closed page tab',
    keys: 'Ctrl+Shift+T',
    keyTokens: ['Ctrl', 'Shift', 'T'],
    category: 'workspace',
    scope: 'renderer',
    combo: { key: 't', mod: true, shift: true, alt: false }
  },
  {
    id: 'next-tab',
    label: 'Switch to Next Open Tab',
    description: 'Cycle forward through open workspace tabs',
    keys: 'Ctrl+Tab',
    keyTokens: ['Ctrl', 'Tab'],
    category: 'workspace',
    scope: 'renderer',
    combo: { key: 'tab', ctrlOnly: true, shift: false, alt: false }
  },
  {
    id: 'prev-tab',
    label: 'Switch to Previous Open Tab',
    description: 'Cycle backward through open workspace tabs',
    keys: 'Ctrl+Shift+Tab',
    keyTokens: ['Ctrl', 'Shift', 'Tab'],
    category: 'workspace',
    scope: 'renderer',
    combo: { key: 'tab', ctrlOnly: true, shift: true, alt: false }
  },
  {
    id: 'dispatch-spec',
    label: 'Dispatch Spec to Agent',
    description: 'Compile the active spec and open the Mission Briefing drawer',
    keys: 'Ctrl+Shift+D',
    keyTokens: ['Ctrl', 'Shift', 'D'],
    category: 'ade',
    scope: 'workbench',
    combo: { key: 'd', mod: true, shift: true, alt: false }
  },
  {
    id: 'toggle-mission-control',
    label: 'Toggle Agent Mission Control',
    description: 'Open or close the ADE Mission Control board',
    keys: 'Ctrl+Shift+A',
    keyTokens: ['Ctrl', 'Shift', 'A'],
    category: 'ade',
    scope: 'renderer',
    combo: { key: 'a', mod: true, shift: true, alt: false }
  },
  {
    id: 'toggle-terminal',
    label: 'Toggle Terminal Drawer',
    description: 'Show or hide the embedded ADE terminal drawer',
    keys: 'Ctrl+`',
    keyTokens: ['Ctrl', '`'],
    category: 'ade',
    scope: 'renderer',
    combo: { key: '`', codes: ['Backquote'], mod: true, shift: false, alt: false },
    altCombos: [{ key: '~', mod: true, shift: false, alt: false }]
  },
  {
    id: 'launch-mission',
    label: 'Launch Mission From Briefing Drawer',
    description: 'Compile artifacts and start the selected CLI agent session',
    keys: 'Ctrl+Enter',
    keyTokens: ['Ctrl', 'Enter'],
    category: 'ade',
    scope: 'drawer',
    combo: { key: 'enter', mod: true, shift: false, alt: false }
  },
  {
    id: 'undo',
    label: 'Undo Document Changes',
    description: 'Undo the last coalesced edit on the focused workbench pane',
    keys: 'Ctrl+Z',
    keyTokens: ['Ctrl', 'Z'],
    category: 'editor',
    scope: 'workbench',
    combo: { key: 'z', mod: true, shift: false, alt: false }
  },
  {
    id: 'redo',
    label: 'Redo Document Changes',
    description: 'Redo the previously undone edit on the focused workbench pane',
    keys: 'Ctrl+Shift+Z / Ctrl+Y',
    keyTokens: ['Ctrl', 'Shift', 'Z'],
    category: 'editor',
    scope: 'workbench',
    combo: { key: 'z', mod: true, shift: true, alt: false },
    altCombos: [{ key: 'y', mod: true, shift: false, alt: false }]
  },
  {
    id: 'open-daily-note',
    label: "Open Today's Daily Note",
    description: 'Focus NoteIT and open or create today’s daily engineering note',
    keys: 'Ctrl+Alt+D',
    keyTokens: ['Ctrl', 'Alt', 'D'],
    category: 'global',
    scope: 'global',
    combo: { key: 'd', mod: true, shift: false, alt: true },
    electronAccelerator: 'CommandOrControl+Alt+D'
  },
  {
    id: 'quick-capture',
    label: 'Global Quick Capture Window',
    description: 'Open the system-wide quick note capture overlay',
    keys: 'Ctrl+Shift+Space',
    keyTokens: ['Ctrl', 'Shift', 'Space'],
    category: 'global',
    scope: 'global',
    combo: { key: ' ', codes: ['Space'], mod: true, shift: true, alt: false },
    electronAccelerator: 'CommandOrControl+Shift+Space'
  }
]

export const SHORTCUTS = APP_SHORTCUTS

export const SHORTCUT_BY_ID: Record<ShortcutId, ShortcutDefinition> = APP_SHORTCUTS.reduce(
  (acc, item) => {
    acc[item.id] = item
    return acc
  },
  {} as Record<ShortcutId, ShortcutDefinition>
)

function resolveShortcut(shortcutOrId: ShortcutDefinition | ShortcutId): ShortcutDefinition {
  return typeof shortcutOrId === 'string' ? SHORTCUT_BY_ID[shortcutOrId] : shortcutOrId
}

export function matchesShortcutCombo(
  event: ShortcutKeyEventLike,
  combo: ShortcutCombo
): boolean {
  if (event.isComposing || event.defaultPrevented) return false

  if (combo.ctrlOnly) {
    if (!event.ctrlKey || event.metaKey) return false
  } else if (combo.mod) {
    if (!event.ctrlKey && !event.metaKey) return false
  } else {
    if (event.ctrlKey || event.metaKey) return false
  }

  const expectedShift = Boolean(combo.shift)
  if (event.shiftKey !== expectedShift) return false

  const expectedAlt = Boolean(combo.alt)
  if (event.altKey !== expectedAlt) return false

  const normalizedKey = event.key.toLowerCase()
  if (normalizedKey === combo.key.toLowerCase()) return true

  if (combo.codes && event.code) {
    return combo.codes.includes(event.code)
  }

  return false
}

export function matchesShortcutEvent(
  event: ShortcutKeyEventLike,
  shortcutOrId: ShortcutDefinition | ShortcutId
): boolean {
  const def = resolveShortcut(shortcutOrId)
  if (matchesShortcutCombo(event, def.combo)) return true
  if (def.altCombos) {
    return def.altCombos.some((alt) => matchesShortcutCombo(event, alt))
  }
  return false
}

export function matchesShortcut(
  event: ShortcutKeyEventLike,
  shortcutOrId: ShortcutDefinition | ShortcutId
): boolean {
  return matchesShortcutEvent(event, shortcutOrId)
}

export function findMatchingShortcut(
  event: ShortcutKeyEventLike,
  scopes?: readonly ShortcutScope[]
): ShortcutDefinition | null {
  for (const def of APP_SHORTCUTS) {
    if (scopes && !scopes.includes(def.scope)) continue
    if (matchesShortcutEvent(event, def)) return def
  }
  return null
}

export function formatShortcutKeys(
  shortcutOrId: ShortcutDefinition | ShortcutId,
  platform: 'win' | 'mac' | 'linux' = 'win'
): string {
  const def = resolveShortcut(shortcutOrId)
  if (platform !== 'mac') return def.keys

  return def.keyTokens
    .map((token) => {
      if (token === 'Ctrl') return '⌘'
      if (token === 'Shift') return '⇧'
      if (token === 'Alt') return '⌥'
      return token
    })
    .join('')
}

export function getShortcutsByCategory(): Array<{
  category: ShortcutCategory
  label: string
  items: readonly ShortcutDefinition[]
}> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: SHORTCUT_CATEGORY_LABELS[category],
    items: APP_SHORTCUTS.filter((item) => item.category === category)
  })).filter((group) => group.items.length > 0)
}
