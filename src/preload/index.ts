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
  },
  executeApprovedProposal: (proposal) =>
    ipcRenderer.invoke('ai:executeApprovedProposal', proposal),

  // ADE Pilar 1: Repo Binding & Local File Explorer
  updateNotebookRepo: (input) => ipcRenderer.invoke('workspace:updateNotebookRepo', input),
  updateSectionRepo: (input) => ipcRenderer.invoke('workspace:updateSectionRepo', input),
  pickRepoFolder: (defaultPath?: string) => ipcRenderer.invoke('repo:pickFolder', defaultPath),
  readRepoDir: (input) => ipcRenderer.invoke('repo:readDir', input),
  readRepoFile: (input) => ipcRenderer.invoke('repo:readFile', input),
  getRepoGitStatus: (repoPath: string) => ipcRenderer.invoke('repo:getGitStatus', repoPath),
  getRepoFileDiff: (input) => ipcRenderer.invoke('repo:getFileDiff', input),
  writeRepoFile: (input) => ipcRenderer.invoke('repo:writeFile', input),
  discardRepoFileChanges: (input) => ipcRenderer.invoke('repo:discardChanges', input),

  // Universal MCP Client
  listMcpServers: () => ipcRenderer.invoke('mcp:listServers'),
  upsertMcpServer: (input) => ipcRenderer.invoke('mcp:upsertServer', input),
  deleteMcpServer: (id: string) => ipcRenderer.invoke('mcp:deleteServer', id),
  testMcpConnection: (serverIdOrConfig) =>
    ipcRenderer.invoke('mcp:testConnection', serverIdOrConfig),

  // Encrypted Secrets & Durable UI State
  setSecret: (input) => ipcRenderer.invoke('secrets:set', input),
  hasSecret: (key: string) => ipcRenderer.invoke('secrets:has', key),
  deleteSecret: (key: string) => ipcRenderer.invoke('secrets:delete', key),

  // v2.3 Wave 1: Unified AI Provider Registry & Headless CLI Bridges
  listProviderProfiles: () => ipcRenderer.invoke('providers:list'),
  upsertProviderProfile: (input) => ipcRenderer.invoke('providers:upsert', input),
  deleteProviderProfile: (id: string) => ipcRenderer.invoke('providers:delete', id),
  testProviderProfile: (idOrConfig) => ipcRenderer.invoke('providers:test', idOrConfig),
  getModelSlots: () => ipcRenderer.invoke('providers:getSlots'),
  saveModelSlots: (slots) => ipcRenderer.invoke('providers:saveSlots', slots),
  detectCliBridges: () => ipcRenderer.invoke('providers:detectCliBridges'),

  getUiState: () => ipcRenderer.invoke('workspace:getUiState'),
  saveUiState: (input) => ipcRenderer.invoke('workspace:saveUiState', input),

  // v2.3 Wave 2: Web Workbench (Bookmarks & Popup-to-Tab)
  listBrowserBookmarks: (notebookId?: string) =>
    ipcRenderer.invoke('browser:listBookmarks', notebookId),
  addBrowserBookmark: (input) => ipcRenderer.invoke('browser:addBookmark', input),
  deleteBrowserBookmark: (id: string) => ipcRenderer.invoke('browser:deleteBookmark', id),
  onBrowserOpenInNewTab: (callback: (url: string) => void) => {
    const listener = (_event: IpcRendererEvent, url: string): void => callback(url)
    ipcRenderer.on('browser:openInNewTab', listener)
    return () => ipcRenderer.removeListener('browser:openInNewTab', listener)
  },

  // v2.3 Wave 3: Native Learning Workbench & Propositional Knowledge Graph
  listLearnSessions: () => ipcRenderer.invoke('learn:listSessions'),
  getLearnSession: (sessionId: string) => ipcRenderer.invoke('learn:getSession', sessionId),
  createLearnSession: (input) => ipcRenderer.invoke('learn:createSession', input),
  submitLearnResponse: (input) => ipcRenderer.invoke('learn:submitResponse', input),
  askLearnSideQuestion: (input) => ipcRenderer.invoke('learn:askSideQuestion', input),
  deleteLearnSession: (sessionId: string) => ipcRenderer.invoke('learn:deleteSession', sessionId),
  crystallizeLearnSessionToPage: (input) => ipcRenderer.invoke('learn:crystallizeToPage', input),
  getKnowledgeGraph: () => ipcRenderer.invoke('learn:getKnowledgeGraph'),
  extractKnowledgeGraph: (input) => ipcRenderer.invoke('learn:extractKnowledgeGraph', input),
  updateKgNodePosition: (input) => ipcRenderer.invoke('learn:updateKgNodePosition', input),
  deleteKgProposition: (id: string) => ipcRenderer.invoke('learn:deleteKgProposition', id),

  // ADE Pilar 1: Embedded PTY Terminal Multiplexer
  detectCliPresets: () => ipcRenderer.invoke('terminal:detectClis'),
  createTerminalSession: (input) => ipcRenderer.invoke('terminal:createSession', input),
  writeTerminal: (input) => ipcRenderer.invoke('terminal:write', input),
  resizeTerminal: (input) => ipcRenderer.invoke('terminal:resize', input),
  killTerminal: (sessionId: string) => ipcRenderer.invoke('terminal:kill', sessionId),
  listTerminalSessions: () => ipcRenderer.invoke('terminal:listSessions'),
  onTerminalData: (callback: (event: { sessionId: string; data: string }) => void) => {
    const listener = (_event: IpcRendererEvent, payload: { sessionId: string; data: string }): void =>
      callback(payload)
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.removeListener('terminal:data', listener)
  },
  onTerminalExit: (callback: (event: { sessionId: string; exitCode: number }) => void) => {
    const listener = (_event: IpcRendererEvent, payload: { sessionId: string; exitCode: number }): void =>
      callback(payload)
    ipcRenderer.on('terminal:exit', listener)
    return () => ipcRenderer.removeListener('terminal:exit', listener)
  },
  onTerminalStateChange: (
    callback: (event: { sessionId: string; state: any }) => void
  ) => {
    const listener = (_event: IpcRendererEvent, payload: { sessionId: string; state: any }): void =>
      callback(payload)
    ipcRenderer.on('terminal:stateChange', listener)
    return () => ipcRenderer.removeListener('terminal:stateChange', listener)
  },

  // ADE Pilar 2: Spec-to-Agent Compiler & Dispatcher
  compileSpec: (input) => ipcRenderer.invoke('agent:compileSpec', input),
  dispatchMission: (input) => ipcRenderer.invoke('agent:dispatchMission', input),
  previewMissionPrompt: (input) => ipcRenderer.invoke('agent:previewPrompt', input),

  // ADE Pilar 3: Worktree & Agent Mission Control
  listAgentSessions: (notebookId?: string) => ipcRenderer.invoke('agent:listSessions', notebookId),
  mergeWorktreeSession: (sessionId: string, commitMessage?: string) =>
    ipcRenderer.invoke('agent:mergeWorktree', { sessionId, commitMessage }),
  discardWorktreeSession: (sessionId: string) =>
    ipcRenderer.invoke('agent:discardWorktree', sessionId),
  quickApproveSession: (sessionId: string) =>
    ipcRenderer.invoke('agent:quickApprove', sessionId),
  onAgentSessionUpdated: (callback: (session: any) => void) => {
    const listener = (_event: IpcRendererEvent, payload: any): void => callback(payload)
    ipcRenderer.on('agent:sessionUpdated', listener)
    return () => ipcRenderer.removeListener('agent:sessionUpdated', listener)
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
