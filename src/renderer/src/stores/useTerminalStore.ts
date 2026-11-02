import { create } from 'zustand'
import type { DetectedCliPreset, TerminalSessionInfo } from '@shared/types/domain'

interface TerminalTab {
  id: string
  title: string
  cliPresetId?: string
  shellType: 'conpty' | 'subprocess'
  cwd: string
  detectedState: TerminalSessionInfo['detectedState']
  bufferText: string
}

interface TerminalState {
  isOpen: boolean
  height: number
  tabs: TerminalTab[]
  activeTabId: string | null
  presets: DetectedCliPreset[]
  isLoadingPresets: boolean

  toggleDrawer: () => void
  openDrawer: () => void
  closeDrawer: () => void
  setHeight: (height: number) => void
  loadPresets: () => Promise<void>
  createSession: (input: {
    cwd: string
    command?: string
    args?: string[]
    title?: string
    cliPresetId?: string
  }) => Promise<string | null>
  closeSession: (id: string) => Promise<void>
  setActiveTabId: (id: string) => void
  appendBuffer: (id: string, text: string) => void
  updateDetectedState: (id: string, state: TerminalSessionInfo['detectedState']) => void
}

const DEFAULT_DRAWER_HEIGHT = 280
const MIN_DRAWER_HEIGHT = 140
const MAX_DRAWER_HEIGHT = 640

export const useTerminalStore = create<TerminalState>((set, get) => ({
  isOpen: false,
  height: DEFAULT_DRAWER_HEIGHT,
  tabs: [],
  activeTabId: null,
  presets: [],
  isLoadingPresets: false,

  toggleDrawer: () => set((state) => ({ isOpen: !state.isOpen })),
  openDrawer: () => set({ isOpen: true }),
  closeDrawer: () => set({ isOpen: false }),

  setHeight: (height) =>
    set({
      height: Math.max(MIN_DRAWER_HEIGHT, Math.min(MAX_DRAWER_HEIGHT, height))
    }),

  loadPresets: async () => {
    try {
      set({ isLoadingPresets: true })
      const presets = await window.noteitAPI.detectCliPresets()
      set({ presets, isLoadingPresets: false })
    } catch {
      set({ isLoadingPresets: false })
    }
  },

  createSession: async (input) => {
    try {
      const res = await window.noteitAPI.createTerminalSession(input)
      const newTab: TerminalTab = {
        id: res.sessionId,
        title: input.title || input.command || 'Terminal',
        cliPresetId: input.cliPresetId,
        shellType: res.shellType,
        cwd: input.cwd,
        detectedState: 'idle',
        bufferText: ''
      }

      set((state) => ({
        isOpen: true,
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id
      }))

      return newTab.id
    } catch (error) {
      console.error('Failed to create terminal session:', error)
      return null
    }
  },

  closeSession: async (id) => {
    try {
      await window.noteitAPI.killTerminal(id)
    } catch (e) {
      console.error('Failed to kill terminal:', e)
    }

    set((state) => {
      const nextTabs = state.tabs.filter((t) => t.id !== id)
      let nextActiveId = state.activeTabId
      if (state.activeTabId === id) {
        nextActiveId = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null
      }
      return {
        tabs: nextTabs,
        activeTabId: nextActiveId,
        isOpen: nextTabs.length > 0 ? state.isOpen : false
      }
    })
  },

  setActiveTabId: (id) => set({ activeTabId: id, isOpen: true }),

  appendBuffer: (id, text) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              bufferText: (tab.bufferText + text).slice(-8000)
            }
          : tab
      )
    })),

  updateDetectedState: (id, state) =>
    set((s) => ({
      tabs: s.tabs.map((tab) => (tab.id === id ? { ...tab, detectedState: state } : tab))
    }))
}))
