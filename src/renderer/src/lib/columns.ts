/**
 * Model kolom FLAT untuk blok dokumen.
 *
 * Blok tidak disimpan bersarang: header grup bertipe 'columns', anak-anaknya
 * menunjuk balik lewat columnGroupId + columnIndex. Semua fungsi di sini murni
 * (tidak memutasi input) supaya aman dipakai di store/undo.
 */

export const MIN_COLUMN_PCT = 15
const MAX_COLUMN_PCT = 100

/** Kontrak minimal blok; DocumentBlock dari @shared/types/domain kompatibel. */
export interface ColumnBlock {
  id: string
  type: string
  content: string
  columnGroupId?: string
  columnIndex?: number
  columnWidths?: number[]
}

export interface ColumnChild<B extends ColumnBlock = ColumnBlock> {
  block: B
  /** Posisi asli di array flat; dipakai flattenColumns untuk memulihkan urutan. */
  index: number
}

export interface ColumnGroupNode<B extends ColumnBlock = ColumnBlock> {
  kind: 'group'
  header: B
  headerIndex: number
  widths: number[]
  /** Blok per kolom, siap render. */
  columns: B[][]
  /** Semua anak dalam urutan asli (bisa terinterleaving blok biasa). */
  children: ColumnChild<B>[]
}

export interface ColumnPlainNode<B extends ColumnBlock = ColumnBlock> {
  kind: 'block'
  block: B
  index: number
}

export type ColumnRenderNode<B extends ColumnBlock = ColumnBlock> =
  | ColumnGroupNode<B>
  | ColumnPlainNode<B>

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function effectiveMin(count: number): number {
  // Dengan 7+ kolom, min 15% tidak feasible; turunkan agar total tetap 100.
  return Math.min(MIN_COLUMN_PCT, Math.floor(MAX_COLUMN_PCT / count))
}

function toCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function uniqueId(existing: Set<string>, base: string): string {
  if (!existing.has(base)) {
    existing.add(base)
    return base
  }
  let suffix = 2
  while (existing.has(`${base}-${suffix}`)) suffix += 1
  const id = `${base}-${suffix}`
  existing.add(id)
  return id
}

/**
 * Normalisasi lebar kolom: panjang == count, total 100, tiap kolom >= min.
 * Deterministik: sisa pembulatan selalu diberikan ke kolom terlebar.
 */
export function normalizeWidths(
  widths: readonly number[] | null | undefined,
  count: number
): number[] {
  const n = toCount(count)
  if (n === 0) return []
  if (n === 1) return [MAX_COLUMN_PCT]

  const min = effectiveMin(n)
  const source = Array.isArray(widths) && widths.length === n ? widths : []
  const weights = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i += 1) {
    const value = source[i]
    weights[i] = isPositiveNumber(value) ? value : 0
  }
  let weightSum = weights.reduce((sum, value) => sum + value, 0)
  if (weightSum <= 0) {
    weights.fill(1)
    weightSum = n
  }

  const fixed = new Array<boolean>(n).fill(false)
  const out = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i += 1) out[i] = (weights[i] / weightSum) * MAX_COLUMN_PCT

  for (let guard = 0; guard <= n; guard += 1) {
    let pinned = false
    for (let i = 0; i < n; i += 1) {
      if (!fixed[i] && out[i] < min) {
        fixed[i] = true
        out[i] = min
        pinned = true
      }
    }
    if (!pinned) break

    const fixedCount = fixed.filter(Boolean).length
    const freeCount = n - fixedCount
    if (freeCount === 0) break

    const freeBudget = MAX_COLUMN_PCT - fixedCount * min
    let freeWeight = 0
    for (let i = 0; i < n; i += 1) if (!fixed[i]) freeWeight += weights[i]

    for (let i = 0; i < n; i += 1) {
      if (fixed[i]) continue
      out[i] =
        freeWeight > 0 ? (weights[i] / freeWeight) * freeBudget : freeBudget / freeCount
    }
  }

  const rounded = out.map(round2)
  const total = round2(rounded.reduce((sum, value) => sum + value, 0))
  const diff = round2(MAX_COLUMN_PCT - total)
  if (diff !== 0) {
    // Sisa pembulatan ke kolom terakhir (atau terlebar bila harus memangkas).
    let target = n - 1
    if (diff < 0) {
      target = 0
      for (let i = 1; i < n; i += 1) if (rounded[i] > rounded[target]) target = i
    }
    rounded[target] = round2(rounded[target] + diff)
  }
  return rounded
}

/**
 * Geser batas antara kolom dividerIndex dan dividerIndex + 1.
 * Hanya dua kolom itu yang berubah; total tetap 100 dan min dihormati.
 */
export function resizeColumnPair(
  widths: readonly number[] | null | undefined,
  dividerIndex: number,
  deltaPct: number
): number[] {
  const n = Array.isArray(widths) ? widths.length : 0
  if (n === 0) return []

  const base = normalizeWidths(widths, n)
  const divider = Number.isFinite(dividerIndex) ? Math.floor(dividerIndex) : -1
  if (divider < 0 || divider > n - 2) return base

  const min = effectiveMin(n)
  const left = base[divider]
  const right = base[divider + 1]
  const delta = Number.isFinite(deltaPct) ? deltaPct : 0

  const applied = Math.max(-(left - min), Math.min(right - min, delta))
  const next = base.slice()
  next[divider] = round2(left + applied)
  next[divider + 1] = round2(left + right - next[divider])

  if (next[divider] < min) {
    next[divider] = min
    next[divider + 1] = round2(left + right - min)
  }
  if (next[divider + 1] < min) {
    next[divider + 1] = min
    next[divider] = round2(left + right - min)
  }
  return next
}

/** Susun struktur render; tidak ada blok yang hilang. */
export function groupBlocks<B extends ColumnBlock>(
  blocks: readonly B[]
): ColumnRenderNode<B>[] {
  const groups = new Map<string, ColumnGroupNode<B>>()

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.type !== 'columns' || groups.has(block.id)) continue
    groups.set(block.id, {
      kind: 'group',
      header: block,
      headerIndex: i,
      widths: [],
      columns: [],
      children: []
    })
  }

  const nodes: ColumnRenderNode<B>[] = []
  const emitted = new Set<string>()

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.type === 'columns') {
      const group = groups.get(block.id)
      if (group && !emitted.has(block.id)) {
        emitted.add(block.id)
        nodes.push(group)
      } else {
        // Header duplikat / tidak valid: tetap tampil sebagai blok biasa.
        nodes.push({ kind: 'block', block, index: i })
      }
      continue
    }

    const group = block.columnGroupId ? groups.get(block.columnGroupId) : undefined
    if (group) {
      group.children.push({ block, index: i })
    } else {
      // Anak tanpa header (header yatim/hilang) diperlakukan sebagai blok biasa.
      nodes.push({ kind: 'block', block, index: i })
    }
  }

  for (const group of groups.values()) {
    let columnCount = Math.max(1, group.header.columnWidths?.length ?? 0)
    for (const child of group.children) {
      const index = child.block.columnIndex
      if (typeof index === 'number' && Number.isFinite(index)) {
        columnCount = Math.max(columnCount, Math.floor(index) + 1)
      }
    }

    group.widths = normalizeWidths(group.header.columnWidths, columnCount)
    group.columns = Array.from({ length: columnCount }, () => [] as B[])
    for (const child of group.children) {
      const raw = child.block.columnIndex
      const index =
        typeof raw === 'number' && Number.isFinite(raw)
          ? Math.min(Math.max(Math.floor(raw), 0), columnCount - 1)
          : 0
      group.columns[index].push(child.block)
    }
  }

  return nodes
}

/** Kebalikan groupBlocks: urutan flat asli kembali utuh. */
export function flattenColumns<B extends ColumnBlock>(
  nodes: readonly ColumnRenderNode<B>[]
): B[] {
  const entries: ColumnChild<B>[] = []
  for (const node of nodes) {
    if (node.kind === 'block') {
      entries.push({ block: node.block, index: node.index })
      continue
    }
    entries.push({ block: node.header, index: node.headerIndex })
    for (const child of node.children) entries.push(child)
  }
  entries.sort((a, b) => a.index - b.index)
  return entries.map((entry) => entry.block)
}

/** Sisipkan header grup baru (plus kolom kosong) setelah afterId. */
export function createColumnGroup(
  blocks: readonly ColumnBlock[],
  afterId: string | null | undefined,
  count: number
): ColumnBlock[] {
  const columnCount = Math.max(1, toCount(count))
  const existing = new Set(blocks.map((block) => block.id))
  const headerId = uniqueId(existing, 'col-group')

  const header: ColumnBlock = {
    id: headerId,
    type: 'columns',
    content: '',
    columnWidths: normalizeWidths(undefined, columnCount)
  }

  const cells: ColumnBlock[] = []
  for (let i = 0; i < columnCount; i += 1) {
    cells.push({
      id: uniqueId(existing, `${headerId}-c${i}`),
      type: 'paragraph',
      content: '',
      columnGroupId: headerId,
      columnIndex: i
    })
  }

  const result = blocks.slice()
  const anchor = afterId ? result.findIndex((block) => block.id === afterId) : -1
  const insertAt = anchor >= 0 ? anchor + 1 : result.length
  result.splice(insertAt, 0, header, ...cells)
  return result
}

/**
 * Hapus satu kolom dari grup, tetapi isinya DIPINDAH ke kolom tetangga.
 * Jumlah blok sebelum == sesudah.
 */
export function removeColumn<B extends ColumnBlock>(
  blocks: readonly B[],
  groupId: string,
  columnIndex: number
): B[] {
  const list = blocks.slice()
  const header = list.find((block) => block.id === groupId && block.type === 'columns')
  if (!header) return list

  const children = list.filter((block) => block.columnGroupId === groupId)
  let columnCount = Math.max(1, header.columnWidths?.length ?? 0)
  for (const child of children) {
    const index = child.columnIndex
    if (typeof index === 'number' && Number.isFinite(index)) {
      columnCount = Math.max(columnCount, Math.floor(index) + 1)
    }
  }

  const target = Number.isFinite(columnIndex) ? Math.floor(columnIndex) : -1
  if (target < 0 || target >= columnCount) return list
  const remaining = columnCount - 1
  if (remaining < 1) return list

  const destination = Math.min(target, remaining - 1)
  const nextWidths = normalizeWidths(
    (header.columnWidths ?? []).filter((_, index) => index !== target),
    remaining
  )

  return list.map((block) => {
    if (block.id === groupId && block.type === 'columns') {
      return { ...block, columnWidths: nextWidths }
    }
    if (block.columnGroupId !== groupId) return block

    const current =
      typeof block.columnIndex === 'number' && Number.isFinite(block.columnIndex)
        ? Math.floor(block.columnIndex)
        : 0
    if (current === target) return { ...block, columnIndex: destination }
    if (current > target) return { ...block, columnIndex: current - 1 }
    return block
  })
}

/** Pindahkan satu blok ke kolom lain; urutan relatif blok lain dipertahankan. */
export function moveBlockToColumn<B extends ColumnBlock>(
  blocks: readonly B[],
  blockId: string,
  groupId: string,
  columnIndex: number
): B[] {
  const list = blocks.slice()
  const fromIndex = list.findIndex((block) => block.id === blockId)
  if (fromIndex < 0) return list
  if (blockId === groupId) return list

  const header = list.find((block) => block.id === groupId && block.type === 'columns')
  if (!header) return list

  let columnCount = Math.max(1, header.columnWidths?.length ?? 0)
  for (const block of list) {
    if (block.columnGroupId !== groupId) continue
    const index = block.columnIndex
    if (typeof index === 'number' && Number.isFinite(index)) {
      columnCount = Math.max(columnCount, Math.floor(index) + 1)
    }
  }

  const target = Number.isFinite(columnIndex) ? Math.floor(columnIndex) : -1
  if (target < 0 || target >= columnCount) return list

  const moved = { ...list[fromIndex], columnGroupId: groupId, columnIndex: target }
  list.splice(fromIndex, 1)

  let insertAt = -1
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const block = list[i]
    if (block.columnGroupId === groupId && block.columnIndex === target) {
      insertAt = i + 1
      break
    }
  }
  if (insertAt < 0) {
    const headerIndex = list.findIndex((block) => block.id === groupId)
    insertAt = headerIndex + 1
  }

  list.splice(insertAt, 0, moved)
  return list
}
