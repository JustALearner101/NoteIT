import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { initDatabase } from './db/client'
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
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
