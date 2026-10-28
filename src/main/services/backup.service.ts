import fs from 'fs'
import path from 'path'
import { getDb, getDbPath } from '../db/client'

export interface BackupResult {
  ok: boolean
  filePath?: string
  /** Folder aset pasangan backup ini (backups/noteit-....assets), kalau ada aset. */
  assetDir?: string
  assetFileCount?: number
  error?: string
}

export type BackupLogLevel = 'INFO' | 'WARN' | 'ERROR'
export type BackupLogger = (level: BackupLogLevel, message: string, detail?: unknown) => void

const BACKUP_PREFIX = 'noteit-'
const BACKUP_EXTENSION = '.db'
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000
const DEFAULT_MAX_AGE_DAYS = 7
const DEFAULT_MAX_FILES = 7

let backupTimer: ReturnType<typeof setInterval> | null = null
let inProgress = false
let backupLogger: BackupLogger | null = null

/**
 * Timestamp lokal YYYYMMDD-HHmmss untuk nama berkas backup.
 */
export function formatBackupTimestamp(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('') +
    '-' +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('')
  )
}

/**
 * Folder backup selalu bersaudara dengan berkas database: <dir db>/backups.
 */
export function getBackupDir(): string {
  const dbPath = getDbPath()
  if (!dbPath) {
    throw new Error('Path database belum tersedia; backup tidak bisa dijalankan.')
  }
  return path.join(path.dirname(dbPath), 'backups')
}

/** Folder aset aktif: bersaudara dengan database, sama seperti getAssetsDir di asset.service. */
export function getAssetsSourceDir(): string {
  const dbPath = getDbPath()
  if (!dbPath) {
    throw new Error('Path database belum tersedia; folder aset tidak bisa ditentukan.')
  }
  return path.join(path.dirname(dbPath), 'assets')
}

/** Nama folder aset pasangan sebuah backup: noteit-X.db → noteit-X.assets. */
export function getBackupAssetDir(dbFilePath: string): string {
  return dbFilePath.replace(/\.db$/i, '.assets')
}

/**
 * Salin aset secara inkremental: hanya berkas yang belum ada di tujuan.
 * Berkas yang sudah ada tidak pernah ditimpa (mtime backup lama tetap utuh),
 * jadi menjalankan fungsi ini dua kali pada tujuan yang sama adalah no-op.
 */
export function copyAssetsIncremental(
  sourceDir: string,
  targetDir: string
): { copied: string[] } {
  const copied: string[] = []
  if (!fs.existsSync(sourceDir)) return { copied }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const targetPath = path.join(targetDir, entry.name)
    if (fs.existsSync(targetPath)) continue

    fs.mkdirSync(targetDir, { recursive: true })
    // copyFileSync: aset biner, bukan teks utf-8.
    fs.copyFileSync(path.join(sourceDir, entry.name), targetPath)
    copied.push(entry.name)
  }

  return { copied }
}

function isBackupFileName(name: string): boolean {
  return (
    name.startsWith(BACKUP_PREFIX) &&
    name.endsWith(BACKUP_EXTENSION) &&
    name.length > BACKUP_PREFIX.length + BACKUP_EXTENSION.length
  )
}

function quoteSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Salin database aktif ke backups/noteit-YYYYMMDD-HHmmss.db memakai VACUUM INTO.
 * Nama yang sudah terpakai (backup kedua pada detik yang sama) diberi suffix -2, -3, dst.
 */
export function runBackup(): BackupResult {
  try {
    const db = getDb()
    const backupDir = getBackupDir()
    fs.mkdirSync(backupDir, { recursive: true })

    const baseName = `${BACKUP_PREFIX}${formatBackupTimestamp()}`
    let targetPath = path.join(backupDir, `${baseName}${BACKUP_EXTENSION}`)
    let suffix = 2
    while (fs.existsSync(targetPath)) {
      targetPath = path.join(backupDir, `${baseName}-${suffix}${BACKUP_EXTENSION}`)
      suffix += 1
    }

    // VACUUM INTO menolak target yang sudah ada, jadi nama unik di atas wajib.
    db.exec(`VACUUM INTO ${quoteSqlLiteral(targetPath)}`)

    // Aset ikut disalin ke folder pasangan <nama backup>.assets secara inkremental.
    const assetDir = getBackupAssetDir(targetPath)
    const { copied } = copyAssetsIncremental(getAssetsSourceDir(), assetDir)

    return {
      ok: true,
      filePath: targetPath,
      ...(fs.existsSync(assetDir) ? { assetDir, assetFileCount: copied.length } : {})
    }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

/**
 * Rotasi backup: buang berkas noteit-*.db yang lebih tua dari maxAgeDays
 * atau berada di luar maxFiles berkas terbaru. Berkas di luar pola tidak pernah disentuh.
 */
export function pruneBackups(
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
  maxFiles: number = DEFAULT_MAX_FILES
): { deleted: string[] } {
  const deleted: string[] = []

  try {
    const backupDir = getBackupDir()
    if (!fs.existsSync(backupDir)) return { deleted }

    const files = fs
      .readdirSync(backupDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isBackupFileName(entry.name))
      .map((entry) => {
        const fullPath = path.join(backupDir, entry.name)
        return { name: entry.name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name))

    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000

    files.forEach((file, index) => {
      const tooOld = file.mtimeMs < cutoff
      const outsideLimit = index >= maxFiles
      if (!tooOld && !outsideLimit) return

      try {
        fs.unlinkSync(file.fullPath)
        deleted.push(file.fullPath)
      } catch {
        // Berkas bisa terkunci proses lain; biarkan siklus backup berikutnya mencoba lagi.
      }

      // Folder aset pasangan tidak boleh tertinggal setelah DB-nya dirotasi.
      const assetDir = getBackupAssetDir(file.fullPath)
      if (fs.existsSync(assetDir)) {
        try {
          fs.rmSync(assetDir, { recursive: true, force: true })
          deleted.push(assetDir)
        } catch {
          // Sama: best-effort, coba lagi di siklus berikutnya.
        }
      }
    })
  } catch {
    // Rotasi bersifat best-effort dan tidak boleh menghentikan siklus backup.
  }

  return { deleted }
}

function executeBackupCycle(): void {
  if (inProgress) return
  inProgress = true

  try {
    const result = runBackup()
    if (!result.ok) {
      backupLogger?.('ERROR', 'Backup otomatis gagal', result.error)
      return
    }

    backupLogger?.('INFO', 'Backup otomatis dibuat', result.filePath)
    const pruned = pruneBackups()
    if (pruned.deleted.length > 0) {
      backupLogger?.('INFO', `Rotasi backup menghapus ${pruned.deleted.length} berkas`)
    }
  } catch (error) {
    backupLogger?.('ERROR', 'Backup otomatis gagal', error)
  } finally {
    inProgress = false
  }
}

/**
 * Jalankan backup segera saat dipanggil, lalu tiap intervalMs.
 * Tidak pernah melempar error ke pemanggil: kegagalan diteruskan ke logger.
 */
export function startBackupScheduler(
  intervalMs: number = DEFAULT_INTERVAL_MS,
  logger: BackupLogger | null = null
): void {
  if (logger) backupLogger = logger
  stopBackupScheduler()

  executeBackupCycle()
  backupTimer = setInterval(executeBackupCycle, intervalMs)
  if (typeof backupTimer.unref === 'function') backupTimer.unref()
}

export function stopBackupScheduler(): void {
  if (backupTimer) {
    clearInterval(backupTimer)
    backupTimer = null
  }
  inProgress = false
}
