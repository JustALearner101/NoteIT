import { create } from 'zustand'
import type {
  MarkerColor,
  Notebook,
  Page,
  PageMode,
  Section,
  WorkspaceSnapshot
} from '@shared/types/domain'
import type { CreatePageInput, UpdatePageInput } from '@shared/ipc-channels'
import { createSaveQueue } from '@renderer/lib/save-queue'
import { createUndoStack } from '@renderer/lib/undo-stack'

interface TelemetryState {
  cursorX: number
  cursorY: number
  zoomPercent: number
}

interface WorkspaceStore {
  // Data
  notebooks: Notebook[]
  sections: Section[]
  pages: Page[]
  tags: { name: string; color: MarkerColor; count: number }[]
  stats: WorkspaceSnapshot['stats']
  isLoading: boolean
  toastMessage: string | null

  // Navigation & Multi-Tab / Split-Pane State
  activeNotebookId: string
  openTabIds: string[]
  activePageId: string
  splitPageId: string | null // Right pane page ID when Split-Pane is active
  focusedPane: 'primary' | 'split'
  selectedTagFilter: string | null

  // UI Chrome State
  isSidebarCollapsed: boolean
  isCommandPaletteOpen: boolean
  theme: 'dark' | 'light'
  telemetry: TelemetryState

  // Actions
  loadWorkspace: () => Promise<void>
  setActiveNotebook: (notebookId: string) => void
  openPageInTab: (pageId: string, inSplitPane?: boolean) => void
  closeTab: (pageId: string) => void
  toggleSplitPane: (targetPageId?: string) => void
  setFocusedPane: (pane: 'primary' | 'split') => void
  setSelectedTagFilter: (tag: string | null) => void

  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  toggleTheme: () => void
  setTelemetry: (partial: Partial<TelemetryState>) => void
  showToast: (message: string) => void

  // Mutations via IPC
  createNotebook: (input: { name: string; icon: string; color: MarkerColor }) => Promise<void>
  createSection: (input: { notebookId: string; name: string; color: MarkerColor }) => Promise<void>
  createPage: (input: CreatePageInput) => Promise<Page>
  updatePage: (input: UpdatePageInput) => Promise<void>
  switchPageMode: (pageId: string, mode: PageMode) => Promise<void>
  deletePage: (pageId: string) => Promise<void>

  // Durability: debounced save + undo/redo per halaman
  flushSaves: () => void
  undo: (pageId?: string) => void
  redo: (pageId?: string) => void
}

/** Patch yang dikirim ke main process (tanpa id — id adalah kunci antrean). */
type PagePatch = Omit<UpdatePageInput, 'id'>

/** Snapshot undo: hanya isi dokumen, bukan metadata (mode, icon, sortOrder, ...). */
export interface PageSnapshot {
  title: string
  blocks: Page['blocks']
  canvasData: Page['canvasData']
  tags: string[]
}

const snapshotOf = (page: Page): PageSnapshot => ({
  title: page.title,
  blocks: page.blocks,
  canvasData: page.canvasData,
  tags: page.tags
})

/**
 * Perubahan dianggap nyata kalau salah satu field isi dokumen berubah.
 * Perbandingan pakai referensi: setiap edit menghasilkan array/objek baru,
 * jadi tidak perlu deep-compare (dan tidak ada JSON.stringify per ketikan).
 */
const hasContentChange = (page: Page, input: UpdatePageInput): boolean =>
  (input.title !== undefined && input.title !== page.title) ||
  (input.blocks !== undefined && input.blocks !== page.blocks) ||
  (input.canvasData !== undefined && input.canvasData !== page.canvasData) ||
  (input.tags !== undefined && input.tags !== page.tags)

/**
 * Antrean simpan: satu patch gabungan per halaman tiap 350ms idle.
 * send() sengaja tidak di-await — UI tidak boleh menunggu disk.
 */
const saveQueue = createSaveQueue<PagePatch>({
  delayMs: 350,
  send: (pageId, patch) => {
    void window.noteitAPI
      .updatePage({ id: pageId, ...patch })
      .then((saved) => {
        // Jangan timpa state kalau sudah ada edit yang lebih baru menunggu flush.
        if (saveQueue.hasPending(pageId)) return
        useWorkspaceStore.setState((state) => ({
          pages: state.pages.map((p) => (p.id === saved.id ? saved : p))
        }))
      })
      .catch((error: unknown) => {
        console.error('[save-queue] gagal menyimpan halaman', pageId, error)
      })
  }
})

const undoStack = createUndoStack<PageSnapshot>({ limit: 50, coalesceMs: 500 })

/** Terapkan snapshot undo/redo TANPA push entri baru, lalu simpan segera. */
const applySnapshot = (pageId: string, snapshot: PageSnapshot): void => {
  useWorkspaceStore.setState((state) => ({
    pages: state.pages.map((p) =>
      p.id === pageId ? { ...p, ...snapshot, updatedAt: Date.now() } : p
    )
  }))
  saveQueue.enqueue(pageId, snapshot)
  saveQueue.flushAll()
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  notebooks: [],
  sections: [],
  pages: [],
  tags: [],
  stats: {
    sqliteWalActive: true,
    ftsIndexedPages: 0,
    dbPath: ''
  },
  isLoading: true,
  toastMessage: null,

  activeNotebookId: '',
  openTabIds: [],
  activePageId: '',
  splitPageId: null,
  focusedPane: 'primary',
  selectedTagFilter: null,

  isSidebarCollapsed: false,
  isCommandPaletteOpen: false,
  theme: 'dark',
  telemetry: {
    cursorX: 120,
    cursorY: 85,
    zoomPercent: 100
  },

  loadWorkspace: async () => {
    // Reload dari DB akan menimpa state lokal: kirim dulu edit yang tertunda.
    saveQueue.flushAll()
    const snap = await window.noteitAPI.getWorkspace()
    const current = get()

    const defaultNotebookId =
      current.activeNotebookId && snap.notebooks.some((n) => n.id === current.activeNotebookId)
        ? current.activeNotebookId
        : snap.notebooks[0]?.id || ''

    const defaultPageId =
      current.activePageId && snap.pages.some((p) => p.id === current.activePageId)
        ? current.activePageId
        : snap.pages[0]?.id || ''

    const openTabIds =
      current.openTabIds.length > 0
        ? current.openTabIds.filter((id) => snap.pages.some((p) => p.id === id))
        : snap.pages.slice(0, 3).map((p) => p.id)

    if (defaultPageId && !openTabIds.includes(defaultPageId)) {
      openTabIds.unshift(defaultPageId)
    }

    set({
      notebooks: snap.notebooks,
      sections: snap.sections,
      pages: snap.pages,
      tags: snap.tags,
      stats: snap.stats,
      activeNotebookId: defaultNotebookId,
      activePageId: defaultPageId,
      openTabIds,
      isLoading: false
    })
  },

  setActiveNotebook: (notebookId) => {
    const { sections, pages } = get()
    const nbSections = sections.filter((s) => s.notebookId === notebookId)
    const firstPage = pages.find((p) => nbSections.some((s) => s.id === p.sectionId))
    set((state) => ({
      activeNotebookId: notebookId,
      activePageId: firstPage ? firstPage.id : state.activePageId,
      openTabIds:
        firstPage && !state.openTabIds.includes(firstPage.id)
          ? [...state.openTabIds, firstPage.id]
          : state.openTabIds
    }))
  },

  openPageInTab: (pageId, inSplitPane = false) => {
    saveQueue.flushAll()
    const { pages, sections } = get()
    const targetPage = pages.find((p) => p.id === pageId)
    if (!targetPage) return

    const sec = sections.find((s) => s.id === targetPage.sectionId)

    if (inSplitPane) {
      set({
        splitPageId: pageId,
        focusedPane: 'split'
      })
      return
    }

    set((state) => ({
      activeNotebookId: sec ? sec.notebookId : state.activeNotebookId,
      activePageId: pageId,
      focusedPane: 'primary',
      openTabIds: state.openTabIds.includes(pageId)
        ? state.openTabIds
        : [...state.openTabIds, pageId]
    }))
  },

  closeTab: (pageId) => {
    saveQueue.flushAll()
    set((state) => {
      const nextTabs = state.openTabIds.filter((id) => id !== pageId)
      let nextActive = state.activePageId
      if (state.activePageId === pageId) {
        nextActive = nextTabs[nextTabs.length - 1] || state.pages[0]?.id || ''
        if (nextActive && !nextTabs.includes(nextActive)) {
          nextTabs.push(nextActive)
        }
      }
      return {
        openTabIds: nextTabs,
        activePageId: nextActive,
        splitPageId: state.splitPageId === pageId ? null : state.splitPageId
      }
    })
  },

  toggleSplitPane: (targetPageId) => {
    saveQueue.flushAll()
    set((state) => {
      if (state.splitPageId && !targetPageId) {
        return { splitPageId: null, focusedPane: 'primary' }
      }
      const candidate =
        targetPageId ||
        state.openTabIds.find((id) => id !== state.activePageId) ||
        state.pages.find((p) => p.id !== state.activePageId)?.id ||
        state.activePageId
      return {
        splitPageId: candidate,
        focusedPane: 'split'
      }
    })
  },

  setFocusedPane: (pane) => set({ focusedPane: pane }),

  setSelectedTagFilter: (tag) =>
    set((state) => ({
      selectedTagFilter: state.selectedTagFilter === tag ? null : tag
    })),

  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      if (next === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return { theme: next }
    })
  },

  setTelemetry: (partial) =>
    set((state) => ({
      telemetry: { ...state.telemetry, ...partial }
    })),

  showToast: (message) => {
    set({ toastMessage: message })
    setTimeout(() => {
      set((state) => (state.toastMessage === message ? { toastMessage: null } : state))
    }, 2800)
  },

  createNotebook: async (input) => {
    const nb = await window.noteitAPI.createNotebook(input)
    await get().loadWorkspace()
    get().setActiveNotebook(nb.id)
    get().showToast(`Notebook '${nb.name}' dibuat`)
  },

  createSection: async (input) => {
    const sec = await window.noteitAPI.createSection(input)
    await get().loadWorkspace()
    get().showToast(`Section '${sec.name}' (${sec.code}) ditambahkan`)
  },

  createPage: async (input) => {
    const page = await window.noteitAPI.createPage(input)
    await get().loadWorkspace()
    get().openPageInTab(page.id)
    get().showToast(`Halaman '${page.title}' (${page.code}) dibuat`)
    return page
  },

  updatePage: async (input) => {
    const current = get().pages.find((p) => p.id === input.id)

    // Snapshot state SEBELUM perubahan. Coalescing 500ms di undo stack membuat
    // satu paragraf ketikan = satu langkah undo.
    if (current && hasContentChange(current, input)) {
      undoStack.push(input.id, snapshotOf(current))
    }

    // Optimistic local state update for zero-latency typing & dragging.
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === input.id
          ? {
              ...p,
              ...input,
              updatedAt: Date.now()
            }
          : p
      )
    }))

    // IPC lewat save queue (debounce 350ms). Promise resolve setelah enqueue,
    // bukan setelah flush, supaya UI tidak pernah menunggu disk.
    const { id: _pageId, ...patch } = input
    saveQueue.enqueue(input.id, patch)
  },

  switchPageMode: async (pageId, mode) => {
    saveQueue.flushAll()
    await get().updatePage({ id: pageId, mode })
    // Mode jarang berubah: simpan langsung, jangan biarkan tertahan 350ms.
    saveQueue.flushAll()
    get().showToast(
      mode === 'canvas'
        ? 'Beralih ke Mode Kanvas Spasial (24px Crosshair Grid)'
        : 'Beralih ke Mode Dokumen Blok'
    )
  },

  deletePage: async (pageId) => {
    const target = get().pages.find((p) => p.id === pageId)
    saveQueue.flushAll()
    await window.noteitAPI.deletePage(pageId)
    undoStack.clear(pageId)
    get().closeTab(pageId)
    await get().loadWorkspace()
    if (target) {
      get().showToast(`Halaman '${target.code}' dihapus`)
    }
  },

  flushSaves: () => {
    saveQueue.flushAll()
  },

  undo: (pageId) => {
    const { activePageId, pages } = get()
    // Target eksplisit dari App.tsx (pane yang fokus); fallback ke tab aktif.
    const targetId = pageId ?? activePageId
    const page = pages.find((p) => p.id === targetId)
    if (!page) return

    // State sekarang dikirim ke redo stack; applySnapshot tidak push entri baru.
    const snapshot = undoStack.undo(targetId, snapshotOf(page))
    if (snapshot) applySnapshot(targetId, snapshot)
  },

  redo: (pageId) => {
    const { activePageId } = get()
    const targetId = pageId ?? activePageId
    const snapshot = undoStack.redo(targetId)
    if (snapshot) applySnapshot(targetId, snapshot)
  }
}))
