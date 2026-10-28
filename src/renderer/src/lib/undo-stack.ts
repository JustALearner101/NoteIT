/**
 * Undo/redo per halaman, in-memory, tanpa React/DOM — bisa dites di node.
 *
 * Semantik snapshot: yang di-push adalah state SEBELUM perubahan.
 * Coalescing: push berikutnya untuk pageId yang sama dalam coalesceMs sejak push
 * terakhir tidak menambah entri (satu paragraf ketikan = satu langkah undo).
 * Window coalescing bergeser (sliding), jadi mengetik terus-menerus tetap
 * menghasilkan satu entri sampai berhenti sejenak.
 *
 * undo(pageId, current) menerima state SEKARANG supaya state itu bisa masuk ke
 * redo stack — stack murni tidak tahu isi state terbaru. Tanpa argumen current,
 * redo untuk langkah tersebut tidak bisa dipulihkan (redo mengembalikan null).
 */

export interface UndoStackOptions {
  /** Maksimum entri undo per halaman. Entri tertua dibuang. */
  limit?: number
  /** Jendela penggabungan push berurutan, milidetik. */
  coalesceMs?: number
}

export interface UndoStack<T> {
  push: (pageId: string, snapshot: T) => void
  undo: (pageId: string, current?: T) => T | null
  redo: (pageId: string) => T | null
  canUndo: (pageId: string) => boolean
  canRedo: (pageId: string) => boolean
  clear: (pageId: string) => void
}

interface PageHistory<T> {
  undo: T[]
  redo: T[]
  lastPushAt: number | null
}

export function createUndoStack<T>({
  limit = 50,
  coalesceMs = 500
}: UndoStackOptions = {}): UndoStack<T> {
  const histories = new Map<string, PageHistory<T>>()

  const historyOf = (pageId: string): PageHistory<T> => {
    const existing = histories.get(pageId)
    if (existing) return existing
    const created: PageHistory<T> = { undo: [], redo: [], lastPushAt: null }
    histories.set(pageId, created)
    return created
  }

  const trim = (entries: T[]): void => {
    if (entries.length > limit) entries.splice(0, entries.length - limit)
  }

  return {
    push: (pageId, snapshot) => {
      const history = historyOf(pageId)
      const now = Date.now()

      if (history.lastPushAt !== null && now - history.lastPushAt < coalesceMs) {
        // Masih dalam jendela coalescing: entri lama dipertahankan, window digeser.
        history.lastPushAt = now
        return
      }

      history.undo.push(snapshot)
      trim(history.undo)
      history.redo.length = 0
      history.lastPushAt = now
    },

    undo: (pageId, current) => {
      const history = histories.get(pageId)
      if (!history || history.undo.length === 0) return null

      const snapshot = history.undo.pop() as T
      if (current !== undefined) history.redo.push(current)
      history.lastPushAt = null
      return snapshot
    },

    redo: (pageId) => {
      const history = histories.get(pageId)
      if (!history || history.redo.length === 0) return null

      const snapshot = history.redo.pop() as T
      history.undo.push(snapshot)
      trim(history.undo)
      history.lastPushAt = null
      return snapshot
    },

    canUndo: (pageId) => (histories.get(pageId)?.undo.length ?? 0) > 0,

    canRedo: (pageId) => (histories.get(pageId)?.redo.length ?? 0) > 0,

    clear: (pageId) => {
      histories.delete(pageId)
    }
  }
}

