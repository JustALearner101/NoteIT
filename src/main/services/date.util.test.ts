import { describe, expect, it } from 'vitest'
import { formatDailyTitle } from './date.util'

describe('formatDailyTitle', () => {
  it('memakai waktu lokal: 2026-01-05 pukul 23:30 tidak bergeser ke tanggal UTC', () => {
    expect(formatDailyTitle(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })

  it('mem-pad bulan dan tanggal menjadi dua digit', () => {
    expect(formatDailyTitle(new Date(2026, 8, 9, 8, 0))).toBe('2026-09-09')
  })
})
