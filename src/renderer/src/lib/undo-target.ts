/**
 * Menentukan halaman yang menjadi target undo/redo.
 *
 * Modul MURNI: tanpa React/DOM, bisa dites di node.
 *
 * Saat split pane aktif, user bisa sedang mengedit pane kanan (splitPageId),
 * sementara activePageId masih menunjuk pane kiri. Undo harus mengikuti pane
 * yang fokus, bukan selalu halaman tab aktif. Kalau split pane sudah ditutup
 * (splitPageId null), fokus kembali ke pane primary.
 */

export interface UndoTargetInput {
  focusedPane: 'primary' | 'split'
  activePageId: string
  splitPageId: string | null
}

export function resolveUndoTarget({
  focusedPane,
  activePageId,
  splitPageId
}: UndoTargetInput): string {
  if (focusedPane === 'split' && splitPageId) return splitPageId
  return activePageId
}
