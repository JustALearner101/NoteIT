import { describe, expect, it } from 'vitest'
import {
  FALLBACK_ASSET_MIME,
  assetFileName,
  assetRelativePath,
  assetUrl,
  extensionFromFileName,
  formatAssetSize,
  isImageMime,
  isPdfMime,
  mimeForExtension,
  normalizeAssetExtension,
  parseRangeHeader
} from './assets'

describe('shared/assets — ekstensi dan MIME', () => {
  it('mengenali ekstensi umum beserta titik dan huruf besar', () => {
    expect(normalizeAssetExtension('Laporan.PDF')).toBe('pdf')
    expect(normalizeAssetExtension('.png')).toBe('png')
    expect(normalizeAssetExtension('foto.jpeg')).toBe('jpeg')
  })

  it('memakai ekstensi fallback saat nama tidak punya ekstensi', () => {
    expect(extensionFromFileName('README')).toBe('bin')
    expect(extensionFromFileName('')).toBe('bin')
    expect(extensionFromFileName('.png')).toBe('png')
    expect(extensionFromFileName('arsip.tar.gz')).toBe('gz')
  })

  it('membuang karakter berbahaya dari ekstensi (anti path traversal)', () => {
    expect(normalizeAssetExtension('..\\..\\evil.png')).toBe('png')
    expect(normalizeAssetExtension('a.p/../ng')).toBe('ng')
    expect(normalizeAssetExtension('x.\\..\\')).toBe('bin')
    expect(normalizeAssetExtension('a.' + 'z'.repeat(40))).toHaveLength(10)
  })

  it('memetakan ekstensi ke MIME dan jatuh ke octet-stream untuk yang tak dikenal', () => {
    expect(mimeForExtension('png')).toBe('image/png')
    expect(mimeForExtension('.PDF')).toBe('application/pdf')
    expect(mimeForExtension('zzz')).toBe(FALLBACK_ASSET_MIME)
    expect(mimeForExtension('')).toBe(FALLBACK_ASSET_MIME)
  })

  it('mengklasifikasi gambar dan PDF tanpa menebak untuk ekstensi asing', () => {
    expect(isImageMime('image/webp')).toBe(true)
    expect(isImageMime('application/pdf')).toBe(false)
    expect(isPdfMime('application/pdf')).toBe(true)
    expect(isPdfMime(FALLBACK_ASSET_MIME)).toBe(false)
  })
})

describe('shared/assets — penamaan dan URL', () => {
  it('membangun nama berkas, path relatif, dan URL kanonik', () => {
    expect(assetFileName('a'.repeat(64), 'png')).toBe(`${'a'.repeat(64)}.png`)
    expect(assetRelativePath('b'.repeat(64), 'pdf')).toBe(`assets/${'b'.repeat(64)}.pdf`)
    expect(assetUrl('c'.repeat(64), 'png')).toBe(`noteit-asset://asset/${'c'.repeat(64)}.png`)
  })

  it('menormalkan ekstensi pada nama berkas', () => {
    expect(assetFileName('d'.repeat(64), 'PDF')).toBe(`${'d'.repeat(64)}.pdf`)
    expect(assetFileName('e'.repeat(64), '../x')).toBe(`${'e'.repeat(64)}.x`)
  })

  it('memformat ukuran aset untuk kartu berkas', () => {
    expect(formatAssetSize(0)).toBe('0 B')
    expect(formatAssetSize(512)).toBe('512 B')
    expect(formatAssetSize(2048)).toBe('2.0 KB')
    expect(formatAssetSize(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatAssetSize(Number.NaN)).toBe('0 B')
  })
})

describe('shared/assets — parseRangeHeader', () => {
  it('membaca rentang tertutup dan terbuka', () => {
    expect(parseRangeHeader('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(parseRangeHeader('bytes=500-', 1000)).toEqual({ start: 500, end: 999 })
  })

  it('membaca rentang suffix', () => {
    expect(parseRangeHeader('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
  })

  it('membatasi end ke ukuran berkas', () => {
    expect(parseRangeHeader('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 })
  })

  it('menolak header rusak, kosong, multi-range, dan start di luar berkas', () => {
    expect(parseRangeHeader(null, 1000)).toBeNull()
    expect(parseRangeHeader('', 1000)).toBeNull()
    expect(parseRangeHeader('items=0-10', 1000)).toBeNull()
    expect(parseRangeHeader('bytes=0-10,20-30', 1000)).toBeNull()
    expect(parseRangeHeader('bytes=abc-def', 1000)).toBeNull()
    expect(parseRangeHeader('bytes=1000-', 1000)).toBeNull()
    expect(parseRangeHeader('bytes=50-10', 1000)).toBeNull()
    expect(parseRangeHeader('bytes=0-10', 0)).toBeNull()
  })
})
