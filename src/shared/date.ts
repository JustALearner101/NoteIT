/**
 * Tanggal lokal YYYY-MM-DD.
 *
 * Sengaja tidak memakai toISOString(): di WIB (UTC+7) pukul 23:30 tanggal 5 masih
 * tanggal 5 bagi pengguna, tetapi UTC sudah bergeser ke tanggal 6.
 *
 * Dipakai bersama oleh daily note (main) dan Calendar/Project Database (renderer)
 * supaya definisi "hari ini" hanya ada satu.
 */
export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

/**
 * Local timestamp YYYYMMDD-HHmmss used for backup & export filenames.
 */
export function formatLocalTimestamp(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('') +
    '-' +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('')
  )
}

/**
 * Compact relative time label for recent epoch ms timestamps.
 */
export function formatRelativeTime(timestamp: number, options?: { showSeconds?: boolean }): string {
  const elapsed = Date.now() - timestamp
  if (elapsed < 60_000) {
    return options?.showSeconds ? `${Math.max(1, Math.floor(elapsed / 1000))}s ago` : 'just now'
  }
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`
  if (options?.showSeconds || elapsed < 7 * 86_400_000) {
    return `${Math.floor(elapsed / 86_400_000)}d ago`
  }
  return new Date(timestamp).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}
