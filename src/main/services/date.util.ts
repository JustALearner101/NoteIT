import { toLocalIsoDate } from '@shared/date'

/**
 * Judul daily note selalu YYYY-MM-DD waktu LOKAL.
 *
 * Logikanya tinggal di src/shared/date.ts supaya daily note dan Calendar memakai
 * definisi "hari ini" yang sama.
 */
export function formatDailyTitle(date: Date): string {
  return toLocalIsoDate(date)
}
