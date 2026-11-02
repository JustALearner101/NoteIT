import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  NoteItAPI,
  CreatePageInput,
  UpdatePageInput,
  AIChatStreamRequest,
  AIChatStreamEvent
} from '@shared/ipc-channels'
import type { MarkerColor } from '@shared/types/domain'

const noteitAPI: NoteItAPI = {
  getWorkspace: () => ipcRenderer.invoke('workspace:get'),
  createNotebook: (input: { name: string; icon: string; color: MarkerColor }) =>
    ipcRenderer.invoke('workspace:createNotebook', input),
  createSection: (input: { notebookId: string; name: string; color: MarkerColor }) =>
    ipcRenderer.invoke('workspace:createSection', input),
  createPage: (input: CreatePageInput) => ipcRenderer.invoke('workspace:createPage', input),
  updatePage: (input: UpdatePageInput) => ipcRenderer.invoke('workspace:updatePage', input),
  deletePage: (pageId: string) => ipcRenderer.invoke('workspace:deletePage', pageId),

  getBacklinks: (pageId: string) => ipcRenderer.invoke('workspace:getBacklinks', pageId),
  getPageVersions: (pageId: string) => ipcRenderer.invoke('workspace:getPageVersions', pageId),
  getPageVersion: (pageId: string, versionId: string) =>
    ipcRenderer.invoke('workspace:getPageVersion', { pageId, versionId }),
  createPageSnapshot: (pageId: string, label?: string) =>
    ipcRenderer.invoke('workspace:createPageSnapshot', { pageId, label }),
  restorePageSnapshot: (pageId: string, versionId: string) =>
    ipcRenderer.invoke('workspace:restorePageSnapshot', { pageId, versionId }),
  deletePageSnapshot: (pageId: string, versionId: string) =>
    ipcRenderer.invoke('workspace:deletePageSnapshot', { pageId, versionId }),
  renamePageSnapshot: (pageId: string, versionId: string, label: string) =>
    ipcRenderer.invoke('workspace:renamePageSnapshot', { pageId, versionId, label }),

  searchWorkspace: (query: string) => ipcRenderer.invoke('workspace:search', query),

  exportContent: (input) => ipcRenderer.invoke('workspace:export', input),
  exportMarkdown: (input) => ipcRenderer.invoke('workspace:exportMarkdown', input),

  importAssets: () => ipcRenderer.invoke('assets:import'),
  importAssetBytes: (input) => ipcRenderer.invoke('assets:importBytes', input),
  saveAssetAs: (input) => ipcRenderer.invoke('assets:saveAs', input),
  openAssetExternal: (assetId: string) => ipcRenderer.invoke('assets:openExternal', assetId),

  createQuickNote: (text: string) => ipcRenderer.invoke('capture:save', text),
  openDailyNote: () => ipcRenderer.invoke('daily:open'),
  onNavigateToPage: (callback: (pageId: string) => void) => {
    const listener = (_event: IpcRendererEvent, pageId: string): void => callback(pageId)
    ipcRenderer.on('workspace:navigate', listener)
    return () => ipcRenderer.removeListener('workspace:navigate', listener)
  },

  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
  windowClose: () => ipcRenderer.invoke('window:close'),

  openHelpExternal: () => ipcRenderer.invoke('help:openExternal'),
  runBackupNow: () => ipcRenderer.invoke('workspace:runBackup'),
  gcOrphanAssetsNow: () => ipcRenderer.invoke('workspace:gcAssets'),
  openStorageFolder: (target: 'workspace' | 'backups' | 'logs') =>
    ipcRenderer.invoke('workspace:openFolder', target),

  startAIChatStream: (input: AIChatStreamRequest) => ipcRenderer.invoke('ai:startStream', input),
  onAIChatStreamEvent: (callback: (event: AIChatStreamEvent) => void) => {
    const listener = (_event: IpcRendererEvent, payload: AIChatStreamEvent): void =>
      callback(payload)
    ipcRenderer.on('ai:streamEvent', listener)
    return () => ipcRenderer.removeListener('ai:streamEvent', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('noteitAPI', noteitAPI)
  } catch (error) {
    console.error('Failed to expose noteitAPI in preload:', error)
  }
} else {
  // @ts-ignore (Fallback when contextIsolation is disabled)
  window.noteitAPI = noteitAPI
}
