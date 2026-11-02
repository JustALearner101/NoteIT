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
import * as tabRules from '@renderer/lib/tabs'
import {
  applyThemeToDocument,
  loadPreferences,
  resolveThemeById,
  savePreferences,
  type ThemeDefinition,
  type WorkbenchPreferences
} from '@renderer/lib/themes'

export type MainViewMode = 'workbench' | 'settings' | 'ai-chat' | 'browser'

export interface BrowserContextPayload {
  url: string
  title: string
  excerpt: string
}

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
  splitRatio: number // Lebar pane kiri (0.2..0.8) saat Split-Pane aktif
  focusedPane: 'primary' | 'split'
  closedTabIds: string[] // Riwayat tab ditutup (Ctrl/Cmd+Shift+T), maks 10
  dirtyPageIds: string[] // Halaman dengan perubahan yang belum selesai ditulis
  selectedTagFilter: string | null

  // UI Chrome State
  isSidebarCollapsed: boolean
  isCommandPaletteOpen: boolean
  activeMainView: MainViewMode
  activeSettingsSection: string
  isBrowserSplitOpen: boolean
  browserContextForAI: BrowserContextPayload | null
  theme: 'dark' | 'light'
  preferences: WorkbenchPreferences
  telemetry: TelemetryState

  // Actions
  loadWorkspace: () => Promise<void>
  setActiveNotebook: (notebookId: string) => void
  openPageInTab: (pageId: string, inSplitPane?: boolean) => void
  closeTab: (pageId: string) => void
  reorderTabs: (fromId: string, toId: string) => void
  closeOtherTabs: (keepPageId: string) => void
  closeTabsToRight: (pageId: string) => void
  reopenLastClosed: () => void
  setSplitRatio: (ratio: number) => void
  toggleSplitPane: (targetPageId?: string) => void
  setFocusedPane: (pane: 'primary' | 'split') => void
  setSelectedTagFilter: (tag: string | null) => void

  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setActiveMainView: (view: MainViewMode, settingsSection?: string) => void
  setActiveSettingsSection: (section: string) => void
  toggleBrowserSplitPane: () => void
  setBrowserContextForAI: (ctx: BrowserContextPayload | null) => void
  toggleTheme: () => void
  setActiveTheme: (themeId: string) => void
  saveCustomTheme: (theme: ThemeDefinition) => void
  deleteCustomTheme: (themeId: string) => void
  updatePreferences: (patch: Partial<WorkbenchPreferences>) => void
  toggleOnboardingItem: (itemId: string) => void
  openHelpCenter: () => Promise<void>
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
 * Halaman yang punya perubahan belum tersimpan (dipakai untuk dirty dot di tab).
 *
 * Sumber kebenaran tetap saveQueue.hasPending(): set ini hanya MENAHAN id
 * selama IPC masih berjalan. flushPage() menghapus entri pending sebelum
 * memanggil send(), jadi hasPending() sudah false padahal SQLite belum tentu
 * selesai menulis — tanpa penahan ini dot akan berkedip hilang terlalu cepat.
 */
const dirtyPageIds = new Set<string>()

const syncDirtyState = (): void => {
  useWorkspaceStore.setState({ dirtyPageIds: Array.from(dirtyPageIds) })
}

const markPageDirty = (pageId: string): void => {
  if (dirtyPageIds.has(pageId)) return
  dirtyPageIds.add(pageId)
  syncDirtyState()
}

const clearPageDirty = (pageId: string): void => {
  // Ada edit baru yang menunggu flush: halaman ini masih kotor.
  if (saveQueue.hasPending(pageId)) return
  if (dirtyPageIds.delete(pageId)) syncDirtyState()
}

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
        clearPageDirty(pageId)
        // Jangan timpa state kalau sudah ada edit yang lebih baru menunggu flush.
        if (saveQueue.hasPending(pageId)) return
        useWorkspaceStore.setState((state) => ({
          pages: state.pages.map((p) => (p.id === saved.id ? saved : p))
        }))
      })
      .catch((error: unknown) => {
        // Gagal simpan tetap harus melepas dot: kalau tidak, tab tampak
        // "menyimpan" selamanya padahal antrean sudah kosong.
        clearPageDirty(pageId)
        console.error('[save-queue] gagal menyimpan halaman', pageId, error)
      })
  }
})

/** Satu-satunya pintu masuk patch halaman: selalu menandai dirty lebih dulu. */
const queuePagePatch = (pageId: string, patch: PagePatch): void => {
  markPageDirty(pageId)
  saveQueue.enqueue(pageId, patch)
}

const undoStack = createUndoStack<PageSnapshot>({ limit: 50, coalesceMs: 500 })

/** Terapkan snapshot undo/redo TANPA push entri baru, lalu simpan segera. */
const applySnapshot = (pageId: string, snapshot: PageSnapshot): void => {
  useWorkspaceStore.setState((state) => ({
    pages: state.pages.map((p) =>
      p.id === pageId ? { ...p, ...snapshot, updatedAt: Date.now() } : p
    )
  }))
  queuePagePatch(pageId, snapshot)
  saveQueue.flushAll()
}

/**
 * Persistensi tab (openTabIds / activePageId / splitPageId / splitRatio).
 *
 * BELUM TERVERIFIKASI: renderer Electron app ini dimuat dari origin file://
 * (out/renderer/index.html). Chromium tidak menjamin localStorage tersedia dan
 * persisten di origin file:// — perilakunya beda antar versi dan antar platform.
 * Kode ini sengaja defensif: semua akses dibungkus try/catch, dan parseTabs
 * menolak data yang tidak masuk akal. Kalau storage tidak tersedia, satu-satunya
 * efek adalah state tab tidak dipulihkan setelah restart (bukan crash).
 */
let tabsHydrated = false

const readPersistedTabs = (validIds: string[]): tabRules.TabPersistState | null => {
  try {
    return tabRules.parseTabs(window.localStorage.getItem(tabRules.TABS_STORAGE_KEY), validIds)
  } catch (error) {
    console.warn('[tabs] localStorage tidak bisa dibaca', error)
    return null
  }
}

const writePersistedTabs = (state: WorkspaceStore): void => {
  // Sebelum hidrasi, state tab masih default/kosong: menulis sekarang akan
  // menimpa sesi terakhir yang belum sempat dibaca.
  if (!tabsHydrated) return
  try {
    window.localStorage.setItem(
      tabRules.TABS_STORAGE_KEY,
      tabRules.serializeTabs({
        openTabIds: state.openTabIds,
        activePageId: state.activePageId,
        splitPageId: state.splitPageId,
        splitRatio: state.splitRatio
      })
    )
  } catch (error) {
    console.warn('[tabs] localStorage tidak bisa ditulis', error)
  }
}

/** Tab yang hilang dari daftar lama masuk riwayat reopen, urutan asli dipertahankan. */
const pushClosedTabs = (before: string[], after: string[], stack: string[]): string[] => {
  const kept = new Set(after)
  return before
    .filter((id) => !kept.has(id))
    .reduce((acc, id) => tabRules.pushReopen(id, acc), stack)
}

const initialPrefs = loadPreferences()
const initialThemeDef = resolveThemeById(initialPrefs.activeThemeId, initialPrefs.customThemes)
applyThemeToDocument(initialThemeDef, initialPrefs.motionLevel, initialPrefs.fontScale)

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
  splitRatio: tabRules.SPLIT_RATIO_DEFAULT,
  focusedPane: 'primary',
  closedTabIds: [],
  dirtyPageIds: [],
  selectedTagFilter: null,

  isSidebarCollapsed: false,
  isCommandPaletteOpen: false,
  activeMainView: 'workbench',
  activeSettingsSection: 'appearance',
  isBrowserSplitOpen: false,
  browserContextForAI: null,
  theme: initialThemeDef.colorScheme,
  preferences: initialPrefs,
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

    // Hidrasi tab sekali saja, dan hanya setelah data workspace tersedia:
    // parseTabs butuh daftar id halaman yang benar-benar ada di SQLite.
    if (!tabsHydrated) {
      tabsHydrated = true
      const restored = readPersistedTabs(snap.pages.map((p) => p.id))
      if (restored) {
        set({
          notebooks: snap.notebooks,
          sections: snap.sections,
          pages: snap.pages,
          tags: snap.tags,
          stats: snap.stats,
          activeNotebookId: defaultNotebookId,
          activePageId: restored.activePageId,
          openTabIds: restored.openTabIds,
          splitPageId: restored.splitPageId,
          splitRatio: restored.splitRatio,
          isLoading: false
        })
        return
      }
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
        activeMainView: 'workbench',
        splitPageId: pageId,
        focusedPane: 'split'
      })
      return
    }

    set((state) => ({
      activeMainView: 'workbench',
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
      // Aturan "pilih tetangga kanan lalu kiri" hidup di lib murni, bukan di sini.
      const result = tabRules.closeTabIds(state.openTabIds, state.activePageId, pageId)
      if (result.ids === state.openTabIds) return {}
      return {
        openTabIds: result.ids,
        activePageId: result.activeId,
        splitPageId: state.splitPageId === pageId ? null : state.splitPageId,
        closedTabIds: tabRules.pushReopen(pageId, state.closedTabIds)
      }
    })
  },

  reorderTabs: (fromId, toId) => {
    set((state) => {
      const next = tabRules.reorderTabs(state.openTabIds, fromId, toId)
      return next === state.openTabIds ? {} : { openTabIds: next }
    })
  },

  closeOtherTabs: (keepPageId) => {
    saveQueue.flushAll()
    set((state) => {
      const next = tabRules.closeOthers(state.openTabIds, keepPageId)
      if (next === state.openTabIds) return {}
      return {
        openTabIds: next,
        activePageId: next.includes(state.activePageId) ? state.activePageId : keepPageId,
        splitPageId:
          state.splitPageId && next.includes(state.splitPageId) ? state.splitPageId : null,
        closedTabIds: pushClosedTabs(state.openTabIds, next, state.closedTabIds)
      }
    })
  },

  closeTabsToRight: (pageId) => {
    saveQueue.flushAll()
    set((state) => {
      const next = tabRules.closeToRight(state.openTabIds, pageId)
      if (next === state.openTabIds) return {}
      return {
        openTabIds: next,
        activePageId: next.includes(state.activePageId) ? state.activePageId : pageId,
        splitPageId:
          state.splitPageId && next.includes(state.splitPageId) ? state.splitPageId : null,
        closedTabIds: pushClosedTabs(state.openTabIds, next, state.closedTabIds)
      }
    })
  },

  reopenLastClosed: () => {
    const popped = tabRules.popReopen(get().closedTabIds)
    if (!popped) return
    set({ closedTabIds: popped.rest })
    // Halaman bisa sudah dihapus sejak tab ditutup: jangan buka tab hantu.
    if (get().pages.some((p) => p.id === popped.id)) get().openPageInTab(popped.id)
  },

  setSplitRatio: (ratio) => set({ splitRatio: tabRules.clampSplitRatio(ratio) }),

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

  setActiveMainView: (view, settingsSection) =>
    set((state) => ({
      activeMainView: view,
      activeSettingsSection: settingsSection ?? state.activeSettingsSection
    })),

  setActiveSettingsSection: (section) => set({ activeSettingsSection: section }),

  toggleBrowserSplitPane: () =>
    set((state) => ({
      isBrowserSplitOpen: !state.isBrowserSplitOpen,
      splitPageId: !state.isBrowserSplitOpen ? null : state.splitPageId
    })),

  setBrowserContextForAI: (ctx) => set({ browserContextForAI: ctx }),

  toggleTheme: () => {
    set((state) => {
      const nextScheme = state.theme === 'dark' ? 'light' : 'dark'
      const nextThemeId = nextScheme === 'light' ? 'archival-vellum' : 'graphite-slate'
      const nextPrefs: WorkbenchPreferences = {
        ...state.preferences,
        activeThemeId: nextThemeId
      }
      savePreferences(nextPrefs)
      const themeDef = resolveThemeById(nextThemeId, nextPrefs.customThemes)
      applyThemeToDocument(themeDef, nextPrefs.motionLevel, nextPrefs.fontScale)
      return { theme: nextScheme, preferences: nextPrefs }
    })
  },

  setActiveTheme: (themeId) => {
    set((state) => {
      const nextPrefs: WorkbenchPreferences = {
        ...state.preferences,
        activeThemeId: themeId
      }
      savePreferences(nextPrefs)
      const themeDef = resolveThemeById(themeId, nextPrefs.customThemes)
      applyThemeToDocument(themeDef, nextPrefs.motionLevel, nextPrefs.fontScale)
      return {
        theme: themeDef.colorScheme,
        preferences: nextPrefs
      }
    })
  },

  saveCustomTheme: (customTheme) => {
    set((state) => {
      const filtered = state.preferences.customThemes.filter((t) => t.id !== customTheme.id)
      const customThemes = [...filtered, { ...customTheme, isCustom: true }]
      const nextPrefs: WorkbenchPreferences = {
        ...state.preferences,
        customThemes,
        activeThemeId: customTheme.id
      }
      savePreferences(nextPrefs)
      applyThemeToDocument(customTheme, nextPrefs.motionLevel, nextPrefs.fontScale)
      return {
        theme: customTheme.colorScheme,
        preferences: nextPrefs
      }
    })
    get().showToast(`Tema kustom '${customTheme.name}' disimpan & diterapkan`)
  },

  deleteCustomTheme: (themeId) => {
    set((state) => {
      const customThemes = state.preferences.customThemes.filter((t) => t.id !== themeId)
      const activeThemeId =
        state.preferences.activeThemeId === themeId
          ? 'graphite-slate'
          : state.preferences.activeThemeId
      const nextPrefs: WorkbenchPreferences = {
        ...state.preferences,
        customThemes,
        activeThemeId
      }
      savePreferences(nextPrefs)
      const themeDef = resolveThemeById(activeThemeId, customThemes)
      applyThemeToDocument(themeDef, nextPrefs.motionLevel, nextPrefs.fontScale)
      return {
        theme: themeDef.colorScheme,
        preferences: nextPrefs
      }
    })
    get().showToast('Tema kustom dihapus')
  },

  updatePreferences: (patch) => {
    set((state) => {
      const nextPrefs: WorkbenchPreferences = {
        ...state.preferences,
        ...patch
      }
      savePreferences(nextPrefs)
      const themeDef = resolveThemeById(nextPrefs.activeThemeId, nextPrefs.customThemes)
      applyThemeToDocument(themeDef, nextPrefs.motionLevel, nextPrefs.fontScale)
      return {
        theme: themeDef.colorScheme,
        preferences: nextPrefs
      }
    })
  },

  toggleOnboardingItem: (itemId) => {
    set((state) => {
      const exists = state.preferences.onboardingDone.includes(itemId)
      const onboardingDone = exists
        ? state.preferences.onboardingDone.filter((id) => id !== itemId)
        : [...state.preferences.onboardingDone, itemId]
      const nextPrefs: WorkbenchPreferences = {
        ...state.preferences,
        onboardingDone
      }
      savePreferences(nextPrefs)
      return { preferences: nextPrefs }
    })
  },

  openHelpCenter: async () => {
    if (window.noteitAPI?.openHelpExternal) {
      const res = await window.noteitAPI.openHelpExternal()
      if (res.ok) {
        get().showToast('Membuka NoteIT Help Center di browser...')
      } else {
        get().showToast(res.error || 'Gagal membuka Help Center')
      }
    }
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
    queuePagePatch(input.id, patch)
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

// Simpan state tab setiap kali berubah. Zustand memanggil listener setelah
// set(), jadi tulisan tetap sinkron dengan state terbaru.
useWorkspaceStore.subscribe((state, prev) => {
  if (
    state.openTabIds === prev.openTabIds &&
    state.activePageId === prev.activePageId &&
    state.splitPageId === prev.splitPageId &&
    state.splitRatio === prev.splitRatio
  ) {
    return
  }
  writePersistedTabs(state)
})
