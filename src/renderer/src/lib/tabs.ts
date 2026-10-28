/**
 * Aturan murni untuk multi-tab workbench.
 *
 * Modul MURNI: tanpa React, DOM, atau window — bisa dites di node.
 *
 * Semua fungsi mengembalikan array/objek BARU hanya kalau ada perubahan.
 * Operasi no-op (id sama, id tidak dikenal, tab terakhir) mengembalikan
 * referensi array yang sama supaya pemanggil bisa mendeteksi "tidak ada
 * perubahan" tanpa deep-compare.
 */

/** Key localStorage untuk state tab. Naikkan versi kalau bentuknya berubah. */
export const TABS_STORAGE_KEY = 'noteit:tabs:v1'
export const TABS_STORAGE_VERSION = 1

/** Batas riwayat tab yang ditutup (Ctrl/Cmd+Shift+T). */
export const MAX_REOPEN_STACK = 10

export const SPLIT_RATIO_MIN = 0.2
export const SPLIT_RATIO_MAX = 0.8
export const SPLIT_RATIO_DEFAULT = 0.5

export interface TabPersistState {
  openTabIds: string[]
  activePageId: string
  splitPageId: string | null
  splitRatio: number
}

/**
 * Pindahkan tab `fromId` ke posisi tab `toId` (posisi tujuan, bukan "sebelum").
 * Id yang sama atau tidak dikenal = no-op.
 */
export function reorderTabs(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId)
  const to = ids.indexOf(toId)
  if (from < 0 || to < 0 || from === to) return ids
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, fromId)
  return next
}

/**
 * Tutup satu tab.
 *
 * Kalau tab yang ditutup adalah tab aktif, aktif pindah ke tetangga kanan,
 * lalu tetangga kiri, lalu tab pertama. Tab terakhir tidak pernah ditutup:
 * workbench harus selalu punya satu halaman aktif.
 */
export function closeTabIds(
  ids: string[],
  activeId: string,
  closeId: string
): { ids: string[]; activeId: string } {
  const index = ids.indexOf(closeId)
  if (index < 0 || ids.length <= 1) return { ids, activeId }

  const remaining = ids.filter((_, i) => i !== index)
  if (activeId !== closeId) return { ids: remaining, activeId }

  const nextActive = remaining[index] ?? remaining[index - 1] ?? remaining[0] ?? ''
  return { ids: remaining, activeId: nextActive }
}

/** Tutup semua tab kecuali `keepId`. */
export function closeOthers(ids: string[], keepId: string): string[] {
  if (!ids.includes(keepId)) return ids
  return ids.filter((id) => id === keepId)
}

/** Tutup semua tab di sebelah kanan `id` (tab `id` tetap). */
export function closeToRight(ids: string[], id: string): string[] {
  const index = ids.indexOf(id)
  if (index < 0 || index === ids.length - 1) return ids
  return ids.slice(0, index + 1)
}

/**
 * Tab berikutnya/previous dengan wrap di kedua ujung.
 * delta positif = ke kanan, negatif = ke kiri, 0 = tetap.
 */
export function nextTabId(ids: string[], activeId: string, delta: number): string {
  if (ids.length === 0) return ''
  const current = ids.indexOf(activeId)
  if (current < 0) return delta < 0 ? ids[ids.length - 1] : ids[0]
  const len = ids.length
  const next = (((current + delta) % len) + len) % len
  return ids[next]
}

/** Buang id yang tidak ada lagi di workspace, dan buang duplikat. */
export function pruneTabs(ids: string[], validIds: Iterable<string>): string[] {
  const valid = validIds instanceof Set ? validIds : new Set(validIds)
  const seen = new Set<string>()
  const next: string[] = []
  for (const id of ids) {
    if (!valid.has(id) || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids
  return next
}

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return SPLIT_RATIO_DEFAULT
  return Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, ratio))
}

/** Bentuk yang disimpan ke localStorage. `v` dipakai parseTabs untuk menolak versi lama. */
export function serializeTabs(state: TabPersistState): string {
  return JSON.stringify({
    v: TABS_STORAGE_VERSION,
    openTabIds: state.openTabIds,
    activePageId: state.activePageId,
    splitPageId: state.splitPageId,
    splitRatio: clampSplitRatio(state.splitRatio)
  })
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/**
 * Baca state tab yang dipersist.
 *
 * Mengembalikan null kalau data tidak bisa dipercaya sama sekali:
 * JSON rusak, versi beda, bentuk salah, atau tidak ada satu pun tab yang
 * masih valid di workspace. Id yang sebagian tidak valid dipangkas, dan
 * activePageId/splitPageId yang hilang jatuh ke tab pertama / null —
 * lebih baik pulih sebagian daripada membuang seluruh sesi.
 */
export function parseTabs(raw: string | null, validIds: Iterable<string>): TabPersistState | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>

  if (record.v !== TABS_STORAGE_VERSION) return null
  if (!isStringArray(record.openTabIds)) return null
  if (typeof record.activePageId !== 'string') return null
  if (record.splitPageId !== null && typeof record.splitPageId !== 'string') return null
  if (typeof record.splitRatio !== 'number') return null

  const valid = validIds instanceof Set ? validIds : new Set(validIds)
  const openTabIds = pruneTabs(record.openTabIds, valid)
  if (openTabIds.length === 0) return null

  const activePageId = openTabIds.includes(record.activePageId)
    ? record.activePageId
    : openTabIds[0]

  const splitPageId =
    typeof record.splitPageId === 'string' && valid.has(record.splitPageId)
      ? record.splitPageId
      : null

  return {
    openTabIds: [...openTabIds],
    activePageId,
    splitPageId,
    splitRatio: clampSplitRatio(record.splitRatio)
  }
}

/** Dorong tab yang ditutup ke riwayat reopen (paling baru di ujung), maks 10. */
export function pushReopen(id: string, stack: string[]): string[] {
  return [...stack, id].slice(-MAX_REOPEN_STACK)
}

/** Ambil tab terakhir yang ditutup; null kalau riwayat kosong. */
export function popReopen(stack: string[]): { id: string; rest: string[] } | null {
  if (stack.length === 0) return null
  return { id: stack[stack.length - 1], rest: stack.slice(0, -1) }
}
