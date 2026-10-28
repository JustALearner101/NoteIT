import { describe, expect, it } from 'vitest'
import {
  createColumnGroup,
  flattenColumns,
  groupBlocks,
  moveBlockToColumn,
  normalizeWidths,
  nudgeDivider,
  removeColumn,
  resizeColumnPair,
  type ColumnBlock,
  type ColumnRenderNode
} from './columns'

const sum = (values: number[]): number => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100

const block = (id: string, content = id, extra: Partial<ColumnBlock> = {}): ColumnBlock => ({
  id,
  type: 'paragraph',
  content,
  ...extra
})

const header = (id: string, widths: number[] = [50, 50]): ColumnBlock => ({
  id,
  type: 'columns',
  content: '',
  columnWidths: widths
})

const allBlocks = (nodes: ColumnRenderNode[]): ColumnBlock[] =>
  flattenColumns(nodes)

const ids = (blocks: ColumnBlock[]): string[] => blocks.map((b) => b.id)

describe('normalizeWidths', () => {
  it('menghasilkan satu kolom penuh untuk count 1', () => {
    expect(normalizeWidths(undefined, 1)).toEqual([100])
    expect(normalizeWidths([42], 1)).toEqual([100])
  })

  it('membagi rata untuk count 2..4 tanpa input', () => {
    for (const count of [2, 3, 4]) {
      const widths = normalizeWidths(undefined, count)
      expect(widths).toHaveLength(count)
      expect(sum(widths)).toBe(100)
      for (const w of widths) expect(w).toBeGreaterThanOrEqual(15)
    }
    expect(normalizeWidths(undefined, 4)).toEqual([25, 25, 25, 25])
  })

  it('tahan input kosong dan panjang yang tidak cocok', () => {
    expect(normalizeWidths([], 3)).toEqual([33.33, 33.33, 33.34])
    expect(normalizeWidths(null, 3)).toEqual([33.33, 33.33, 33.34])
    expect(normalizeWidths([80], 3)).toEqual([33.33, 33.33, 33.34])
    expect(normalizeWidths([10, 20, 30, 40, 50], 2)).toEqual([50, 50])
    expect(normalizeWidths(undefined, 0)).toEqual([])
    expect(normalizeWidths(undefined, -3)).toEqual([])
  })

  it('menormalkan jumlah yang bukan 100', () => {
    expect(normalizeWidths([1, 1, 1], 3)).toEqual([33.33, 33.33, 33.34])
    expect(normalizeWidths([200, 100, 100], 3)).toEqual([50, 25, 25])
    expect(sum(normalizeWidths([7, 13, 21, 59], 4))).toBe(100)
  })

  it('menaikkan kolom di bawah min 15 lalu menyeimbangkan sisanya', () => {
    const widths = normalizeWidths([5, 20, 75], 3)
    expect(widths[0]).toBe(15)
    expect(sum(widths)).toBe(100)
    expect(widths[1]).toBeCloseTo(17.89, 2)
    expect(widths[2]).toBeCloseTo(67.11, 2)
  })

  it('deterministik', () => {
    expect(normalizeWidths([3, 9, 1, 6], 4)).toEqual(normalizeWidths([3, 9, 1, 6], 4))
  })
})

describe('resizeColumnPair', () => {
  it('menggeser hanya dua kolom bersebelahan', () => {
    expect(resizeColumnPair([50, 50], 0, 20)).toEqual([70, 30])
    const four = resizeColumnPair([25, 25, 25, 25], 1, 10)
    expect(four).toEqual([25, 35, 15, 25])
    expect(sum(four)).toBe(100)
  })

  it('clamp di divider pertama (delta negatif besar)', () => {
    const widths = resizeColumnPair([50, 50], 0, -100)
    expect(widths).toEqual([15, 85])
    expect(sum(widths)).toBe(100)
  })

  it('clamp di divider terakhir (delta positif besar)', () => {
    const widths = resizeColumnPair([40, 30, 30], 1, 500)
    expect(widths[2]).toBe(15)
    expect(widths[1]).toBe(45)
    expect(sum(widths)).toBe(100)
  })

  it('menabrak min 15 pada dua kolom sempit', () => {
    const widths = resizeColumnPair([15, 15, 70], 0, 60)
    expect(widths[0]).toBe(15)
    expect(widths[1]).toBe(15)
    expect(sum(widths)).toBe(100)
  })

  it('mengabaikan divider di luar jangkauan dan input kosong', () => {
    expect(resizeColumnPair([50, 50], -1, 10)).toEqual([50, 50])
    expect(resizeColumnPair([50, 50], 1, 10)).toEqual([50, 50])
    expect(resizeColumnPair([], 0, 10)).toEqual([])
    expect(sum(resizeColumnPair([20, 30, 50], 1, 7))).toBe(100)
  })
})

describe('groupBlocks', () => {
  it('mengelompokkan header dengan anak-anaknya', () => {
    const blocks = [
      header('g1', [50, 50]),
      block('a', 'a', { columnGroupId: 'g1', columnIndex: 0 }),
      block('b', 'b', { columnGroupId: 'g1', columnIndex: 1 })
    ]
    const nodes = groupBlocks(blocks)
    expect(nodes).toHaveLength(1)
    const group = nodes[0]
    expect(group.kind).toBe('group')
    if (group.kind !== 'group') return
    expect(group.header.id).toBe('g1')
    expect(group.widths).toEqual([50, 50])
    expect(group.columns.map(ids)).toEqual([['a'], ['b']])
  })

  it('menangani interleaving tanpa kehilangan blok', () => {
    const blocks = [
      header('g1', [50, 50]),
      block('a', 'a', { columnGroupId: 'g1', columnIndex: 0 }),
      block('plain', 'teks biasa'),
      block('b', 'b', { columnGroupId: 'g1', columnIndex: 1 })
    ]
    const nodes = groupBlocks(blocks)
    expect(nodes.map((n) => n.kind)).toEqual(['group', 'block'])
    expect(ids(allBlocks(nodes))).toEqual(['g1', 'a', 'plain', 'b'])
    expect(allBlocks(nodes)).toHaveLength(blocks.length)
  })

  it('header yatim (tanpa anak) tetap jadi grup kosong', () => {
    const blocks = [block('before'), header('g1', [50, 50]), block('after')]
    const nodes = groupBlocks(blocks)
    expect(nodes.map((n) => n.kind)).toEqual(['block', 'group', 'block'])
    const group = nodes[1]
    if (group.kind !== 'group') throw new Error('expected group')
    expect(group.children).toHaveLength(0)
    expect(group.columns).toEqual([[], []])
    expect(group.widths).toEqual([50, 50])
    expect(ids(allBlocks(nodes))).toEqual(['before', 'g1', 'after'])
  })

  it('anak tanpa header diperlakukan sebagai blok biasa', () => {
    const blocks = [
      block('a', 'a', { columnGroupId: 'hilang', columnIndex: 0 }),
      block('b', 'b', { columnGroupId: 'hilang', columnIndex: 1 })
    ]
    const nodes = groupBlocks(blocks)
    expect(nodes.every((n) => n.kind === 'block')).toBe(true)
    expect(ids(allBlocks(nodes))).toEqual(['a', 'b'])
  })

  it('anak yang muncul sebelum header tetap masuk grup', () => {
    const blocks = [
      block('a', 'a', { columnGroupId: 'g1', columnIndex: 0 }),
      header('g1', [50, 50]),
      block('b', 'b', { columnGroupId: 'g1', columnIndex: 1 })
    ]
    const nodes = groupBlocks(blocks)
    const group = nodes.find((n) => n.kind === 'group')
    expect(group).toBeDefined()
    if (!group || group.kind !== 'group') return
    expect(group.children.map((c) => c.block.id)).toEqual(['a', 'b'])
    expect(ids(allBlocks(nodes))).toEqual(['a', 'g1', 'b'])
  })
})

describe('flattenColumns', () => {
  it('roundtrip groupBlocks -> flattenColumns identik', () => {
    const blocks: ColumnBlock[] = [
      block('intro'),
      header('g1', [34, 33, 33]),
      block('a1', 'a1', { columnGroupId: 'g1', columnIndex: 0 }),
      block('plain', 'di tengah'),
      block('a2', 'a2', { columnGroupId: 'g1', columnIndex: 1 }),
      header('g2', [50, 50]),
      block('b1', 'b1', { columnGroupId: 'g2', columnIndex: 0 }),
      block('a3', 'a3', { columnGroupId: 'g1', columnIndex: 2 }),
      block('b2', 'b2', { columnGroupId: 'g2', columnIndex: 1 }),
      block('outro')
    ]
    expect(flattenColumns(groupBlocks(blocks))).toEqual(blocks)
    expect(ids(flattenColumns(groupBlocks(blocks)))).toEqual(ids(blocks))
  })

  it('roundtrip untuk dokumen tanpa kolom', () => {
    const blocks = [block('x'), block('y')]
    expect(flattenColumns(groupBlocks(blocks))).toEqual(blocks)
  })
})

describe('createColumnGroup', () => {
  it('menyisipkan header dan kolom kosong setelah afterId', () => {
    const blocks = [block('a'), block('b')]
    const next = createColumnGroup(blocks, 'a', 3)
    expect(blocks).toHaveLength(2)
    expect(next).toHaveLength(6)
    expect(next[1].type).toBe('columns')
    const groupId = next[1].id
    expect(next[1].columnWidths).toHaveLength(3)
    expect(sum(next[1].columnWidths ?? [])).toBe(100)

    const cells = next.slice(2, 5)
    for (const [index, cell] of cells.entries()) {
      expect(cell.columnGroupId).toBe(groupId)
      expect(cell.columnIndex).toBe(index)
      expect(cell.content).toBe('')
    }
    expect(next[5].id).toBe('b')
    expect(new Set(ids(next)).size).toBe(next.length)
  })

  it('menambahkan di akhir bila afterId tidak ada', () => {
    const next = createColumnGroup([block('a')], null, 2)
    expect(next).toHaveLength(4)
    expect(next[0].id).toBe('a')
    expect(next[1].type).toBe('columns')
  })
})

describe('removeColumn', () => {
  const threeColumns = (): ColumnBlock[] => [
    header('g1', [34, 33, 33]),
    block('a', 'isi A', { columnGroupId: 'g1', columnIndex: 0 }),
    block('b', 'isi B', { columnGroupId: 'g1', columnIndex: 1 }),
    block('c', 'isi C', { columnGroupId: 'g1', columnIndex: 2 })
  ]

  it('tidak menghilangkan blok dan memindahkan isinya', () => {
    const blocks = threeColumns()
    const next = removeColumn(blocks, 'g1', 1)
    expect(next).toHaveLength(blocks.length)
    expect(new Set(ids(next))).toEqual(new Set(ids(blocks)))
    expect(next.map((b) => b.content).sort()).toEqual(blocks.map((b) => b.content).sort())

    const nodes = groupBlocks(next)
    const group = nodes[0]
    if (group.kind !== 'group') throw new Error('expected group')
    expect(group.columns).toHaveLength(2)
    expect(sum(group.widths)).toBe(100)
    expect(group.widths.every((w) => w >= 15)).toBe(true)
    const columnIds = group.columns.map((col) => ids(col))
    expect(columnIds[0]).toEqual(['a'])
    expect(columnIds[1]).toEqual(['b', 'c'])
    expect(group.columns[1].map((b) => b.content)).toContain('isi B')
  })

  it('memindahkan kolom pertama ke kolom berikutnya', () => {
    const next = removeColumn(threeColumns(), 'g1', 0)
    const group = groupBlocks(next)[0]
    if (group.kind !== 'group') throw new Error('expected group')
    expect(group.columns.map((col) => ids(col))).toEqual([['a', 'b'], ['c']])
    expect(next).toHaveLength(4)
  })

  it('tidak menghapus kolom terakhir dan mengabaikan indeks tidak valid', () => {
    const single = [
      header('g1', [100]),
      block('a', 'isi A', { columnGroupId: 'g1', columnIndex: 0 })
    ]
    expect(removeColumn(single, 'g1', 0)).toEqual(single)
    const blocks = threeColumns()
    expect(removeColumn(blocks, 'g1', 9)).toEqual(blocks)
    expect(removeColumn(blocks, 'nope', 0)).toEqual(blocks)
  })
})

describe('moveBlockToColumn', () => {
  it('memindahkan blok tanpa mengubah urutan relatif blok lain', () => {
    const blocks = [
      header('g1', [50, 50]),
      block('a', 'A', { columnGroupId: 'g1', columnIndex: 0 }),
      block('b', 'B', { columnGroupId: 'g1', columnIndex: 0 }),
      block('c', 'C', { columnGroupId: 'g1', columnIndex: 1 })
    ]
    const next = moveBlockToColumn(blocks, 'a', 'g1', 1)
    expect(ids(next)).toEqual(['g1', 'b', 'c', 'a'])

    const group = groupBlocks(next)[0]
    if (group.kind !== 'group') throw new Error('expected group')
    expect(group.columns.map((col) => ids(col))).toEqual([['b'], ['c', 'a']])
    expect(group.children.map((c) => c.block.id)).toEqual(['b', 'c', 'a'])
  })

  it('menaruh blok tepat setelah header bila kolom tujuan kosong', () => {
    const blocks = [
      header('g1', [50, 50]),
      block('a', 'A', { columnGroupId: 'g1', columnIndex: 0 }),
      block('x', 'X')
    ]
    const next = moveBlockToColumn(blocks, 'x', 'g1', 1)
    expect(ids(next)).toEqual(['g1', 'x', 'a'])
    const group = groupBlocks(next)[0]
    if (group.kind !== 'group') throw new Error('expected group')
    expect(group.columns.map((col) => ids(col))).toEqual([['a'], ['x']])
  })

  it('mengabaikan grup atau blok yang tidak ada', () => {
    const blocks = [header('g1', [50, 50]), block('a', 'A', { columnGroupId: 'g1', columnIndex: 0 })]
    expect(moveBlockToColumn(blocks, 'zz', 'g1', 1)).toEqual(blocks)
    expect(moveBlockToColumn(blocks, 'a', 'zz', 1)).toEqual(blocks)
    expect(moveBlockToColumn(blocks, 'a', 'g1', 5)).toEqual(blocks)
  })
})

describe('nudgeDivider', () => {
  it('panah kanan menggeser batas sebesar step default', () => {
    expect(nudgeDivider([50, 50], 0, 1)).toEqual([52, 48])
    const four = nudgeDivider([25, 25, 25, 25], 1, 1)
    expect(four).toEqual([25, 27, 23, 25])
    expect(sum(four)).toBe(100)
  })

  it('panah kiri menggeser batas ke arah sebaliknya', () => {
    expect(nudgeDivider([50, 50], 0, -1)).toEqual([48, 52])
    const three = nudgeDivider([20, 30, 50], 1, -1)
    expect(three).toEqual([20, 28, 52])
    expect(sum(three)).toBe(100)
  })

  it('clamp di divider pertama: panah kiri saat kolom kiri sudah di min', () => {
    expect(nudgeDivider([15, 85], 0, -1)).toEqual([15, 85])
    expect(nudgeDivider([16, 84], 0, -1)).toEqual([15, 85])
  })

  it('clamp saat menyentuh min di kolom kanan', () => {
    expect(nudgeDivider([85, 15], 0, 1)).toEqual([85, 15])
    expect(nudgeDivider([84, 16], 0, 1)).toEqual([85, 15])
  })

  it('menghormati stepPct kustom', () => {
    expect(nudgeDivider([50, 50], 0, 1, 10)).toEqual([60, 40])
    expect(nudgeDivider([50, 50], 0, -1, 5)).toEqual([45, 55])
    expect(nudgeDivider([50, 50], 0, 1, 0)).toEqual([52, 48])
  })

  it('tidak memutasi input dan mengembalikan array baru', () => {
    const widths = [50, 50]
    const next = nudgeDivider(widths, 0, 1)
    expect(widths).toEqual([50, 50])
    expect(next).not.toBe(widths)
  })

  it('mengabaikan divider di luar jangkauan dan input kosong', () => {
    expect(nudgeDivider([50, 50], -1, 1)).toEqual([50, 50])
    expect(nudgeDivider([50, 50], 1, 1)).toEqual([50, 50])
    expect(nudgeDivider([], 0, 1)).toEqual([])
  })
})
