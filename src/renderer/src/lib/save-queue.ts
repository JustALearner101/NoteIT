/**
 * Save queue dengan debounce per halaman.
 *
 * Modul MURNI: tidak menyentuh React, DOM, atau window — bisa dites di node.
 *
 * Tanggung jawab:
 *  - menampung patch TERAKHIR per pageId (shallow merge, field yang sama ditimpa),
 *  - menjadwalkan flush otomatis setelah delayMs,
 *  - menyediakan flushAll() sinkron dan cancelAll().
 *
 * BATASAN YANG HARUS DIINGAT:
 * Maksimum 350ms edit terakhir bisa hilang kalau app di-kill paksa (Task Manager,
 * crash, listrik mati). 'beforeunload' tidak bisa menunggu IPC async, jadi flush
 * saat window ditutup hanya MENGIRIM pesan — tidak ada jaminan main process
 * selesai menulis ke SQLite sebelum proses renderer dimatikan.
 */

export interface SaveQueueOptions<P extends object> {
  /** Jeda idle sebelum patch dikirim, dalam milidetik. */
  delayMs: number
  /** Pemanggil sinkron yang mengirim patch gabungan ke main process. */
  send: (pageId: string, patch: P) => void
}

export interface SaveQueue<P extends object> {
  /** Tambah/merge patch untuk pageId; me-reset timer pageId itu saja. */
  enqueue: (pageId: string, patch: P) => void
  /** Kirim semua patch yang tertunda sekarang juga (sinkron). */
  flushAll: () => void
  /** Buang semua patch tertunda tanpa mengirim. */
  cancelAll: () => void
  hasPending: (pageId: string) => boolean
}

export function createSaveQueue<P extends object>({
  delayMs,
  send
}: SaveQueueOptions<P>): SaveQueue<P> {
  const pending = new Map<string, P>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const clearTimer = (pageId: string): void => {
    const timer = timers.get(pageId)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(pageId)
    }
  }

  const flushPage = (pageId: string): void => {
    clearTimer(pageId)
    const patch = pending.get(pageId)
    pending.delete(pageId)
    if (patch !== undefined) send(pageId, patch)
  }

  return {
    enqueue: (pageId, patch) => {
      const queued = pending.get(pageId)
      // Shallow merge: field yang sama ditimpa patch terbaru, field lain dipertahankan.
      pending.set(pageId, (queued ? { ...queued, ...patch } : { ...patch }) as P)
      clearTimer(pageId)
      timers.set(
        pageId,
        setTimeout(() => flushPage(pageId), delayMs)
      )
    },

    flushAll: () => {
      for (const pageId of Array.from(pending.keys())) flushPage(pageId)
    },

    cancelAll: () => {
      for (const pageId of Array.from(timers.keys())) clearTimer(pageId)
      pending.clear()
    },

    hasPending: (pageId) => pending.has(pageId)
  }
}

