import { contextBridge, ipcRenderer } from 'electron'
import type { NoteItAPI, CreatePageInput, UpdatePageInput } from '@shared/ipc-channels'
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
  createPageSnapshot: (pageId: string, label?: string) =>
    ipcRenderer.invoke('workspace:createPageSnapshot', { pageId, label }),
  restorePageSnapshot: (pageId: string, versionId: string) =>
    ipcRenderer.invoke('workspace:restorePageSnapshot', { pageId, versionId }),

  searchWorkspace: (query: string) => ipcRenderer.invoke('workspace:search', query),

  exportContent: (input) => ipcRenderer.invoke('workspace:export', input),
  exportMarkdown: (input) => ipcRenderer.invoke('workspace:exportMarkdown', input),

  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
  windowClose: () => ipcRenderer.invoke('window:close')
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
