import type { DocumentBlock } from './types/domain'

export interface BlockDiff {
  /** id blok yang hanya ada di kondisi sekarang. */
  added: string[]
  /** id blok yang hanya ada di snapshot. */
  removed: string[]
  /** id blok yang sama-sama ada tapi type/content/checked berubah. */
  changed: string[]
  /** jumlah blok yang sama persis. */
  unchanged: number
  titleChanged: boolean
}

export interface BlockDiffTitles {
  current: string
  snapshot: string
}

function isBlockChanged(current: DocumentBlock, snapshot: DocumentBlock): boolean {
  // Urutan blok sengaja tidak dibandingkan: pindah posisi bukan perubahan isi.
  return (
    current.type !== snapshot.type ||
    current.content !== snapshot.content ||
    Boolean(current.checked) !== Boolean(snapshot.checked)
  )
}

/**
 * Diff dari snapshot (lama) ke kondisi sekarang (baru): added = ada di current saja,
 * removed = ada di snapshot saja. Perbandingan dilakukan per id blok.
 *
 * titleChanged hanya diisi kalau pemanggil memberi judul kedua sisi; tanpa itu
 * fungsi ini murni tentang blok.
 */
export function diffBlockSets(
  current: DocumentBlock[],
  snapshot: DocumentBlock[],
  titles?: BlockDiffTitles
): BlockDiff {
  const snapshotById = new Map(snapshot.map((block) => [block.id, block]))
  const currentIds = new Set(current.map((block) => block.id))

  const added: string[] = []
  const changed: string[] = []
  let unchanged = 0

  for (const block of current) {
    const previous = snapshotById.get(block.id)
    if (!previous) {
      added.push(block.id)
      continue
    }
    if (isBlockChanged(block, previous)) {
      changed.push(block.id)
    } else {
      unchanged += 1
    }
  }

  const removed = snapshot.filter((block) => !currentIds.has(block.id)).map((block) => block.id)

  return {
    added,
    removed,
    changed,
    unchanged,
    titleChanged: titles ? titles.current !== titles.snapshot : false
  }
}
