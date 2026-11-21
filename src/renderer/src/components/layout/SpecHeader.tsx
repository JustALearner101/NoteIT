import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Check,
  Clock,
  Download,
  FileText,
  FolderGit2,
  GitCompare,
  History,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Tag,
  Terminal as TerminalIcon,
  Trash2,
  X,
  Zap
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { useTerminalStore } from '@renderer/stores/useTerminalStore'
import { MARKER_META } from '@renderer/lib/marker-colors'
import { Badge, Button, SegmentedControl, cn } from '@renderer/components/ui'
import { formatRelativeTime } from '@shared/date'
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
  if (!(error instanceof Error)) return 'Action failed.'
  return error.message.split('Error: ').pop() || error.message
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
    activeNotebookId,
    sections,
    rightSplitMode,
    setRightSplitMode,
    missionBriefingPageId,
    openMissionBriefing,
    updatePage,
    switchPageMode,
    openPageInTab,
    showToast
  } = useWorkspaceStore()

  const toggleTerminalDrawer = useTerminalStore((s) => s.toggleDrawer)

  const currentNotebook = notebooks.find((nb) => nb.id === activeNotebookId) || notebooks[0]
  const currentSection = sections.find((s) => s.id === page.sectionId)
  const currentRepoPath = currentSection?.repoPathOverride || currentNotebook?.repoPath || ''
  const repoBasename = currentRepoPath ? currentRepoPath.split(/[/\\]/).pop() : null

  const isMissionDrawerOpen = missionBriefingPageId === page.id
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
        if (mounted) showToast('Failed to load snapshot history')
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
      showToast(`${created.label} saved to SQLite`)
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
      showToast(`Restored to v${ver.versionNumber} — ${ver.label}`)
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
      showToast(`Snapshot v${ver.versionNumber} deleted`)
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
      showToast(`Label for v${updated.versionNumber} updated`)
    } catch (error) {
      showToast(errorMessage(error))
    }
  }

  const handleCompare = async (): Promise<void> => {
    if (!diffBase) {
      showToast('Select a base version to compare first')
      return
    }
    if (diffTarget !== 'current' && diffTarget === diffBase) {
      showToast('Select two different versions to compare')
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
        ? `Markdown saved: ${result.filePath}`
        : 'Page export canceled'
    )
  }

  return (
    <div className="bg-canvas-primary border-b border-border-hairline shrink-0 select-none">
      {/* Top Breadcrumb & Context Bar (Calm Sentence-Case Rhythm matching Image 3) */}
      <div className="h-[36px] px-5 border-b border-border-subtle flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0 text-ink-secondary">
          <span className={cn('w-2 h-2 rounded-[3px] shrink-0', marker.dotBg)} />
          <span className="truncate">{notebook?.name}</span>
          <span className="text-ink-muted">/</span>
          <span className="truncate font-medium text-ink-primary">{section?.name}</span>
          <span className="text-ink-muted">/</span>
          <Badge tone={section?.color || 'cobalt'} className="font-mono text-[10.5px]">
            {page.code}
          </Badge>
        </div>

        {/* Utility Metadata Controls: Backlinks, Snapshots, Favorite, Export */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-expanded={activeDrawer === 'backlinks'}
            aria-controls="spec-backlinks-drawer"
            onClick={() => setActiveDrawer(activeDrawer === 'backlinks' ? null : 'backlinks')}
            className={cn(
              'h-6 px-2 rounded-[6px] border text-[11.5px] font-medium flex items-center gap-1.5 transition-colors',
              activeDrawer === 'backlinks'
                ? 'bg-[var(--pill-cobalt-bg)] border-[var(--pill-cobalt-border)] text-[var(--pill-cobalt-text)]'
                : 'bg-surface-elevated/80 hover:bg-surface-hover border-border-hairline text-ink-secondary hover:text-ink-primary'
            )}
          >
            <ArrowLeftRight size={11.5} aria-hidden="true" />
            <span className="tabular-nums">{backlinks.length} Backlinks</span>
          </button>

          <button
            type="button"
            aria-expanded={activeDrawer === 'versions'}
            aria-controls="spec-versions-drawer"
            onClick={() => setActiveDrawer(activeDrawer === 'versions' ? null : 'versions')}
            className={cn(
              'h-6 px-2 rounded-[6px] border text-[11.5px] font-medium flex items-center gap-1.5 transition-colors',
              activeDrawer === 'versions'
                ? 'bg-[var(--pill-amber-bg)] border-[var(--pill-amber-border)] text-[var(--pill-amber-text)]'
                : 'bg-surface-elevated/80 hover:bg-surface-hover border-border-hairline text-ink-secondary hover:text-ink-primary'
            )}
          >
            <History size={11.5} aria-hidden="true" />
            <span className="tabular-nums">v{versions.length || page.versionCount}</span>
          </button>

          <button
            type="button"
            onClick={() => updatePage({ id: page.id, isFavorite: !page.isFavorite })}
            title={page.isFavorite ? 'Remove from favorites' : 'Pin to favorites'}
            aria-label={page.isFavorite ? 'Remove from favorites' : 'Pin to favorites'}
            aria-pressed={page.isFavorite}
            className={cn(
              'h-6 w-6 rounded-[6px] border flex items-center justify-center transition-colors',
              page.isFavorite
                ? 'bg-[var(--pill-amber-bg)] border-[var(--pill-amber-border)] text-accent-amber'
                : 'bg-surface-elevated/80 hover:bg-surface-hover border-border-hairline text-ink-muted hover:text-ink-primary'
            )}
          >
            <Star size={11.5} fill={page.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleExportMarkdown}
            title="Export to Markdown (.md)"
            className="h-6 px-2 rounded-[6px] bg-surface-elevated/80 hover:bg-surface-hover border border-border-hairline text-[11.5px] font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1 transition-colors"
          >
            <Download size={11.5} aria-hidden="true" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Main Title Bar + Recessed Doc|Canvas Switcher + Primary Periwinkle CTA */}
      <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2.5">
            <span className="text-[22px] leading-none" aria-hidden="true">{page.icon}</span>
            <input
              type="text"
              aria-label="Page title"
              value={page.title}
              onChange={(e) => updatePage({ id: page.id, title: e.target.value })}
              placeholder="Specification title..."
              className="w-full bg-transparent font-display font-bold text-[22px] tracking-[-0.02em] text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-transparent focus:border-accent-cobalt"
            />
          </div>

          {/* Tags & Timestamp Metadata Row */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <Tag size={11.5} className="text-ink-muted mr-0.5" aria-hidden="true" />
            {page.tags.map((t) => (
              <span
                key={t}
                className="px-2 py-[2px] rounded-[6px] bg-surface-elevated border border-border-hairline text-ink-secondary inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>#{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  aria-label={`Remove tag ${t}`}
                  className="hover:text-accent-rose text-ink-muted ml-0.5"
                >
                  ×
                </button>
              </span>
            ))}

            {isAddingTag ? (
              <form onSubmit={handleAddTag} className="inline-flex items-center">
                <input
                  type="text"
                  aria-label="New tag name"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onBlur={() => setIsAddingTag(false)}
                  placeholder="new-tag..."
                  autoFocus
                  className="w-24 px-2 py-[2px] rounded-[6px] bg-surface-elevated border border-accent-cobalt text-[11.5px] text-ink-primary focus:outline-none"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingTag(true)}
                className="px-2 py-[2px] rounded-[6px] border border-dashed border-border-hairline text-ink-muted hover:text-ink-primary hover:border-border-strong inline-flex items-center gap-0.5 transition-colors"
              >
                <Plus size={10.5} aria-hidden="true" /> Add tag
              </button>
            )}

            <span className="text-ink-muted mx-1">·</span>
            <span className="text-ink-muted inline-flex items-center gap-1 tabular-nums">
              <Clock size={11.5} aria-hidden="true" />
              Updated{' '}
              {new Date(page.updatedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>

        {/* Right Controls: Recessed Mode Switcher + Utility Actions + Single Primary Periwinkle CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <SegmentedControl
            ariaLabel="Page editor mode"
            value={page.mode}
            onChange={(mode) => void switchPageMode(page.id, mode)}
            options={[
              { value: 'block', label: 'Doc', icon: <FileText size={12.5} /> },
              { value: 'canvas', label: 'Canvas', icon: <LayoutGrid size={12.5} /> }
            ]}
          />

          <Button
            variant={rightSplitMode === 'repo-explorer' ? 'subtle' : 'secondary'}
            size="md"
            aria-pressed={rightSplitMode === 'repo-explorer'}
            onClick={() =>
              setRightSplitMode(rightSplitMode === 'repo-explorer' ? 'page' : 'repo-explorer')
            }
            title={
              currentRepoPath
                ? `Repository: ${currentRepoPath} (Click to toggle file tree)`
                : 'Connect a git repository folder to this notebook'
            }
          >
            <FolderGit2
              size={13}
              aria-hidden="true"
              className={currentRepoPath ? 'text-accent-cobalt' : 'text-ink-muted'}
            />
            <span className="truncate max-w-[120px]">{repoBasename || 'Bind repo'}</span>
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => toggleTerminalDrawer()}
            title="Toggle ADE Terminal Drawer (Ctrl+`)"
          >
            <TerminalIcon size={13} className="text-ink-secondary" aria-hidden="true" />
            <span>Terminal</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            aria-expanded={isMissionDrawerOpen}
            onClick={() => openMissionBriefing(page.id)}
            title="Compile spec & open Mission Briefing (Ctrl+Shift+D)"
          >
            <Zap size={13} aria-hidden="true" />
            <span>Dispatch Spec</span>
          </Button>
        </div>
      </div>

      {/* Expandable Drawer: Bi-directional Backlinks or Local Version Snapshots */}
      {activeDrawer === 'backlinks' && (
        <div
          id="spec-backlinks-drawer"
          role="region"
          aria-label={`Backlinks to ${page.code}`}
          className="px-6 py-3.5 bg-surface-chrome/70 border-t border-border-hairline animate-popover-enter"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-ink-primary flex items-center gap-2">
              <ArrowLeftRight size={13} className="text-accent-cobalt" aria-hidden="true" />
              <span>Backlinks to {page.code}</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              aria-label="Close backlinks drawer"
              className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          {backlinks.length === 0 ? (
            <p className="text-xs text-ink-secondary">
              No other pages link to{' '}
              <code className="font-mono text-accent-cobalt">[[{page.title}]]</code> yet. Type{' '}
              <code className="font-mono">[[{page.title}]]</code> on any page to create a
              bi-directional link.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {backlinks.map((bl) => (
                <button
                  key={bl.sourcePageId}
                  type="button"
                  onClick={() => openPageInTab(bl.sourcePageId)}
                  className="w-full text-left p-3 rounded-[10px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline cursor-pointer transition-colors"
                >
                  <span className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-ink-primary flex items-center gap-1.5">
                      <span>{bl.sourcePageIcon}</span>
                      <span>{bl.sourcePageTitle}</span>
                    </span>
                    <Badge tone="cobalt" className="font-mono text-[10px]">
                      {bl.sourcePageCode}
                    </Badge>
                  </span>
                  <span className="block text-[11.5px] text-ink-secondary line-clamp-2">
                    {bl.contextSnippet}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeDrawer === 'versions' && (
        <div
          id="spec-versions-drawer"
          role="region"
          aria-label="Local snapshot history"
          className="px-6 py-3.5 bg-surface-chrome/70 border-t border-border-hairline animate-popover-enter"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-ink-primary flex items-center gap-2">
              <History size={13} className="text-accent-amber" aria-hidden="true" />
              <span>Local snapshot history</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              aria-label="Close snapshot history drawer"
              className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSaveSnapshot} className="flex items-center gap-2 mb-3">
            <input
              type="text"
              aria-label="Snapshot label"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder="Snapshot label (e.g. Before order schema refactor)..."
              className="flex-1 h-8 px-3 rounded-[7px] bg-surface-elevated border border-border-hairline text-xs text-ink-primary placeholder:text-ink-muted focus:border-accent-cobalt"
            />
            <Button type="submit" variant="primary" size="md">
              Save Snapshot
            </Button>
          </form>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {versionsLoading && versions.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-xs text-ink-muted">
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                <span>Loading snapshot history...</span>
              </div>
            ) : versions.length === 0 ? (
              <p className="py-2 text-xs text-ink-secondary">
                No snapshots yet. Save your first snapshot using the field above.
              </p>
            ) : (
              versions.map((ver, index) => (
                <div
                  key={ver.id}
                  className="px-3 py-2 rounded-[8px] bg-surface-elevated border border-border-hairline flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Badge tone="amber" className="font-mono">
                      v{ver.versionNumber}
                    </Badge>

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
                          aria-label="Rename snapshot label"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          autoFocus
                          className="w-48 px-2 py-0.5 rounded-[6px] bg-surface-chrome border border-accent-cobalt text-xs text-ink-primary"
                        />
                        <button
                          type="submit"
                          title="Save label"
                          aria-label="Save snapshot label"
                          className="p-1 text-accent-cobalt hover:text-ink-primary"
                        >
                          <Check size={12} aria-hidden="true" />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startRename(ver)}
                        title="Click to rename label"
                        className="flex items-center gap-1.5 min-w-0 font-medium text-ink-primary hover:text-accent-cobalt"
                      >
                        <span className="truncate max-w-[220px]">{ver.label}</span>
                        <Pencil size={10.5} className="opacity-40 shrink-0" aria-hidden="true" />
                      </button>
                    )}

                    {index === 0 && <Badge tone="cobalt">Current</Badge>}

                    {ver.tags === null && (
                      <Badge
                        tone="neutral"
                        title="Legacy snapshot: created before tags were saved, so page tags will not be restored"
                      >
                        no tags
                      </Badge>
                    )}

                    <span className="text-[11px] text-ink-muted tabular-nums">
                      {formatRelativeTime(ver.createdAt)}
                    </span>
                    <span className="text-[11px] text-ink-muted tabular-nums">
                      · {ver.blockCount} {ver.blockCount === 1 ? 'block' : 'blocks'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant={pendingRestoreId === ver.id ? 'danger' : 'secondary'}
                      size="xs"
                      onClick={() => handleRestoreClick(ver)}
                    >
                      <RotateCcw size={11} aria-hidden="true" />
                      <span>{pendingRestoreId === ver.id ? 'Sure? Click again' : 'Restore'}</span>
                    </Button>

                    <Button
                      variant={pendingDeleteId === ver.id ? 'danger' : 'ghost'}
                      size="xs"
                      onClick={() => handleDeleteClick(ver)}
                      title="Delete snapshot"
                      aria-label={
                        pendingDeleteId === ver.id
                          ? `Confirm delete snapshot v${ver.versionNumber}`
                          : `Delete snapshot v${ver.versionNumber}`
                      }
                    >
                      <Trash2 size={11} aria-hidden="true" />
                      {pendingDeleteId === ver.id && <span>Confirm?</span>}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Inline diff panel */}
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <GitCompare size={13} className="text-accent-amber" aria-hidden="true" />
              <span className="text-ink-secondary font-medium">Compare</span>
              <select
                aria-label="Base snapshot version"
                value={diffBase}
                onChange={(e) => setDiffBase(e.target.value)}
                className="h-7 px-2 rounded-[6px] bg-surface-elevated border border-border-hairline text-xs text-ink-primary max-w-[220px]"
              >
                <option value="">Select version...</option>
                {versions.map((ver) => (
                  <option key={ver.id} value={ver.id}>
                    v{ver.versionNumber} — {ver.label}
                  </option>
                ))}
              </select>
              <span className="text-ink-muted">→</span>
              <select
                aria-label="Target version"
                value={diffTarget}
                onChange={(e) => setDiffTarget(e.target.value)}
                className="h-7 px-2 rounded-[6px] bg-surface-elevated border border-border-hairline text-xs text-ink-primary max-w-[220px]"
              >
                <option value="current">Current state</option>
                {versions.map((ver) => (
                  <option key={ver.id} value={ver.id}>
                    v{ver.versionNumber} — {ver.label}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleCompare()}
                disabled={diffLoading || versions.length === 0}
              >
                {diffLoading ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : null}
                <span>Compare</span>
              </Button>
            </div>

            {diffView && (
              <div className="mt-2.5 p-3 rounded-[8px] bg-surface-elevated border border-border-hairline space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="teal">+{diffView.diff.added.length} added</Badge>
                  <Badge tone="red">-{diffView.diff.removed.length} removed</Badge>
                  <Badge tone="amber">~{diffView.diff.changed.length} changed</Badge>
                  <span className="text-ink-muted text-[11px]">{diffView.diff.unchanged} unchanged</span>
                  {diffView.diff.titleChanged && <Badge tone="cobalt">Title changed</Badge>}
                </div>

                {diffView.diff.added.length === 0 &&
                diffView.diff.removed.length === 0 &&
                diffView.diff.changed.length === 0 ? (
                  <p className="text-xs text-ink-secondary">
                    No block differences between these two versions.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5 font-mono text-[11px]">
                    {diffView.added.map((row) => (
                      <div key={`add-${row.id}`} className="flex items-start gap-1.5">
                        <span className="text-[var(--pill-teal-text)] shrink-0">+</span>
                        <span className="text-ink-secondary truncate">{row.snippet}</span>
                      </div>
                    ))}
                    {diffView.removed.map((row) => (
                      <div key={`del-${row.id}`} className="flex items-start gap-1.5">
                        <span className="text-[var(--pill-red-text)] shrink-0">-</span>
                        <span className="text-ink-muted truncate">{row.snippet}</span>
                      </div>
                    ))}
                    {diffView.changed.map((row) => (
                      <div key={`chg-${row.id}`} className="flex items-start gap-1.5">
                        <span className="text-[var(--pill-amber-text)] shrink-0">~</span>
                        <span className="min-w-0">
                          <span className="text-ink-secondary truncate block">{row.after}</span>
                          <span className="text-ink-muted truncate block">before: {row.before}</span>
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
