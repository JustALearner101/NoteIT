/**
 * Aritmetika tanggal-only (YYYY-MM-DD) untuk Project Database.
 *
 * Tanggal di NoteIT adalah tanggal kalender, bukan instant. Semua matematika
 * memakai Date.UTC supaya bebas DST; "hari ini" memakai waktu lokal.
 * Tidak ada fallback ke tanggal karangan: input tidak valid menghasilkan null.
 */
import { toLocalIsoDate } from '@shared/date'

export { toLocalIsoDate }

export const DAY_MS = 86400000

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** YYYY-MM-DD -> epoch ms (UTC tengah malam), atau null kalau tidak valid. */
export function parseIsoDate(iso: string): number | null {
  const match = ISO_DATE_RE.exec(iso)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const ms = Date.UTC(year, month - 1, day)
  const date = new Date(ms)

  // Round-trip: menolak 2026-02-30, 2025-02-29, bulan 13, dan sejenisnya.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return ms
}

/** epoch ms -> YYYY-MM-DD (komponen UTC). */
export function formatIsoDate(ms: number): string {
  const date = new Date(ms)
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

/** Geser tanggal sejumlah hari (boleh negatif). Input tidak valid dikembalikan apa adanya. */
export function addDays(iso: string, days: number): string {
  const ms = parseIsoDate(iso)
  if (ms === null) return iso
  return formatIsoDate(ms + days * DAY_MS)
}

/** Selisih hari a - b. Null kalau salah satu tidak valid. */
export function diffDays(a: string, b: string): number | null {
  const aMs = parseIsoDate(a)
  const bMs = parseIsoDate(b)
  if (aMs === null || bMs === null) return null
  return Math.round((aMs - bMs) / DAY_MS)
}

/** Tanggal lokal hari ini, YYYY-MM-DD. */
export function todayIso(): string {
  return toLocalIsoDate(new Date())
}
