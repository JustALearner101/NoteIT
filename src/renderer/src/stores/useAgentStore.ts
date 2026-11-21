import { create } from 'zustand'
import type { AgentSessionRecord } from '@shared/types/domain'

export type AgentFilter = 'all' | 'active' | 'waiting' | 'completed' | 'failed'

interface AgentState {
  sessions: AgentSessionRecord[]
  activeFilter: AgentFilter
  isLoading: boolean
  selectedSessionId: string | null
  error: string | null

  loadSessions: (notebookId?: string) => Promise<void>
  mergeSession: (id: string, commitMsg?: string) => Promise<{ ok: boolean; error?: string }>
  discardSession: (id: string) => Promise<{ ok: boolean; error?: string }>
  quickApprove: (id: string) => Promise<{ ok: boolean }>
  setFilter: (filter: AgentFilter) => void
  setSelectedSessionId: (id: string | null) => void
  initListener: () => () => void
}

export const useAgentStore = create<AgentState>((set, get) => ({
  sessions: [],
  activeFilter: 'all',
  isLoading: false,
  selectedSessionId: null,
  error: null,

  loadSessions: async (notebookId?: string) => {
    try {
      set({ isLoading: true, error: null })
      const sessions = await window.noteitAPI.listAgentSessions(notebookId)
      set({ sessions, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || 'Failed to load agent sessions' })
    }
  },

  mergeSession: async (id: string, commitMsg?: string) => {
    try {
      const res = await window.noteitAPI.mergeWorktreeSession(id, commitMsg)
      if (res.ok) {
        // Refresh sessions list
        await get().loadSessions()
      }
      return res
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to merge worktree' }
    }
  },

  discardSession: async (id: string) => {
    try {
      const res = await window.noteitAPI.discardWorktreeSession(id)
      if (res.ok) {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          selectedSessionId: state.selectedSessionId === id ? null : state.selectedSessionId
        }))
      }
      return res
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to discard worktree' }
    }
  },

  quickApprove: async (id: string) => {
    try {
      const res = await window.noteitAPI.quickApproveSession(id)
      return res
    } catch {
      return { ok: false }
    }
  },

  setFilter: (filter: AgentFilter) => set({ activeFilter: filter }),
  setSelectedSessionId: (id: string | null) => set({ selectedSessionId: id }),

  initListener: () => {
    if (!window.noteitAPI?.onAgentSessionUpdated) return () => {}

    const cleanup = window.noteitAPI.onAgentSessionUpdated((updatedSession) => {
      set((state) => {
        const index = state.sessions.findIndex((s) => s.id === updatedSession.id)
        if (index >= 0) {
          const next = [...state.sessions]
          next[index] = updatedSession
          return { sessions: next }
        }
        return { sessions: [updatedSession, ...state.sessions] }
      })
    })

    return cleanup
  }
}))
