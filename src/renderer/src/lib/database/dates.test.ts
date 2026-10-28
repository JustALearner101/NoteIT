import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  addDays,
  diffDays,
  formatIsoDate,
  parseIsoDate,
  toLocalIsoDate,
  todayIso
} from './dates'

describe('parseIsoDate', () => {
  it('mengembalikan null untuk string yang bukan tanggal', () => {
    expect(parseIsoDate('bukan-tanggal')).toBeNull()
    expect(parseIsoDate('2026-10')).toBeNull()
    expect(parseIsoDate('27-10-2026')).toBeNull()
    expect(parseIsoDate('')).toBeNull()
  })

  it('mengembalikan null untuk tanggal yang tidak ada di kalender', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('2026-00-10')).toBeNull()
    expect(parseIsoDate('2026-04-31')).toBeNull()
  })

  it('menerima 29 Februari hanya di tahun kabisat', () => {
    expect(parseIsoDate('2024-02-29')).toBe(Date.UTC(2024, 1, 29))
    expect(parseIsoDate('2025-02-29')).toBeNull()
  })

  it('memetakan ke tengah malam UTC, bukan waktu lokal', () => {
    expect(parseIsoDate('2026-10-27')).toBe(Date.UTC(2026, 9, 27))
  })
})

describe('formatIsoDate', () => {
  it('bolak-balik dengan parseIsoDate', () => {
    const ms = parseIsoDate('2026-10-27')
    expect(ms).not.toBeNull()
    expect(formatIsoDate(ms as number)).toBe('2026-10-27')
  })

  it('mem-pad bulan dan tanggal menjadi dua digit', () => {
    expect(formatIsoDate(Date.UTC(2026, 0, 5))).toBe('2026-01-05')
    expect(formatIsoDate(Date.UTC(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('addDays', () => {
  it('melintasi batas tahun', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('menerima delta negatif', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('menghormati tahun kabisat', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
  })

  it('mengembalikan input apa adanya kalau tanggal tidak valid', () => {
    expect(addDays('2026-02-30', 3)).toBe('2026-02-30')
  })
})

describe('diffDays', () => {
  it('menghitung selisih hari a - b', () => {
    expect(diffDays('2026-03-01', '2026-02-28')).toBe(1)
    expect(diffDays('2026-10-27', '2026-10-27')).toBe(0)
    expect(diffDays('2026-10-27', '2026-10-31')).toBe(-4)
    expect(diffDays('2027-01-01', '2026-12-31')).toBe(1)
  })

  it('null kalau salah satu tanggal tidak valid', () => {
    expect(diffDays('2026-02-30', '2026-02-01')).toBeNull()
    expect(diffDays('2026-02-01', 'bukan-tanggal')).toBeNull()
  })
})

describe('aritmetika tanggal-only bebas DST', () => {
  it('tetap 1 hari pada pergantian DST', () => {
    // 8 Maret 2026 = DST mulai di AS, 25 Oktober 2026 = DST berakhir di Eropa.
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(diffDays('2026-03-09', '2026-03-08')).toBe(1)
    expect(diffDays('2026-10-26', '2026-10-25')).toBe(1)
    expect((parseIsoDate('2026-03-09') as number) - (parseIsoDate('2026-03-08') as number)).toBe(
      DAY_MS
    )
  })
})

describe('toLocalIsoDate dan todayIso', () => {
  it('memakai waktu lokal, bukan UTC', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
    expect(toLocalIsoDate(new Date(2026, 8, 9, 8, 0))).toBe('2026-09-09')
  })

  it('todayIso sama dengan tanggal lokal sekarang', () => {
    expect(todayIso()).toBe(toLocalIsoDate(new Date()))
  })
})
