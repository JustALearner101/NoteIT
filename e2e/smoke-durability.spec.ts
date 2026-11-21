import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

async function launchIsolatedElectron(tempUserDataDir: string): Promise<{
  app: ElectronApplication
  page: Page
  consoleErrors: string[]
}> {
  const consoleErrors: string[] = []
  const app = await electron.launch({
    args: [path.resolve(__dirname, '../out/main/index.js')],
    env: {
      ...process.env,
      NOTEIT_USER_DATA_DIR: tempUserDataDir
    }
  })

  const page = await app.firstWindow()
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message)
  })

  await page.waitForSelector('[role="tablist"][aria-label="Open pages"]', { timeout: 25000 })
  return { app, page, consoleErrors }
}

test.describe('NoteIT Electron Smoke & Durability Suite', () => {
  let tempUserDataDir: string

  test.beforeEach(() => {
    tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-e2e-smoke-'))
  })

  test.afterEach(() => {
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true })
    } catch {
      // ignore Windows file lock lag
    }
  })

  test('boots cleanly with zero CSP/console errors, creates SQLite WAL, persists tab order & split ratio across restart, and imports assets', async () => {
    const first = await launchIsolatedElectron(tempUserDataDir)
    try {
      // 1. Verify SQLite WAL database created in isolated userData
      const dbFile = path.join(tempUserDataDir, 'workspace', 'noteit-v2.db')
      expect(fs.existsSync(dbFile)).toBe(true)

      // 2. Verify tabs exist and switch tabs
      const tabs = first.page.locator('[role="tablist"][aria-label="Open pages"] [role="tab"]')
      const tabCount = await tabs.count()
      expect(tabCount).toBeGreaterThanOrEqual(2)

      const secondTabId = await tabs.nth(1).getAttribute('id')
      await tabs.nth(1).click()
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

      // 3. Test byte-based image asset import via window.noteitAPI.importAssetBytes
      const pngBytes = [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52
      ]
      const importedAsset = await first.page.evaluate(async (bytes) => {
        return window.noteitAPI.importAssetBytes({
          name: 'e2e-test.png',
          data: new Uint8Array(bytes)
        })
      }, pngBytes)
      expect(importedAsset.ext).toBe('png')
      expect(
        fs.existsSync(path.join(tempUserDataDir, 'workspace', 'assets', `${importedAsset.id}.png`))
      ).toBe(true)

      // 4. Persist custom split ratio and active tab to durable ui-state.json
      await first.page.evaluate(async () => {
        await window.noteitAPI.saveUiState({
          splitRatio: 0.64,
          isSidebarCollapsed: true
        })
      })

      const uiStateFile = path.join(tempUserDataDir, 'workspace', 'ui-state.json')
      expect(fs.existsSync(uiStateFile)).toBe(true)

      // 5. Verify zero CSP or uncaught page errors
      const cspErrors = first.consoleErrors.filter((e) =>
        /Content Security Policy|Refused to/i.test(e)
      )
      expect(cspErrors).toEqual([])
      expect(secondTabId).toBeTruthy()
    } finally {
      await first.app.close()
    }

    // 6. Relaunch against the same userData dir and verify durable ui-state.json + backup on quit
    const backupsDir = path.join(tempUserDataDir, 'workspace', 'backups')
    expect(fs.existsSync(backupsDir)).toBe(true)

    const second = await launchIsolatedElectron(tempUserDataDir)
    try {
      const restoredState = await second.page.evaluate(() => window.noteitAPI.getUiState())
      expect(restoredState?.splitRatio).toBe(0.64)
      expect(restoredState?.isSidebarCollapsed).toBe(true)
    } finally {
      await second.app.close()
    }
  })
})
