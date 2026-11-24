import crypto from 'node:crypto'
import { getDb } from '../db/client'

export interface EncryptionBackend {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

let customBackend: EncryptionBackend | null = null
let ephemeralTestKey: Buffer | null = null

function getEphemeralTestBackend(): EncryptionBackend {
  if (!ephemeralTestKey) {
    ephemeralTestKey = crypto.randomBytes(32)
  }
  const key = ephemeralTestKey
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText: string): Buffer => {
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      const encrypted = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()])
      const authTag = cipher.getAuthTag()
      return Buffer.concat([iv, authTag, encrypted])
    },
    decryptString: (payload: Buffer): string => {
      const iv = payload.subarray(0, 12)
      const authTag = payload.subarray(12, 28)
      const ciphertext = payload.subarray(28)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(authTag)
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
    }
  }
}

function tryResolveElectronSafeStorage(): EncryptionBackend | null {
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
    // Outside Electron binary (e.g. Vitest)
  }
  return null
}

function getBackend(): { backend: EncryptionBackend; scheme: string } {
  if (customBackend) {
    if (!customBackend.isEncryptionAvailable()) {
      throw new Error(
        'OS credential encryption (Electron safeStorage) is unavailable. Refusing to store secrets insecurely.'
      )
    }
    return { backend: customBackend, scheme: 'custom' }
  }

  const electronSafe = tryResolveElectronSafeStorage()
  if (electronSafe) {
    return { backend: electronSafe, scheme: 'safeStorage' }
  }

  // Only permit an ephemeral in-memory AES-256-GCM test backend inside Vitest.
  // Production Electron runtime NEVER downgrades to deterministic/weak encryption.
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return { backend: getEphemeralTestBackend(), scheme: 'test-ephemeral' }
  }

  throw new Error(
    'OS credential encryption (Electron safeStorage / Windows DPAPI / macOS Keychain) is unavailable. Refusing to store secrets insecurely.'
  )
}

export function setSecretEncryptionBackend(backend: EncryptionBackend | null): void {
  customBackend = backend
}

export function getEncryptionStatus(): { available: boolean; scheme: string } {
  try {
    const { scheme } = getBackend()
    return { available: true, scheme }
  } catch {
    return { available: false, scheme: 'unavailable' }
  }
}

/**
 * Returns true if an HTTP header name likely carries credentials or tokens
 * and must be encrypted inside the `secrets` table instead of plaintext JSON.
 */
export function isSensitiveHeaderName(headerName: string): boolean {
  const lower = headerName.trim().toLowerCase()
  return (
    lower === 'authorization' ||
    lower === 'proxy-authorization' ||
    lower === 'cookie' ||
    lower.includes('api-key') ||
    lower.includes('apikey') ||
    lower.includes('token') ||
    lower.includes('secret')
  )
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

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-ant-[A-Za-z0-9_-]{10,}\b/g,
  /\bsk-or-v1-[A-Za-z0-9_-]{10,}\b/g,
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\bgsk_[A-Za-z0-9_-]{12,}\b/g,
  /\bxai-[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi
]

/**
 * Redacts known API key patterns and any currently stored decrypted secrets
 * from error messages, logs, or telemetry strings before sending to the renderer.
 */
export function redactSecrets(input: string): string {
  if (!input) return ''
  let sanitized = input
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) =>
      match.toLowerCase().startsWith('bearer ') ? 'Bearer [REDACTED]' : '[REDACTED]'
    )
  }

  try {
    const rows = getDb()
      .prepare('SELECT key FROM secrets')
      .all() as Array<{ key: string }>
    for (const row of rows) {
      const val = getSecret(row.key)
      if (!val || val.length < 8) continue
      // Skip local URLs (e.g. Ollama http://localhost:11434) so diagnostics stay readable
      if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(val)) continue
      if (sanitized.includes(val)) {
        sanitized = sanitized.split(val).join('[REDACTED]')
      }
    }
  } catch {
    // Ignore if DB is not initialized yet
  }

  return sanitized
}
