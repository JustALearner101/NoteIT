import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Check,
  Clock,
  Download,
  FileText,
  GitCompare,
  History,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Tag,
  Trash2,
  X
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { diffBlockSets } from '@shared/version-diff'
import type { BlockDiff } from '@shared/version-diff'
import type { BacklinkItem, DocumentBlock, Page, PageVersionSummary } from '@shared/types/domain'

interface SpecHeaderProps {
  page: Page
}

interface DiffView {
  diff: BlockDiff
  added: { id: string; snippet: string }[]
  removed: { id: string; snippet: string }[]
  changed: { id: string; before: string; after: string }[]
}

const SNIPPET_MAX = 80

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Aksi gagal.'
  // Electron membungkus error main process: "Error invoking remote method '...': Error: <pesan>".
  return error.message.split('Error: ').pop() || error.message
}

function formatRelativeTime(timestamp: number): string {
  const elapsed = Date.now() - timestamp
  if (elapsed < 60_000) return 'baru saja'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} menit lalu`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} jam lalu`
  if (elapsed < 7 * 86_400_000) return `${Math.floor(elapsed / 86_400_000)} hari lalu`
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

/** Potongan 80 karakter pertama supaya daftar diff tetap terbaca. */
function previewText(block: DocumentBlock | undefined): string {
  if (!block) return ''
  const text =
    block.content.trim() || block.calloutTitle || block.databaseTitle || `(${block.type})`
  const flat = text.replace(/\s+/g, ' ')
  return flat.length > SNIPPET_MAX ? `${flat.slice(0, SNIPPET_MAX)}…` : flat
}

function buildDiffView(
  currentBlocks: DocumentBlock[],
  currentTitle: string,
  snapshotBlocks: DocumentBlock[],
  snapshotTitle: string
): DiffView {
  const diff = diffBlockSets(currentBlocks, snapshotBlocks, {
    current: currentTitle,
    snapshot: snapshotTitle
  })
  const currentById = new Map(currentBlocks.map((block) => [block.id, block]))
  const snapshotById = new Map(snapshotBlocks.map((block) => [block.id, block]))

  return {
    diff,
    added: diff.added.map((id) => ({ id, snippet: previewText(currentById.get(id)) })),
    removed: diff.removed.map((id) => ({ id, snippet: previewText(snapshotById.get(id)) })),
    changed: diff.changed.map((id) => ({
      id,
      before: previewText(snapshotById.get(id)),
      after: previewText(currentById.get(id))
    }))
  }
}

export const SpecHeader: React.FC<SpecHeaderProps> = ({ page }) => {
  const {
    notebooks,
    sections,
    updatePage,
    switchPageMode,
    openPageInTab,
    showToast
  } = useWorkspaceStore()

  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([])
  const [versions, setVersions] = useState<PageVersionSummary[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [activeDrawer, setActiveDrawer] = useState<'backlinks' | 'versions' | null>(null)
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [snapshotLabel, setSnapshotLabel] = useState('')
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [diffBase, setDiffBase] = useState('')
  const [diffTarget, setDiffTarget] = useState('current')
  const [diffView, setDiffView] = useState<DiffView | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const section = sections.find((s) => s.id === page.sectionId)
  const notebook = notebooks.find((n) => n.id === section?.notebookId)
  const marker = MARKER_META[section?.color || 'cobalt']

  const refreshVersions = async (): Promise<PageVersionSummary[]> => {
    const items = await window.noteitAPI.getPageVersions(page.id)
    setVersions(items)
    setDiffBase((current) =>
      items.some((ver) => ver.id === current) ? current : (items[0]?.id ?? '')
    )
    return items
  }

  // Fetch saat halaman berganti dan saat drawer dibuka — bukan tiap save.
  useEffect(() => {
    let mounted = true
    setVersionsLoading(true)
    Promise.all([
      window.noteitAPI.getBacklinks(page.id),
      window.noteitAPI.getPageVersions(page.id)
    ])
      .then(([items, vers]) => {
        if (!mounted) return
        setBacklinks(items)
        setVersions(vers)
        setDiffBase((current) =>
          vers.some((ver) => ver.id === current) ? current : (vers[0]?.id ?? '')
        )
      })
      .catch(() => {
        if (mounted) showToast('Gagal memuat riwayat snapshot')
      })
      .finally(() => {
        if (mounted) setVersionsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [page.id, activeDrawer])

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    },
    []
  )

  /** Satu timer untuk restore/hapus: hanya satu tombol yang bisa dalam mode konfirmasi. */
  const armConfirm = (kind: 'restore' | 'delete', versionId: string): void => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setPendingRestoreId(kind === 'restore' ? versionId : null)
    setPendingDeleteId(kind === 'delete' ? versionId : null)
    confirmTimer.current = setTimeout(() => {
      setPendingRestoreId(null)
      setPendingDeleteId(null)
      confirmTimer.current = null
    }, 4000)
  }

  const resetConfirm = (): void => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    confirmTimer.current = null
    setPendingRestoreId(null)
    setPendingDeleteId(null)
  }

  const handleSaveSnapshot = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      const created = await window.noteitAPI.createPageSnapshot(
        page.id,
        snapshotLabel || `Snapshot v${page.versionCount + 1}`
      )
      await refreshVersions()
      setSnapshotLabel('')
      showToast(`${created.label} disimpan ke SQLite`)
    } catch (error) {
      showToast(errorMessage(error))
    }
  }

  const performRestore = async (ver: PageVersionSummary): Promise<void> => {
    try {
      await window.noteitAPI.restorePageSnapshot(page.id, ver.id)
      await useWorkspaceStore.getState().loadWorkspace()
      await refreshVersions()
      setDiffView(null)
      showToast(`Dipulihkan ke v${ver.versionNumber} — ${ver.label}`)
    } catch (error) {
      showToast(errorMessage(error))
    }
  }

  const handleRestoreClick = (ver: PageVersionSummary): void => {
    if (pendingRestoreId !== ver.id) {
      armConfirm('restore', ver.id)
      return
    }
    resetConfirm()
    void performRestore(ver)
  }

  const performDelete = async (ver: PageVersionSummary): Promise<void> => {
    try {
      await window.noteitAPI.deletePageSnapshot(page.id, ver.id)
      await refreshVersions()
      setDiffView(null)
      showToast(`Snapshot v${ver.versionNumber} dihapus`)
    } catch (error) {
      showToast(errorMessage(error))
    }
  }

  const handleDeleteClick = (ver: PageVersionSummary): void => {
    if (pendingDeleteId !== ver.id) {
      armConfirm('delete', ver.id)
      return
    }
    resetConfirm()
    void performDelete(ver)
  }

  const startRename = (ver: PageVersionSummary): void => {
    setRenamingId(ver.id)
    setRenameDraft(ver.label)
  }

  const commitRename = async (ver: PageVersionSummary): Promise<void> => {
    const clean = renameDraft.trim()
    setRenamingId(null)
    if (!clean || clean === ver.label) return
    try {
      const updated = await window.noteitAPI.renamePageSnapshot(page.id, ver.id, clean)
      await refreshVersions()
      showToast(`Label v${updated.versionNumber} diubah`)
    } catch (error) {
      showToast(errorMessage(error))
    }
  }

  const handleCompare = async (): Promise<void> => {
    if (!diffBase) {
      showToast('Pilih versi pembanding dulu')
      return
    }
    if (diffTarget !== 'current' && diffTarget === diffBase) {
      showToast('Pilih dua versi yang berbeda')
      return
    }

    setDiffLoading(true)
    try {
      const base = await window.noteitAPI.getPageVersion(page.id, diffBase)
      const target =
        diffTarget === 'current'
          ? null
          : await window.noteitAPI.getPageVersion(page.id, diffTarget)
      setDiffView(
        buildDiffView(
          target?.blocks ?? page.blocks,
          target?.title ?? page.title,
          base.blocks,
          base.title
        )
      )
    } catch (error) {
      showToast(errorMessage(error))
    } finally {
      setDiffLoading(false)
    }
  }

  const handleAddTag = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const clean = newTagInput.trim().toLowerCase().replace(/^#/, '')
    if (!clean) return
    if (!page.tags.includes(clean)) {
      await updatePage({ id: page.id, tags: [...page.tags, clean] })
    }
    setNewTagInput('')
    setIsAddingTag(false)
  }

  const handleRemoveTag = async (tagToRemove: string): Promise<void> => {
    await updatePage({
      id: page.id,
      tags: page.tags.filter((t) => t !== tagToRemove)
    })
  }

  // Satu sumber ekspor: main process (export.service.ts) yang paham blok
  // graphviz/database/canvas. Builder lokal dulu menghasilkan file berbeda
  // dari CommandPalette — jangan dihidupkan lagi di renderer.
  const handleExportMarkdown = async (): Promise<void> => {
    const result = await window.noteitAPI.exportMarkdown({ scope: 'page', pageId: page.id })
    showToast(
      result.saved && result.filePath
        ? `Markdown tersimpan: ${result.filePath}`
        : 'Ekspor halaman dibatalkan'
    )
  }

  return (
    <div className="bg-surface-chrome/70 border-b border-border-hairline shrink-0 select-none">
      {/* Top Blueprint Spec Strip (28px height) */}
      <div className="h-7 px-4 border-b border-border-subtle flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-3.5 rounded-[2px] ${marker.bgStrip} shrink-0`} />
          <span className="text-ink-muted uppercase truncate">{notebook?.name}</span>
          <span className="text-ink-muted">/</span>
          <span className={`uppercase font-medium ${marker.text}`}>
            {section?.code}: {section?.name}
          </span>
          <span className="text-ink-muted">/</span>
          <span className="px-1.5 py-0.2 rounded bg-surface-elevated border border-border-hairline text-ink-primary">
            {page.code}
          </span>
        </div>

        {/* Spec Strip Telemetry Badges: Backlinks, Snapshots, Favorite, Export */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'backlinks' ? null : 'backlinks')}
            className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors ${
              activeDrawer === 'backlinks'
                ? 'bg-accent-cobalt/15 border-accent-cobalt text-accent-cobalt'
                : 'bg-surface-elevated border-border-hairline text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <ArrowLeftRight size={11} />
            <span>{backlinks.length} BACKLINKS</span>
          </button>

          <button
            onClick={() => setActiveDrawer(activeDrawer === 'versions' ? null : 'versions')}
            className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors ${
              activeDrawer === 'versions'
                ? 'bg-accent-amber/15 border-accent-amber text-accent-amber'
                : 'bg-surface-elevated border-border-hairline text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <History size={11} />
            <span>v{versions.length || page.versionCount} SNAPSHOTS</span>
          </button>

          <button
            onClick={() => updatePage({ id: page.id, isFavorite: !page.isFavorite })}
            title={page.isFavorite ? 'Hapus dari Favorites' : 'Sematkan ke Favorites'}
            className={`p-1 rounded border transition-colors ${
              page.isFavorite
                ? 'bg-accent-amber/15 border-accent-amber/40 text-accent-amber'
                : 'bg-surface-elevated border-border-hairline text-ink-muted hover:text-ink-primary'
            }`}
          >
            <Star size={11} fill={page.isFavorite ? 'currentColor' : 'none'} />
          </button>

          <button
            onClick={handleExportMarkdown}
            title="Ekspor ke Markdown (.md)"
            className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary hover:text-ink-primary flex items-center gap-1 transition-colors"
          >
            <Download size={11} />
            <span>.MD</span>
          </button>
        </div>
      </div>

      {/* Main Title Bar + Mechanical Mode Caliper Switch [ ▤ DOC | ⊞ CANVAS ] */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{page.icon}</span>
            <input
              type="text"
              value={page.title}
              onChange={(e) => updatePage({ id: page.id, title: e.target.value })}
              placeholder="Judul Spesifikasi Halaman..."
              className="w-full bg-transparent font-display font-bold text-2xl tracking-tight text-ink-primary focus:outline-none border-b border-transparent focus:border-accent-cobalt/50"
            />
          </div>

          {/* Tags & Timestamp Metadata Row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            <Tag size={11} className="text-ink-muted mr-0.5" />
            {page.tags.map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.2 rounded bg-surface-elevated border border-border-hairline text-ink-secondary flex items-center gap-1"
              >
                <span>#{t}</span>
                <button
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-[#EF4444] text-ink-muted"
                >
                  ×
                </button>
              </span>
            ))}

            {isAddingTag ? (
              <form onSubmit={handleAddTag} className="inline-flex items-center">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onBlur={() => setIsAddingTag(false)}
                  placeholder="tag-baru..."
                  autoFocus
                  className="w-24 px-1.5 py-0.2 rounded bg-surface-elevated border border-accent-cobalt text-[11px] text-ink-primary focus:outline-none"
                />
              </form>
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                className="px-1.5 py-0.2 rounded border border-dashed border-border-hairline text-ink-muted hover:text-accent-cobalt hover:border-accent-cobalt flex items-center gap-0.5"
              >
                <Plus size={10} /> tag
              </button>
            )}

            <span className="text-ink-muted mx-1">·</span>
            <span className="text-ink-muted flex items-center gap-1 tabular-nums">
              <Clock size={11} />
              DIPERBARUI{' '}
              {new Date(page.updatedAt).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>

        {/* Signature Mechanical Mode Caliper Switch */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-0.5 rounded-[6px] bg-surface-elevated border border-border-hairline flex items-center font-mono text-[11px]">
            <button
              onClick={() => switchPageMode(page.id, 'block')}
              className={`px-3 py-1.5 rounded-[4px] flex items-center gap-1.5 transition-all duration-150 ${
                page.mode === 'block'
                  ? 'bg-accent-cobalt text-white font-semibold shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <FileText size={13} />
              <span>▤ DOC</span>
            </button>
            <button
              onClick={() => switchPageMode(page.id, 'canvas')}
              className={`px-3 py-1.5 rounded-[4px] flex items-center gap-1.5 transition-all duration-150 ${
                page.mode === 'canvas'
                  ? 'bg-accent-amber text-black font-semibold shadow-sm'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <LayoutGrid size={13} />
              <span>⊞ CANVAS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Drawer: Bi-directional Backlinks or Local Version Snapshots */}
      {activeDrawer === 'backlinks' && (
        <div className="px-6 py-3 bg-surface-elevated border-t border-border-hairline">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-accent-cobalt font-semibold">
              REFERENSI SILang DUA ARAH (BACKLINKS KE {page.code})
            </span>
            <button
              onClick={() => setActiveDrawer(null)}
              className="text-ink-muted hover:text-ink-primary"
            >
              <X size={14} />
            </button>
          </div>
          {backlinks.length === 0 ? (
            <p className="text-xs text-ink-secondary">
              Belum ada halaman lain yang menautkan <code className="font-mono text-accent-cobalt">[[{page.title}]]</code>. Ketik <code className="font-mono">[[{page.title}]]</code> di halaman mana pun untuk membangun koneksi dua arah.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {backlinks.map((bl) => (
                <div
                  key={bl.sourcePageId}
                  onClick={() => openPageInTab(bl.sourcePageId)}
                  className="p-2.5 rounded-[6px] bg-surface-chrome hover:bg-surface-hover border border-border-hairline cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-ink-primary flex items-center gap-1.5">
                      <span>{bl.sourcePageIcon}</span>
                      <span>{bl.sourcePageTitle}</span>
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-elevated text-accent-cobalt">
                      {bl.sourcePageCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-secondary line-clamp-2 font-mono">
                    {bl.contextSnippet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeDrawer === 'versions' && (
        <div className="px-6 py-3 bg-surface-elevated border-t border-border-hairline">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-accent-amber font-semibold">
              RIWAYAT SNAPSHOT LOKAL (SQLITE PAGE_VERSIONS)
            </span>
            <button
              onClick={() => setActiveDrawer(null)}
              className="text-ink-muted hover:text-ink-primary"
            >
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleSaveSnapshot} className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder="Label snapshot (mis. Sebelum ubah skema order)..."
              className="flex-1 px-2.5 py-1 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus:outline-none focus:border-accent-amber"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded bg-accent-amber text-black font-mono text-xs font-semibold hover:opacity-90"
            >
              Simpan Snapshot
            </button>
          </form>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {versionsLoading && versions.length === 0 ? (
              <div className="flex items-center gap-2 py-3 font-mono text-xs text-ink-muted">
                <Loader2 size={12} className="animate-spin" />
                <span>Memuat riwayat snapshot...</span>
              </div>
            ) : versions.length === 0 ? (
              <p className="py-2 text-xs text-ink-secondary">
                Belum ada snapshot. Simpan snapshot pertama lewat kolom di atas.
              </p>
            ) : (
              versions.map((ver, index) => (
                <div
                  key={ver.id}
                  className="px-3 py-1.5 rounded bg-surface-chrome border border-border-hairline flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-accent-amber/15 text-accent-amber border border-accent-amber/30">
                      v{ver.versionNumber}
                    </span>

                    {renamingId === ver.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          void commitRename(ver)
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          autoFocus
                          className="w-48 px-1.5 py-0.2 rounded bg-surface-elevated border border-accent-amber text-[11px] text-ink-primary focus:outline-none"
                        />
                        <button
                          type="submit"
                          title="Simpan label"
                          className="p-0.5 text-accent-amber hover:text-ink-primary"
                        >
                          <Check size={12} />
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => startRename(ver)}
                        title="Klik untuk ubah label"
                        className="flex items-center gap-1 min-w-0 font-medium text-ink-primary hover:text-accent-amber"
                      >
                        <span className="truncate max-w-[220px]">{ver.label}</span>
                        <Pencil size={10} className="opacity-40 shrink-0" />
                      </button>
                    )}

                    {index === 0 && (
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-accent-cobalt/15 text-accent-cobalt border border-accent-cobalt/30">
                        CURRENT
                      </span>
                    )}

                    {ver.tags === null && (
                      <span
                        title="Snapshot legacy: dibuat sebelum tags tersimpan, jadi tags halaman tidak dipulihkan"
                        className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-elevated text-ink-muted border border-border-hairline"
                      >
                        tanpa tags
                      </span>
                    )}

                    <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                      {formatRelativeTime(ver.createdAt)}
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {ver.blockCount} blok
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRestoreClick(ver)}
                      className={`px-2 py-0.5 rounded border font-mono text-[11px] flex items-center gap-1 transition-colors ${
                        pendingRestoreId === ver.id
                          ? 'bg-[#EF4444]/15 border-[#EF4444]/50 text-[#EF4444] font-semibold'
                          : 'bg-surface-elevated hover:bg-surface-hover border-border-hairline text-ink-secondary hover:text-ink-primary'
                      }`}
                    >
                      <RotateCcw size={11} />
                      <span>{pendingRestoreId === ver.id ? 'Yakin? Klik lagi' : 'Pulihkan'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteClick(ver)}
                      title="Hapus snapshot"
                      className={`px-2 py-0.5 rounded border font-mono text-[11px] flex items-center gap-1 transition-colors ${
                        pendingDeleteId === ver.id
                          ? 'bg-[#EF4444]/15 border-[#EF4444]/50 text-[#EF4444] font-semibold'
                          : 'bg-surface-elevated hover:bg-surface-hover border-border-hairline text-ink-muted hover:text-[#EF4444]'
                      }`}
                    >
                      <Trash2 size={11} />
                      {pendingDeleteId === ver.id && <span>Yakin?</span>}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Panel diff inline: versi vs versi, atau versi vs kondisi sekarang */}
          <div className="mt-3 pt-3 border-t border-border-hairline">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <GitCompare size={12} className="text-accent-amber" />
              <span className="uppercase tracking-wider text-ink-muted">Bandingkan</span>
              <select
                value={diffBase}
                onChange={(e) => setDiffBase(e.target.value)}
                className="px-1.5 py-0.5 rounded bg-surface-chrome border border-border-hairline text-ink-primary focus:outline-none focus:border-accent-amber max-w-[220px]"
              >
                <option value="">Pilih versi...</option>
                {versions.map((ver) => (
                  <option key={ver.id} value={ver.id}>
                    v{ver.versionNumber} — {ver.label}
                  </option>
                ))}
              </select>
              <span className="text-ink-muted">→</span>
              <select
                value={diffTarget}
                onChange={(e) => setDiffTarget(e.target.value)}
                className="px-1.5 py-0.5 rounded bg-surface-chrome border border-border-hairline text-ink-primary focus:outline-none focus:border-accent-amber max-w-[220px]"
              >
                <option value="current">Kondisi sekarang</option>
                {versions.map((ver) => (
                  <option key={ver.id} value={ver.id}>
                    v{ver.versionNumber} — {ver.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void handleCompare()}
                disabled={diffLoading || versions.length === 0}
                className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-secondary hover:text-ink-primary flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {diffLoading ? <Loader2 size={11} className="animate-spin" /> : null}
                <span>Bandingkan</span>
              </button>
            </div>

            {diffView && (
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="text-[#4ADE80]">+{diffView.diff.added.length} ditambah</span>
                  <span className="text-[#EF4444]">-{diffView.diff.removed.length} dihapus</span>
                  <span className="text-accent-amber">~{diffView.diff.changed.length} diubah</span>
                  <span className="text-ink-muted">{diffView.diff.unchanged} sama</span>
                  {diffView.diff.titleChanged && (
                    <span className="text-accent-cobalt">judul berubah</span>
                  )}
                </div>

                {diffView.diff.added.length === 0 &&
                diffView.diff.removed.length === 0 &&
                diffView.diff.changed.length === 0 ? (
                  <p className="text-[11px] text-ink-secondary">
                    Tidak ada perbedaan blok pada dua versi ini.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5 font-mono text-[11px]">
                    {diffView.added.map((row) => (
                      <div key={`add-${row.id}`} className="flex items-start gap-1.5">
                        <span className="text-[#4ADE80] shrink-0">+</span>
                        <span className="text-ink-secondary truncate">{row.snippet}</span>
                      </div>
                    ))}
                    {diffView.removed.map((row) => (
                      <div key={`del-${row.id}`} className="flex items-start gap-1.5">
                        <span className="text-[#EF4444] shrink-0">-</span>
                        <span className="text-ink-muted truncate">{row.snippet}</span>
                      </div>
                    ))}
                    {diffView.changed.map((row) => (
                      <div key={`chg-${row.id}`} className="flex items-start gap-1.5">
                        <span className="text-accent-amber shrink-0">~</span>
                        <span className="min-w-0">
                          <span className="text-ink-secondary truncate block">{row.after}</span>
                          <span className="text-ink-muted truncate block">sebelum: {row.before}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
