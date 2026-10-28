import { describe, expect, it } from 'vitest'
import { resolveUndoTarget } from './undo-target'

describe('resolveUndoTarget', () => {
  it('focusedPane primary memakai activePageId walau split pane terbuka', () => {
    expect(
      resolveUndoTarget({ focusedPane: 'primary', activePageId: 'pg-kiri', splitPageId: 'pg-kanan' })
    ).toBe('pg-kiri')
  })

  it('focusedPane split memakai splitPageId', () => {
    expect(
      resolveUndoTarget({ focusedPane: 'split', activePageId: 'pg-kiri', splitPageId: 'pg-kanan' })
    ).toBe('pg-kanan')
  })

  it('focusedPane split tanpa splitPageId jatuh ke activePageId', () => {
    expect(
      resolveUndoTarget({ focusedPane: 'split', activePageId: 'pg-kiri', splitPageId: null })
    ).toBe('pg-kiri')
  })

  it('splitPageId null dengan focusedPane primary tetap memakai activePageId', () => {
    expect(
      resolveUndoTarget({ focusedPane: 'primary', activePageId: 'pg-kiri', splitPageId: null })
    ).toBe('pg-kiri')
  })
})
