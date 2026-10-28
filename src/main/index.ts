import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  protocol,
  session,
  shell
} from 'electron'
import fs from 'fs'
import path from 'path'
import { initDatabase } from './db/client'
import {
  copyAssetFile,
  getAsset,
  getAssetFilePath,
  importAsset,
  importAssetFromPath,
  resolveAssetRequestPath
} from './services/asset.service'
import { mimeForExtension, parseRangeHeader } from '@shared/assets'
import { runBackup, startBackupScheduler, stopBackupScheduler } from './services/backup.service'
import {
  collectPageAssets,
  formatTimestamp,
  pageToMarkdown,
  slugifyTitle,
  workspaceToMarkdownFiles
} from './services/export.service'
import {
  createNotebook,
  createPage,
  createQuickNote,
  createPageSnapshot,
  createSection,
  deletePage,
  deletePageSnapshot,
  getBacklinks,
  getPageVersion,
  getPageVersions,
  getWorkspaceSnapshot,
  renamePageSnapshot,
  openOrCreateDailyNote,
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

/**
 * Wajib dipanggil sebelum app.whenReady(): skema privileged tidak bisa didaftarkan
 * setelah ready. standard+secure membuat noteit-asset:// bisa dipakai <img>/<iframe>,
 * stream+supportFetchAPI supaya PDF besar bisa dilayani per-Range.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'noteit-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

let mainWindow: BrowserWindow | null = null

/**
 * CSP dipasang sebagai header respons agar berlaku di dev maupun produksi.
 * 'wasm-unsafe-eval' wajib ada: Graphviz (@viz-js/viz) mengompilasi WebAssembly.
 * Longgarnya hanya ditambahkan saat dev (Vite HMR + preamble react-refresh).
 */
function buildContentSecurityPolicy(isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'"
      : "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: noteit-asset:",
    "media-src 'self' noteit-asset:",
    "frame-src 'self' noteit-asset:",
    "object-src 'self' noteit-asset:",
    "font-src 'self' data:",
    isDev
      ? "connect-src 'self' noteit-asset: ws: http://localhost:* http://127.0.0.1:*"
      : "connect-src 'self' noteit-asset:",
    "worker-src 'self' blob:"
  ]

  return directives.join('; ')
}

function installContentSecurityPolicy(): void {
  const isDev = !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL'])
  const policy = buildContentSecurityPolicy(isDev)

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(details.responseHeaders ?? {})) {
      if (key.toLowerCase() === 'content-security-policy') continue
      responseHeaders[key] = value
    }
    responseHeaders['Content-Security-Policy'] = [policy]

    callback({ responseHeaders })
  })
}

/**
 * Handler aset: noteit-asset://asset/<sha256>.<ext>.
 * Path di-resolve lewat resolveAssetRequestPath yang menolak traversal dan subfolder.
 */
function registerAssetProtocol(): void {
  protocol.handle('noteit-asset', async (request) => {
    let url: URL
    try {
      url = new URL(request.url)
    } catch {
      return new Response('Aset tidak ditemukan', { status: 404 })
    }

    if (url.hostname !== 'asset') {
      return new Response('Aset tidak ditemukan', { status: 404 })
    }

    const filePath = resolveAssetRequestPath(url.pathname)
    if (!filePath || !fs.existsSync(filePath)) {
      return new Response('Aset tidak ditemukan', { status: 404 })
    }

    const stat = fs.statSync(filePath)
    const baseHeaders: Record<string, string> = {
      'Content-Type': mimeForExtension(path.extname(filePath).slice(1)),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    }

    const range = parseRangeHeader(request.headers.get('Range'), stat.size)
    if (range) {
      const length = range.end - range.start + 1
      const buffer = Buffer.alloc(length)
      const fd = fs.openSync(filePath, 'r')
      try {
        fs.readSync(fd, buffer, 0, length, range.start)
      } finally {
        fs.closeSync(fd)
      }
      return new Response(buffer, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Length': String(length),
          'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`
        }
      })
    }

    return new Response(fs.readFileSync(filePath), {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(stat.size) }
    })
  })
}

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

let captureWindow: BrowserWindow | null = null

/**
 * Window capture memakai renderer yang sama; query param 'window=capture' membuat
 * entry renderer hanya merender QuickCapture. Tidak ada HTML entry kedua.
 */
function createCaptureWindow(): BrowserWindow {
  if (captureWindow && !captureWindow.isDestroyed()) return captureWindow

  const win = new BrowserWindow({
    width: 680,
    height: 200,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#111317',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
    win.focus()
  })

  // Frameless capture window tidak punya titlebar: kehilangan fokus = selesai.
  win.on('blur', () => {
    if (!win.isDestroyed()) win.hide()
  })

  win.on('closed', () => {
    captureWindow = null
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?window=capture')
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), { query: { window: 'capture' } })
  }

  captureWindow = win
  return win
}

function toggleCaptureWindow(): void {
  const win = createCaptureWindow()
  if (win.isVisible()) {
    win.hide()
    return
  }
  win.show()
  win.focus()
}

/** Hotkey global bisa bentrok dengan aplikasi lain: catat, jangan pernah crash. */
function registerGlobalShortcut(accelerator: string, handler: () => void): void {
  try {
    if (!globalShortcut.register(accelerator, handler)) {
      writeLog('WARN', 'Global shortcut gagal didaftarkan: ' + accelerator)
    }
  } catch (error) {
    writeLog('WARN', 'Global shortcut gagal didaftarkan: ' + accelerator, error)
  }
}

/** Daily note dibuka di window utama: fokuskan, lalu suruh renderer pindah tab. */
function focusDailyNote(): void {
  try {
    const page = openOrCreateDailyNote()
    if (!mainWindow || mainWindow.isDestroyed()) return

    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('workspace:navigate', page.id)
  } catch (error) {
    writeLog('ERROR', 'Gagal membuka daily note', error)
  }
}

function registerGlobalShortcuts(): void {
  registerGlobalShortcut('CommandOrControl+Shift+Space', toggleCaptureWindow)
  registerGlobalShortcut('CommandOrControl+Shift+D', focusDailyNote)
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
  ipcMain.handle('workspace:getPageVersion', (_e, { pageId, versionId }) =>
    getPageVersion(pageId, versionId)
  )
  ipcMain.handle('workspace:createPageSnapshot', (_e, { pageId, label }) =>
    createPageSnapshot(pageId, label)
  )
  ipcMain.handle('workspace:restorePageSnapshot', (_e, { pageId, versionId }) =>
    restorePageSnapshot(pageId, versionId)
  )
  ipcMain.handle('workspace:deletePageSnapshot', (_e, { pageId, versionId }) =>
    deletePageSnapshot(pageId, versionId)
  )
  ipcMain.handle('workspace:renamePageSnapshot', (_e, { pageId, versionId, label }) =>
    renamePageSnapshot(pageId, versionId, label)
  )

  ipcMain.handle('workspace:search', (_e, query) => searchWorkspace(query))

  ipcMain.handle('assets:import', async () => {
    if (!mainWindow) return { assets: [], rejected: [] }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Impor Berkas ke NoteIT',
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { assets: [], rejected: [] }
    }

    const assets: ReturnType<typeof importAsset>[] = []
    const rejected: { name: string; reason: string }[] = []
    for (const filePath of result.filePaths) {
      try {
        assets.push(importAssetFromPath(filePath))
      } catch (error) {
        rejected.push({
          name: path.basename(filePath),
          reason: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return { assets, rejected }
  })

  ipcMain.handle('assets:importBytes', (_e, input: { name: string; data: Uint8Array }) => {
    const name = typeof input?.name === 'string' && input.name.length > 0 ? input.name : 'aset.bin'
    const bytes = Buffer.from(input?.data ?? new Uint8Array())
    return importAsset({ data: bytes, name })
  })

  ipcMain.handle('assets:saveAs', async (_e, input: { assetId: string; name: string; ext: string }) => {
    if (!mainWindow) return { saved: false }
    const asset = getAsset(input.assetId)
    if (!asset) throw new Error('Aset tidak ditemukan.')

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Simpan Aset dari NoteIT',
      defaultPath: asset.name || `aset.${asset.ext}`,
      filters: [{ name: 'Berkas Aset', extensions: [asset.ext] }]
    })
    if (result.canceled || !result.filePath) {
      return { saved: false }
    }

    // copyFileSync: berkas biner tidak boleh lewat writeFileSync utf-8.
    if (!copyAssetFile(asset.id, result.filePath)) {
      throw new Error('Berkas aset tidak ditemukan di workspace.')
    }
    return { saved: true, filePath: result.filePath }
  })

  ipcMain.handle('assets:openExternal', async (_e, assetId: string) => {
    const filePath = getAssetFilePath(assetId)
    if (!filePath) return { ok: false, error: 'Berkas aset tidak ditemukan.' }

    const error = await shell.openPath(filePath)
    return error ? { ok: false, error } : { ok: true }
  })

  ipcMain.handle('capture:save', (_e, text: string) => createQuickNote(text))
  ipcMain.handle('daily:open', () => openOrCreateDailyNote())

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

        // Aset ditulis dengan copyFileSync: writeFileSync utf-8 merusak PNG/PDF.
        const pageAssets = collectPageAssets(page)
        if (pageAssets.length > 0) {
          const targetAssetsDir = path.join(path.dirname(result.filePath), 'assets')
          for (const asset of pageAssets) {
            copyAssetFile(asset.assetId, path.join(targetAssetsDir, `${asset.assetId}.${asset.ext}`))
          }
        }

        return { saved: true, filePath: result.filePath, assetCount: pageAssets.length }
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

      // Satu salinan per aset unik, dipakai bersama semua halaman hasil ekspor.
      const assetRefs = new Map<string, { assetId: string; ext: string }>()
      for (const page of snapshot.pages) {
        for (const asset of collectPageAssets(page)) {
          assetRefs.set(asset.assetId, asset)
        }
      }
      if (assetRefs.size > 0) {
        const targetAssetsDir = path.join(targetDir, 'assets')
        for (const asset of assetRefs.values()) {
          copyAssetFile(asset.assetId, path.join(targetAssetsDir, `${asset.assetId}.${asset.ext}`))
        }
      }

      return {
        saved: true,
        filePath: targetDir,
        fileCount: files.length,
        assetCount: assetRefs.size
      }
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
  installContentSecurityPolicy()

  const workspaceDir = path.join(app.getPath('userData'), 'workspace')
  initDatabase(workspaceDir)
  registerAssetProtocol()
  startBackupScheduler(undefined, writeLog)
  registerIpcHandlers()
  createWindow()
  registerGlobalShortcuts()

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
