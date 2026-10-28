import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db/client'
import { importAsset } from './asset.service'
import {
  copyAssetsIncremental,
  getAssetsSourceDir,
  getBackupAssetDir,
  getBackupDir,
  pruneBackups,
  runBackup
} from './backup.service'

let tempDir: string
let backupDir: string

function makeBackupFile(name: string, ageDays: number): string {
  const filePath = path.join(backupDir, name)
  fs.writeFileSync(filePath, 'dummy-backup', 'utf-8')
  const mtime = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000)
  fs.utimesSync(filePath, mtime, mtime)
  return filePath
}

function listBackups(): string[] {
  return fs
    .readdirSync(backupDir)
    .filter((name) => name.startsWith('noteit-') && name.endsWith('.db'))
    .sort()
}

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-backup-test-'))
  initDatabase(tempDir)
  backupDir = getBackupDir()
})

afterAll(() => {
  closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('backup.service (integration)', () => {
  it('menaruh folder backups di samping berkas database', () => {
    expect(backupDir).toBe(path.join(tempDir, 'backups'))
  })

  it('runBackup menghasilkan berkas backup nyata', () => {
    const result = runBackup()

    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.filePath).toBeDefined()

    const filePath = result.filePath as string
    expect(fs.existsSync(filePath)).toBe(true)
    expect(path.dirname(filePath)).toBe(backupDir)
    expect(path.basename(filePath)).toMatch(/^noteit-\d{8}-\d{6}\.db$/)
    expect(fs.statSync(filePath).size).toBeGreaterThan(0)
  })

  it('dua backup berurutan tidak saling menimpa', () => {
    const first = runBackup()
    const second = runBackup()

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(first.filePath).not.toBe(second.filePath)
    expect(fs.existsSync(first.filePath as string)).toBe(true)
    expect(fs.existsSync(second.filePath as string)).toBe(true)
    expect(path.basename(second.filePath as string)).toMatch(/^noteit-\d{8}-\d{6}(-\d+)?\.db$/)
  })

  it('pruneBackups membuang berkas lama tapi tidak menyentuh berkas di luar pola', () => {
    const stale = makeBackupFile('noteit-20200101-000000.db', 30)
    const fresh = makeBackupFile('noteit-29990101-000000.db', 0)
    const foreignDb = path.join(backupDir, 'catatan-lain.db')
    const foreignTxt = path.join(backupDir, 'noteit-backup.txt')
    fs.writeFileSync(foreignDb, 'bukan backup', 'utf-8')
    fs.writeFileSync(foreignTxt, 'bukan backup', 'utf-8')

    const { deleted } = pruneBackups()

    expect(deleted).toContain(stale)
    expect(fs.existsSync(stale)).toBe(false)
    expect(fs.existsSync(fresh)).toBe(true)
    expect(fs.existsSync(foreignDb)).toBe(true)
    expect(fs.existsSync(foreignTxt)).toBe(true)

    fs.unlinkSync(fresh)
    fs.unlinkSync(foreignDb)
    fs.unlinkSync(foreignTxt)
  })

  it('pruneBackups menyisakan maksimal 7 berkas terbaru', () => {
    for (let index = 0; index < 9; index += 1) {
      makeBackupFile(`noteit-29990101-0000${String(index).padStart(2, '0')}.db`, 10 - index)
    }

    pruneBackups(7, 7)

    const remaining = listBackups()
    expect(remaining.length).toBeLessThanOrEqual(7)
    // 9 berkas buatan test ini yang paling baru: dua tertua harus hilang.
    expect(remaining).not.toContain('noteit-29990101-000000.db')
    expect(remaining).not.toContain('noteit-29990101-000001.db')
    expect(remaining).toContain('noteit-29990101-000008.db')
  })

  it('runBackup menyalin aset ke folder pasangan <nama backup>.assets', () => {
    const png = importAsset({ data: Buffer.from('png-untuk-backup'), name: 'backup.png' })
    const pdf = importAsset({ data: Buffer.from('pdf-untuk-backup'), name: 'backup.pdf' })

    const result = runBackup()

    expect(result.ok).toBe(true)
    const assetDir = getBackupAssetDir(result.filePath as string)
    expect(result.assetDir).toBe(assetDir)
    expect(fs.existsSync(assetDir)).toBe(true)
    expect(fs.readdirSync(assetDir).sort()).toEqual(
      [`${png.id}.png`, `${pdf.id}.pdf`].sort()
    )
    expect(result.assetFileCount).toBe(2)
  })

  it('backup kedua pada detik yang sama memakai folder aset sendiri yang lengkap', () => {
    const first = runBackup()
    const second = runBackup()

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(first.assetDir).not.toBe(second.assetDir)

    const firstFiles = fs.readdirSync(first.assetDir as string).sort()
    const secondFiles = fs.readdirSync(second.assetDir as string).sort()
    expect(secondFiles).toEqual(firstFiles)
  })

  it('copyAssetsIncremental tidak menyalin ulang berkas yang sudah ada di tujuan', () => {
    const sourceDir = path.join(tempDir, 'sumber-inkremental')
    const targetDir = path.join(tempDir, 'tujuan-inkremental')
    fs.mkdirSync(sourceDir, { recursive: true })
    fs.writeFileSync(path.join(sourceDir, 'a.bin'), Buffer.from([1, 2, 3]))
    fs.writeFileSync(path.join(sourceDir, 'b.bin'), Buffer.from([4, 5, 6]))

    const firstRun = copyAssetsIncremental(sourceDir, targetDir)
    expect(firstRun.copied.sort()).toEqual(['a.bin', 'b.bin'])

    const targetFile = path.join(targetDir, 'a.bin')
    const firstMtime = fs.statSync(targetFile).mtimeMs

    // Sumber berubah, tapi tujuan tidak boleh ditimpa.
    fs.writeFileSync(path.join(sourceDir, 'a.bin'), Buffer.from([9, 9, 9]))
    const secondRun = copyAssetsIncremental(sourceDir, targetDir)

    expect(secondRun.copied).toEqual([])
    expect(fs.statSync(targetFile).mtimeMs).toBe(firstMtime)
    expect(Array.from(fs.readFileSync(targetFile))).toEqual([1, 2, 3])
  })

  it('folder aset sumber tidak ada → copyAssetsIncremental tidak melempar error', () => {
    const result = copyAssetsIncremental(
      path.join(tempDir, 'tidak-ada'),
      path.join(tempDir, 'tujuan-kosong')
    )
    expect(result.copied).toEqual([])
    expect(getAssetsSourceDir()).toBe(path.join(tempDir, 'assets'))
  })

  it('pruneBackups menghapus folder .assets pasangan backup yang dirotasi', () => {
    const dbPath = makeBackupFile('noteit-20200101-000000.db', 30)
    const assetDir = getBackupAssetDir(dbPath)
    fs.mkdirSync(assetDir, { recursive: true })
    fs.writeFileSync(path.join(assetDir, `${'a'.repeat(64)}.png`), 'aset-lama')

    const { deleted } = pruneBackups()

    expect(deleted).toContain(dbPath)
    expect(deleted).toContain(assetDir)
    expect(fs.existsSync(dbPath)).toBe(false)
    expect(fs.existsSync(assetDir)).toBe(false)
  })

  it('pruneBackups tidak melempar error saat folder backup belum ada', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-backup-empty-'))
    closeDb()
    initDatabase(emptyDir)

    try {
      expect(() => pruneBackups()).not.toThrow()
      expect(pruneBackups().deleted).toEqual([])
    } finally {
      closeDb()
      initDatabase(tempDir)
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  })
})
