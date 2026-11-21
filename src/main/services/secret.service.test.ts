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
  setSecret
} from './secret.service'

describe('secret.service (Encrypted Secret Storage)', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-secret-test-'))
    initDatabase(tempDir)
  })

  afterAll(() => {
    closeDb()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('encrypts secrets at rest in SQLite and never stores plaintext', () => {
    const keyName = getProviderSecretKeyName('gemini')
    const rawApiKey = 'AIzaSyTestSecretKey_9988776655'

    expect(hasSecret(keyName)).toBe(false)
    setSecret(keyName, rawApiKey)
    expect(hasSecret(keyName)).toBe(true)

    // Verify raw SQLite row does NOT contain the plaintext API key
    const row = getDb()
      .prepare('SELECT ciphertext_base64 FROM secrets WHERE key = ?')
      .get(keyName) as { ciphertext_base64: string }
    expect(row.ciphertext_base64).toBeDefined()
    expect(row.ciphertext_base64).not.toContain(rawApiKey)
    expect(Buffer.from(row.ciphertext_base64, 'base64').toString('utf-8')).not.toContain(
      rawApiKey
    )

    // Main process can decrypt it
    expect(getSecret(keyName)).toBe(rawApiKey)

    // Deleting removes it
    deleteSecret(keyName)
    expect(hasSecret(keyName)).toBe(false)
    expect(getSecret(keyName)).toBeNull()
  })
})
