/**
 * Judul daily note selalu YYYY-MM-DD waktu LOKAL.
 *
 * Sengaja tidak memakai toISOString(): di WIB (UTC+7) pukul 23:30 tanggal 5 masih
 * tanggal 5 bagi pengguna, tetapi UTC sudah bergeser ke tanggal 6.
 */
export function formatDailyTitle(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}
