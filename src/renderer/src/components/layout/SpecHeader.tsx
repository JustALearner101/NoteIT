import React, { useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  Clock,
  Download,
  FileText,
  History,
  LayoutGrid,
  Plus,
  RotateCcw,
  Star,
  Tag,
  X
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import type { BacklinkItem, Page, PageVersion } from '@shared/types/domain'

interface SpecHeaderProps {
  page: Page
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
  const [versions, setVersions] = useState<PageVersion[]>([])
  const [activeDrawer, setActiveDrawer] = useState<'backlinks' | 'versions' | null>(null)
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [snapshotLabel, setSnapshotLabel] = useState('')

  const section = sections.find((s) => s.id === page.sectionId)
  const notebook = notebooks.find((n) => n.id === section?.notebookId)
  const marker = MARKER_META[section?.color || 'cobalt']

  useEffect(() => {
    let mounted = true
    window.noteitAPI.getBacklinks(page.id).then((items) => {
      if (mounted) setBacklinks(items)
    })
    window.noteitAPI.getPageVersions(page.id).then((vers) => {
      if (mounted) setVersions(vers)
    })
    return () => {
      mounted = false
    }
  }, [page.id, page.updatedAt])

  const handleSaveSnapshot = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const created = await window.noteitAPI.createPageSnapshot(
      page.id,
      snapshotLabel || `Snapshot v${page.versionCount + 1}`
    )
    const updatedVers = await window.noteitAPI.getPageVersions(page.id)
    setVersions(updatedVers)
    setSnapshotLabel('')
    showToast(`${created.label} disimpan ke SQLite`)
  }

  const handleRestoreSnapshot = async (ver: PageVersion): Promise<void> => {
    await window.noteitAPI.restorePageSnapshot(page.id, ver.id)
    await useWorkspaceStore.getState().loadWorkspace()
    setActiveDrawer(null)
    showToast(`Dipulihkan ke ${ver.label}`)
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

          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="px-3 py-1.5 rounded bg-surface-chrome border border-border-hairline flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-accent-amber/15 text-accent-amber border border-accent-amber/30">
                    v{ver.versionNumber}
                  </span>
                  <span className="font-medium text-ink-primary">{ver.label}</span>
                  <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                    {new Date(ver.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>
                <button
                  onClick={() => handleRestoreSnapshot(ver)}
                  className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline font-mono text-[11px] text-ink-secondary hover:text-ink-primary flex items-center gap-1"
                >
                  <RotateCcw size={11} />
                  <span>Pulihkan Snapshot</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
