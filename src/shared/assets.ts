/**
 * Tabel ekstensi → MIME untuk aset lokal. Sengaja tabel statis: menambah paket
 * `mime` hanya untuk 20 ekstensi tidak sepadan, dan aset selalu berasal dari
 * berkas yang namanya kita lihat sendiri.
 */
export const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  sql: 'application/sql',
  zip: 'application/zip',
  gz: 'application/gzip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  webm: 'video/webm'
}

export const FALLBACK_ASSET_MIME = 'application/octet-stream'
export const FALLBACK_ASSET_EXTENSION = 'bin'

/** Ekstensi yang aman dipakai sebagai bagian nama berkas: alfanumerik lowercase, maks 10. */
export function normalizeAssetExtension(nameOrExtension: string): string {
  const raw = String(nameOrExtension || '')
  const dotIndex = raw.lastIndexOf('.')
  const candidate = (dotIndex >= 0 ? raw.slice(dotIndex + 1) : raw).toLowerCase()
  const cleaned = candidate.replace(/[^a-z0-9]/g, '').slice(0, 10)
  return cleaned.length > 0 ? cleaned : FALLBACK_ASSET_EXTENSION
}

/** Nama berkas tanpa titik sama sekali tidak punya ekstensi → 'bin'. */
export function extensionFromFileName(fileName: string): string {
  const raw = String(fileName || '')
  if (!raw.includes('.')) return FALLBACK_ASSET_EXTENSION
  return normalizeAssetExtension(raw)
}

/** Ekstensi tak dikenal tetap diizinkan, tapi tidak pernah menebak MIME. */
export function mimeForExtension(extension: string): string {
  const ext = String(extension || '').toLowerCase().replace(/^\./, '')
  return MIME_BY_EXTENSION[ext] ?? FALLBACK_ASSET_MIME
}

export function isImageMime(mime: string): boolean {
  return String(mime || '').toLowerCase().startsWith('image/')
}

export function isPdfMime(mime: string): boolean {
  return String(mime || '').toLowerCase() === 'application/pdf'
}

/** Nama berkas content-addressed di folder assets. */
export function assetFileName(assetId: string, extension: string): string {
  return `${assetId}.${normalizeAssetExtension(extension)}`
}

/** Path relatif yang dipakai di markdown ekspor dan di folder backup. */
export function assetRelativePath(assetId: string, extension: string): string {
  return `assets/${assetFileName(assetId, extension)}`
}

/** URL kanonik: noteit-asset://asset/<hash>.<ext> (host eksplisit agar path tidak ambigu). */
export function assetUrl(assetId: string, extension: string): string {
  return `noteit-asset://asset/${assetFileName(assetId, extension)}`
}

export function formatAssetSize(bytes: number): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export interface ByteRange {
  start: number
  end: number
}

/**
 * Parse header Range satu rentang. Multi-range dan header rusak → null
 * (pemanggil menjawab dengan seluruh berkas, bukan 206 yang salah).
 */
export function parseRangeHeader(header: string | null, size: number): ByteRange | null {
  if (!header || size <= 0) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const rawStart = match[1]
  const rawEnd = match[2]
  if (rawStart === '' && rawEnd === '') return null

  let start: number
  let end: number

  if (rawStart === '') {
    const suffixLength = Number(rawEnd)
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Number(rawEnd)
  }

  if (!Number.isInteger(start) || !Number.isInteger(end)) return null
  if (start < 0 || start >= size || end < start) return null

  return { start, end: Math.min(end, size - 1) }
}
