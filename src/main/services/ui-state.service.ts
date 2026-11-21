import fs from 'node:fs'
import path from 'node:path'
import { getDbPath } from '../db/client'

export interface PersistedUiState {
  openTabIds: string[]
  activePageId: string
  splitPageId: string | null
  splitRatio: number
  closedTabIds: string[]
  isSidebarCollapsed: boolean
  activeNotebookId?: string
}

const DEFAULT_UI_STATE: PersistedUiState = {
  openTabIds: [],
  activePageId: '',
  splitPageId: null,
  splitRatio: 0.5,
  closedTabIds: [],
  isSidebarCollapsed: false
}

export function getUiStateFilePath(customWorkspaceDir?: string): string {
  if (customWorkspaceDir) {
    return path.join(customWorkspaceDir, 'ui-state.json')
  }
  const dbPath = getDbPath()
  if (!dbPath) {
    throw new Error('Workspace database path is not initialized.')
  }
  return path.join(path.dirname(dbPath), 'ui-state.json')
}

export function readUiState(customWorkspaceDir?: string): PersistedUiState | null {
  try {
    const filePath = getUiStateFilePath(customWorkspaceDir)
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PersistedUiState>
    if (!parsed || typeof parsed !== 'object') return null

    const openTabIds = Array.isArray(parsed.openTabIds)
      ? parsed.openTabIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
    const activePageId =
      typeof parsed.activePageId === 'string' ? parsed.activePageId : openTabIds[0] || ''
    const splitPageId =
      typeof parsed.splitPageId === 'string' && parsed.splitPageId.length > 0
        ? parsed.splitPageId
        : null
    const splitRatio =
      typeof parsed.splitRatio === 'number' &&
      Number.isFinite(parsed.splitRatio) &&
      parsed.splitRatio >= 0.2 &&
      parsed.splitRatio <= 0.8
        ? parsed.splitRatio
        : DEFAULT_UI_STATE.splitRatio
    const closedTabIds = Array.isArray(parsed.closedTabIds)
      ? parsed.closedTabIds
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
          .slice(0, 10)
      : []
    const isSidebarCollapsed = Boolean(parsed.isSidebarCollapsed)
    const activeNotebookId =
      typeof parsed.activeNotebookId === 'string' ? parsed.activeNotebookId : undefined

    return {
      openTabIds,
      activePageId,
      splitPageId,
      splitRatio,
      closedTabIds,
      isSidebarCollapsed,
      activeNotebookId
    }
  } catch {
    return null
  }
}

export function writeUiState(
  state: Partial<PersistedUiState>,
  customWorkspaceDir?: string
): PersistedUiState {
  const filePath = getUiStateFilePath(customWorkspaceDir)
  const existing = readUiState(customWorkspaceDir) ?? DEFAULT_UI_STATE

  const merged: PersistedUiState = {
    openTabIds: Array.isArray(state.openTabIds) ? state.openTabIds : existing.openTabIds,
    activePageId:
      typeof state.activePageId === 'string' ? state.activePageId : existing.activePageId,
    splitPageId:
      state.splitPageId !== undefined ? state.splitPageId : existing.splitPageId,
    splitRatio:
      typeof state.splitRatio === 'number' && Number.isFinite(state.splitRatio)
        ? Math.min(0.8, Math.max(0.2, state.splitRatio))
        : existing.splitRatio,
    closedTabIds: Array.isArray(state.closedTabIds)
      ? state.closedTabIds.slice(0, 10)
      : existing.closedTabIds,
    isSidebarCollapsed:
      typeof state.isSidebarCollapsed === 'boolean'
        ? state.isSidebarCollapsed
        : existing.isSidebarCollapsed,
    activeNotebookId:
      state.activeNotebookId !== undefined
        ? state.activeNotebookId
        : existing.activeNotebookId
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tempPath, JSON.stringify(merged, null, 2), 'utf-8')
  fs.renameSync(tempPath, filePath)
  return merged
}
