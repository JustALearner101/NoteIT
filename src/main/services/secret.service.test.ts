import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, getDb, initDatabase } from '../db/client'
import {
  deleteSecret,
  getProviderSecretKeyName,
  getSecret,
  hasSecret,
  isSensitiveHeaderName,
  redactSecrets,
  setSecret,
  setSecretEncryptionBackend
} from './secret.service'

describe('secret.service (Encrypted Secret Storage & Hardening)', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-secret-test-'))
    initDatabase(tempDir)
  })

  afterAll(() => {
    setSecretEncryptionBackend(null)
    closeDb()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('encrypts secrets at rest in SQLite and never stores plaintext', () => {
    const keyName = getProviderSecretKeyName('gemini')
    const rawApiKey = 'AIzaSyTestSecretKey_9988776655'

    expect(hasSecret(keyName)).toBe(false)
    setSecret(keyName, rawApiKey)
    expect(hasSecret(keyName)).toBe(true)

    const row = getDb()
      .prepare('SELECT ciphertext_base64 FROM secrets WHERE key = ?')
      .get(keyName) as { ciphertext_base64: string }
    expect(row.ciphertext_base64).toBeDefined()
    expect(row.ciphertext_base64).not.toContain(rawApiKey)
    expect(Buffer.from(row.ciphertext_base64, 'base64').toString('utf-8')).not.toContain(
      rawApiKey
    )

    expect(getSecret(keyName)).toBe(rawApiKey)

    deleteSecret(keyName)
    expect(hasSecret(keyName)).toBe(false)
    expect(getSecret(keyName)).toBeNull()
  })

  it('refuses to store secrets when OS encryption backend is unavailable', () => {
    setSecretEncryptionBackend({
      isEncryptionAvailable: () => false,
      encryptString: () => Buffer.from(''),
      decryptString: () => ''
    })
    expect(() => setSecret('ai.provider.openai', 'sk-test-1234567890123456')).toThrow(
      /unavailable/i
    )
    setSecretEncryptionBackend(null)
  })

  it('redacts known API key patterns and stored secrets from error strings', () => {
    setSecret('ai.profile.custom1', 'my-ultra-secret-custom-token-999')
    const dirty =
      'Request failed with sk-ant-api03-secretvalue12345 and Bearer eyJhbGciOiJIUzI1NiJ9 and my-ultra-secret-custom-token-999'
    const clean = redactSecrets(dirty)
    expect(clean).not.toContain('sk-ant-api03-secretvalue12345')
    expect(clean).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(clean).not.toContain('my-ultra-secret-custom-token-999')
    expect(clean).toContain('[REDACTED]')
    deleteSecret('ai.profile.custom1')
  })

  it('identifies sensitive HTTP headers that must be encrypted', () => {
    expect(isSensitiveHeaderName('Authorization')).toBe(true)
    expect(isSensitiveHeaderName('x-api-key')).toBe(true)
    expect(isSensitiveHeaderName('X-Auth-Token')).toBe(true)
    expect(isSensitiveHeaderName('HTTP-Referer')).toBe(false)
    expect(isSensitiveHeaderName('X-Title')).toBe(false)
  })
})
