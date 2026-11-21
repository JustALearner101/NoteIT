import crypto from 'node:crypto'
import os from 'node:os'
import { getDb, getDbPath } from '../db/client'

export interface EncryptionBackend {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

let customBackend: EncryptionBackend | null = null

function resolveDefaultBackend(): EncryptionBackend {
  try {
    // Dynamically resolve electron.safeStorage when running inside Electron main process
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electronMod = require('electron') as { safeStorage?: EncryptionBackend }
    if (
      electronMod?.safeStorage &&
      typeof electronMod.safeStorage.isEncryptionAvailable === 'function' &&
      electronMod.safeStorage.isEncryptionAvailable()
    ) {
      return electronMod.safeStorage
    }
  } catch {
    // Running inside Vitest / Node environment outside Electron binary
  }

  // Fallback AES-256-GCM bound to local machine user + workspace DB path (never stores plaintext!)
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText: string): Buffer => {
      const keyMaterial = `${os.hostname()}:${os.userInfo().username}:${getDbPath()}:noteit-v2-key`
      const key = crypto.createHash('sha256').update(keyMaterial).digest()
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      const encrypted = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()])
      const authTag = cipher.getAuthTag()
      return Buffer.concat([iv, authTag, encrypted])
    },
    decryptString: (payload: Buffer): string => {
      const keyMaterial = `${os.hostname()}:${os.userInfo().username}:${getDbPath()}:noteit-v2-key`
      const key = crypto.createHash('sha256').update(keyMaterial).digest()
      const iv = payload.subarray(0, 12)
      const authTag = payload.subarray(12, 28)
      const ciphertext = payload.subarray(28)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(authTag)
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
    }
  }
}

export function setSecretEncryptionBackend(backend: EncryptionBackend | null): void {
  customBackend = backend
}

function getBackend(): { backend: EncryptionBackend; scheme: string } {
  if (customBackend) {
    return { backend: customBackend, scheme: 'custom' }
  }
  const backend = resolveDefaultBackend()
  return { backend, scheme: 'safeStorage' }
}

/**
 * Encrypts and stores a secret in the SQLite `secrets` table.
 * Raw decrypted values are NEVER returned over IPC to the renderer.
 */
export function setSecret(key: string, value: string): { ok: boolean } {
  const normalizedKey = key.trim()
  if (!normalizedKey) {
    throw new Error('Secret key cannot be empty.')
  }

  const trimmedVal = value.trim()
  if (!trimmedVal) {
    return deleteSecret(normalizedKey)
  }

  const { backend, scheme } = getBackend()
  const encryptedBuf = backend.encryptString(trimmedVal)
  const ciphertextBase64 = encryptedBuf.toString('base64')
  const now = Date.now()

  getDb()
    .prepare(
      `INSERT INTO secrets (key, ciphertext_base64, encryption_scheme, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         ciphertext_base64 = excluded.ciphertext_base64,
         encryption_scheme = excluded.encryption_scheme,
         updated_at = excluded.updated_at`
    )
    .run(normalizedKey, ciphertextBase64, scheme, now)

  return { ok: true }
}

/**
 * Checks whether a non-empty encrypted secret exists for `key` (safe to expose via IPC).
 */
export function hasSecret(key: string): boolean {
  const normalizedKey = key.trim()
  if (!normalizedKey) return false
  const row = getDb()
    .prepare('SELECT key FROM secrets WHERE key = ?')
    .get(normalizedKey) as { key: string } | undefined
  return Boolean(row)
}

/**
 * Deletes a secret from the `secrets` table (safe to expose via IPC).
 */
export function deleteSecret(key: string): { ok: boolean } {
  const normalizedKey = key.trim()
  if (!normalizedKey) return { ok: false }
  getDb().prepare('DELETE FROM secrets WHERE key = ?').run(normalizedKey)
  return { ok: true }
}

/**
 * Main-process-only helper to decrypt and read a secret for `ai.service.ts` / `mcp.service.ts`.
 * NEVER expose this function to an IPC handler!
 */
export function getSecret(key: string): string | null {
  const normalizedKey = key.trim()
  if (!normalizedKey) return null
  const row = getDb()
    .prepare('SELECT ciphertext_base64 FROM secrets WHERE key = ?')
    .get(normalizedKey) as { ciphertext_base64: string } | undefined
  if (!row?.ciphertext_base64) return null

  try {
    const { backend } = getBackend()
    const buf = Buffer.from(row.ciphertext_base64, 'base64')
    return backend.decryptString(buf)
  } catch (err) {
    console.warn(`[secret.service] Failed to decrypt secret "${normalizedKey}":`, err)
    return null
  }
}

export function getProviderSecretKeyName(provider: string): string {
  return `ai.provider.${provider.trim().toLowerCase()}`
}
