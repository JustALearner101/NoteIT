import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { initDatabase } from './db/client'
import { runBackup, startBackupScheduler, stopBackupScheduler } from './services/backup.service'
import { formatTimestamp, pageToMarkdown, slugifyTitle, workspaceToMarkdownFiles } from './services/export.service'
import {
  createNotebook,
  createPage,
  createPageSnapshot,
  createSection,
  deletePage,
  getBacklinks,
  getPageVersions,
  getWorkspaceSnapshot,
  restorePageSnapshot,
  searchWorkspace,
  updatePage
} from './services/workspace.service'

function writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, detail?: unknown): void {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(logDir, { recursive: true })
    const lines = [`[${new Date().toISOString()}] [${level}] ${message}`]
    if (detail instanceof Error) {
      lines.push(detail.stack || `${detail.name}: ${detail.message}`)
    } else if (detail !== undefined) {
      lines.push(typeof detail === 'string' ? detail : JSON.stringify(detail))
    }
    fs.appendFileSync(path.join(logDir, 'noteit.log'), lines.join('\n') + '\n', 'utf-8')
  } catch {
    // Logging must never take down the main process.
  }
}

process.on('uncaughtException', (error) => {
  writeLog('ERROR', 'uncaughtException', error)
})

process.on('unhandledRejection', (reason) => {
  writeLog('ERROR', 'unhandledRejection', reason)
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#111317',
    title: 'NoteIT v2.0 — Precision Drafting Workbench',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    writeLog(
      'ERROR',
      `render-process-gone (reason: ${details.reason}, exitCode: ${details.exitCode})`,
      details
    )
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('workspace:get', () => getWorkspaceSnapshot())
  ipcMain.handle('workspace:createNotebook', (_e, input) => createNotebook(input))
  ipcMain.handle('workspace:createSection', (_e, input) => createSection(input))
  ipcMain.handle('workspace:createPage', (_e, input) => createPage(input))
  ipcMain.handle('workspace:updatePage', (_e, input) => updatePage(input))
  ipcMain.handle('workspace:deletePage', (_e, pageId) => deletePage(pageId))

  ipcMain.handle('workspace:getBacklinks', (_e, pageId) => getBacklinks(pageId))
  ipcMain.handle('workspace:getPageVersions', (_e, pageId) => getPageVersions(pageId))
  ipcMain.handle('workspace:createPageSnapshot', (_e, { pageId, label }) =>
    createPageSnapshot(pageId, label)
  )
  ipcMain.handle('workspace:restorePageSnapshot', (_e, { pageId, versionId }) =>
    restorePageSnapshot(pageId, versionId)
  )

  ipcMain.handle('workspace:search', (_e, query) => searchWorkspace(query))

  ipcMain.handle(
    'workspace:export',
    async (
      _e,
      input: { filename: string; content: string; extension: 'md' | 'sql' | 'json' | 'svg' }
    ) => {
      if (!mainWindow) return { saved: false }
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Ekspor Berkas dari NoteIT Workbench',
        defaultPath: `${input.filename}.${input.extension}`,
        filters: [
          { name: `${input.extension.toUpperCase()} File`, extensions: [input.extension] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { saved: false }
      }

      fs.writeFileSync(result.filePath, input.content, 'utf-8')
      return { saved: true, filePath: result.filePath }
    }
  )

  ipcMain.handle(
    'workspace:exportMarkdown',
    async (_e, input: { scope: 'page' | 'workspace'; pageId?: string }) => {
      if (!mainWindow) return { saved: false }
      const snapshot = getWorkspaceSnapshot()

      if (input.scope === 'page') {
        const page = input.pageId ? snapshot.pages.find((p) => p.id === input.pageId) : undefined
        if (!page) {
          throw new Error('Halaman tidak ditemukan untuk ekspor Markdown.')
        }

        const slug = slugifyTitle(page.title) || slugifyTitle(page.code) || 'page'
        const result = await dialog.showSaveDialog(mainWindow, {
          title: 'Ekspor Halaman ke Markdown',
          defaultPath: `${page.code}-${slug}.md`,
          filters: [{ name: 'Markdown', extensions: ['md'] }]
        })

        if (result.canceled || !result.filePath) {
          return { saved: false }
        }

        fs.writeFileSync(result.filePath, pageToMarkdown(page), 'utf-8')
        return { saved: true, filePath: result.filePath }
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Pilih Folder Tujuan Ekspor Workspace',
        properties: ['openDirectory', 'createDirectory']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { saved: false }
      }

      const targetDir = path.join(
        result.filePaths[0],
        `noteit-export-${formatTimestamp(new Date())}`
      )
      fs.mkdirSync(targetDir, { recursive: true })

      const files = workspaceToMarkdownFiles(snapshot)
      for (const file of files) {
        fs.writeFileSync(path.join(targetDir, file.filename), file.content, 'utf-8')
      }

      return { saved: true, filePath: targetDir, fileCount: files.length }
    }
  )

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximizeToggle', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
      return false
    } else {
      mainWindow.maximize()
      return true
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })
}

app.whenReady().then(() => {
  const workspaceDir = path.join(app.getPath('userData'), 'workspace')
  initDatabase(workspaceDir)
  startBackupScheduler(undefined, writeLog)
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopBackupScheduler()

  try {
    const result = runBackup()
    if (!result.ok) {
      writeLog('WARN', 'Backup terakhir sebelum quit gagal', result.error)
    }
  } catch (error) {
    // Backup terakhir bersifat best-effort: kegagalan tidak boleh memblokir quit.
    writeLog('WARN', 'Backup terakhir sebelum quit gagal', error)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
