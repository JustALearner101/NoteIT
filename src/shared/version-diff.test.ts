import { describe, expect, it } from 'vitest'
import { diffBlockSets } from './version-diff'
import type { DocumentBlock } from './types/domain'

function block(id: string, content: string, type: DocumentBlock['type'] = 'paragraph'): DocumentBlock {
  return { id, type, content }
}

describe('diffBlockSets', () => {
  it('dua set identik menghasilkan diff kosong dan semua blok unchanged', () => {
    const blocks = [block('a', 'satu'), block('b', 'dua')]

    const diff = diffBlockSets(blocks, blocks.map((b) => ({ ...b })))

    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(diff.changed).toEqual([])
    expect(diff.unchanged).toBe(2)
    expect(diff.titleChanged).toBe(false)
  })

  it('blok yang hanya ada di kondisi sekarang dihitung added', () => {
    const diff = diffBlockSets([block('a', 'satu'), block('b', 'dua')], [block('a', 'satu')])

    expect(diff.added).toEqual(['b'])
    expect(diff.removed).toEqual([])
    expect(diff.unchanged).toBe(1)
  })

  it('blok yang hanya ada di snapshot dihitung removed', () => {
    const diff = diffBlockSets([block('a', 'satu')], [block('a', 'satu'), block('z', 'lama')])

    expect(diff.removed).toEqual(['z'])
    expect(diff.added).toEqual([])
    expect(diff.unchanged).toBe(1)
  })

  it('id sama dengan content berbeda dihitung changed', () => {
    const diff = diffBlockSets([block('a', 'versi baru')], [block('a', 'versi lama')])

    expect(diff.changed).toEqual(['a'])
    expect(diff.unchanged).toBe(0)
  })

  it('perubahan checked pada checklist dihitung changed', () => {
    const current: DocumentBlock[] = [{ id: 'a', type: 'checklist', content: 'Tugas', checked: true }]
    const snapshot: DocumentBlock[] = [
      { id: 'a', type: 'checklist', content: 'Tugas', checked: false }
    ]

    expect(diffBlockSets(current, snapshot).changed).toEqual(['a'])
  })

  it('perubahan type dengan content sama dihitung changed', () => {
    const diff = diffBlockSets([block('a', 'teks', 'h2')], [block('a', 'teks', 'paragraph')])

    expect(diff.changed).toEqual(['a'])
  })

  it('urutan blok berubah tidak dihitung changed', () => {
    const current = [block('b', 'dua'), block('a', 'satu')]
    const snapshot = [block('a', 'satu'), block('b', 'dua')]

    const diff = diffBlockSets(current, snapshot)

    expect(diff.changed).toEqual([])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(diff.unchanged).toBe(2)
  })

  it('titleChanged hanya dihitung saat judul kedua sisi diberikan', () => {
    const blocks = [block('a', 'satu')]

    expect(
      diffBlockSets(blocks, blocks, { current: 'Judul Baru', snapshot: 'Judul Lama' }).titleChanged
    ).toBe(true)
    expect(
      diffBlockSets(blocks, blocks, { current: 'Judul Sama', snapshot: 'Judul Sama' }).titleChanged
    ).toBe(false)
    expect(diffBlockSets(blocks, blocks).titleChanged).toBe(false)
  })

  it('kombinasi added, removed, changed, dan unchanged dihitung terpisah', () => {
    const current = [block('a', 'tetap'), block('b', 'diubah baru'), block('c', 'baru')]
    const snapshot = [block('a', 'tetap'), block('b', 'diubah lama'), block('d', 'hilang')]

    const diff = diffBlockSets(current, snapshot)

    expect(diff.added).toEqual(['c'])
    expect(diff.removed).toEqual(['d'])
    expect(diff.changed).toEqual(['b'])
    expect(diff.unchanged).toBe(1)
  })

  it('dua set kosong menghasilkan diff kosong', () => {
    const diff = diffBlockSets([], [])

    expect(diff).toEqual({
      added: [],
      removed: [],
      changed: [],
      unchanged: 0,
      titleChanged: false
    })
  })
})
