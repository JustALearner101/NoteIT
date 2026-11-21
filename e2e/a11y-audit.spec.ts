import { _electron as electron, expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

async function assertZeroCriticalOrSeriousViolations(page: Page, contextName: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .setLegacyMode(true)
    .withTags(['wcag2a', 'wcag2aa'])
    // Exclude 3rd-party canvas internals that use custom SVG/Canvas coordinates if needed, while auditing all application chrome & controls
    .exclude('.react-flow__renderer')
    .exclude('.xterm')
    .analyze()

  const blocking = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  )

  if (blocking.length > 0) {
    const details = blocking
      .map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.map((n) => n.html).join(' | ')}`
      )
      .join('\n')
    expect(blocking, `WCAG 2.1 AA audit failed on ${contextName}:\n${details}`).toEqual([])
  }
}

test.describe('NoteIT WCAG 2.1 AA Accessibility Audit (@axe-core/playwright)', () => {
  let tempUserDataDir: string

  test.beforeEach(() => {
    tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-e2e-a11y-'))
  })

  test.afterEach(() => {
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup lag
    }
  })

  test('passes WCAG 2.1 AA with 0 critical/serious violations across Workbench, Command Palette, Settings, AI Chat, Mission Control, and Mission Briefing Drawer', async () => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../out/main/index.js')],
      env: {
        ...process.env,
        NOTEIT_USER_DATA_DIR: tempUserDataDir
      }
    })

    try {
      const page = await app.firstWindow()
      await page.waitForSelector('[role="tablist"][aria-label="Open pages"]', { timeout: 25000 })

      // 1. Workbench (Block Document Mode)
      await assertZeroCriticalOrSeriousViolations(page, 'Workbench (Block Document)')

      // 2. Command Palette Modal (Ctrl+K)
      await page.keyboard.press('Control+k')
      await expect(page.getByRole('dialog')).toBeVisible()
      await assertZeroCriticalOrSeriousViolations(page, 'Command Palette Modal')
      await page.keyboard.press('Escape')

      // 3. Mission Briefing Drawer (Ctrl+Shift+D)
      await page.keyboard.press('Control+Shift+D')
      await expect(page.getByRole('dialog')).toBeVisible()
      await assertZeroCriticalOrSeriousViolations(page, 'Mission Briefing Drawer')
      await page.keyboard.press('Escape')

      // 4. Settings View (Ctrl+,)
      await page.keyboard.press('Control+Comma')
      await expect(page.getByRole('navigation', { name: /settings/i })).toBeVisible()
      await assertZeroCriticalOrSeriousViolations(page, 'Settings View')

      // 5. AI Chat View (Ctrl+Shift+C)
      await page.keyboard.press('Control+Shift+C')
      await expect(page.getByRole('main', { name: 'AI Chat' })).toBeVisible()
      await assertZeroCriticalOrSeriousViolations(page, 'AI Chat View')

      // 6. Agent Mission Control View (Ctrl+Shift+A)
      await page.keyboard.press('Control+Shift+A')
      await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
      await assertZeroCriticalOrSeriousViolations(page, 'Agent Mission Control View')
    } finally {
      await app.close()
    }
  })
})
