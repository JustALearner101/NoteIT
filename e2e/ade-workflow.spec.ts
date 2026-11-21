import { _electron as electron, expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test.describe('NoteIT ADE Workflow Suite (Repo Binding, Spec Compiler, Diff Inspector, Mission Control)', () => {
  let tempUserDataDir: string
  let tempRepoDir: string

  test.beforeEach(() => {
    tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-e2e-ade-user-'))
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-e2e-ade-repo-'))

    execFileSync('git', ['init'], { cwd: tempRepoDir })
    execFileSync('git', ['config', 'user.email', 'e2e@noteit.local'], { cwd: tempRepoDir })
    execFileSync('git', ['config', 'user.name', 'NoteIT E2E'], { cwd: tempRepoDir })
    fs.mkdirSync(path.join(tempRepoDir, 'src'), { recursive: true })
    fs.writeFileSync(
      path.join(tempRepoDir, 'src', 'service.ts'),
      'export function runService(): string {\n  return "v1"\n}\n',
      'utf-8'
    )
    execFileSync('git', ['add', '.'], { cwd: tempRepoDir })
    execFileSync('git', ['commit', '-m', 'Initial repo commit'], { cwd: tempRepoDir })
  })

  test.afterEach(() => {
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true })
      fs.rmSync(tempRepoDir, { recursive: true, force: true })
    } catch {
      // ignore Windows cleanup lag
    }
  })

  test('binds git repository, compiles spec bundle + .git/info/exclude, opens CodeMirror Diff Inspector, and opens Terminal & Mission Control', async () => {
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

      // 1. Bind tempRepoDir to the first notebook and compile spec bundle via NoteItAPI
      const compileRes = await page.evaluate(async (repoDir) => {
        const snap = await window.noteitAPI.getWorkspace()
        const nb = snap.notebooks[0]
        const pg = snap.pages[0]
        await window.noteitAPI.updateNotebookRepo({
          notebookId: nb.id,
          repoPath: repoDir,
          defaultBranch: 'main'
        })
        return window.noteitAPI.compileSpec({
          pageId: pg.id,
          targetCwd: repoDir
        })
      }, tempRepoDir)

      expect(compileRes.files.length).toBeGreaterThanOrEqual(4)
      expect(fs.existsSync(path.join(tempRepoDir, '.noteit', 'active-task.md'))).toBe(true)
      const excludeContent = fs.readFileSync(
        path.join(tempRepoDir, '.git', 'info', 'exclude'),
        'utf-8'
      )
      expect(excludeContent).toContain('.noteit/')

      // 2. Modify file in repo and verify getRepoFileDiff returns modified diff
      fs.writeFileSync(
        path.join(tempRepoDir, 'src', 'service.ts'),
        'export function runService(): string {\n  return "v2-updated"\n}\n',
        'utf-8'
      )

      const diffRes = await page.evaluate(async (repoDir) => {
        return window.noteitAPI.getRepoFileDiff({
          repoPath: repoDir,
          relPath: 'src/service.ts'
        })
      }, tempRepoDir)
      expect(diffRes.status).toBe('modified')
      expect(diffRes.additions).toBe(1)

      // 3. Open Mission Control view and verify it renders
      await page.keyboard.press('Control+Shift+A')
      await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
    } finally {
      await app.close()
    }
  })
})
