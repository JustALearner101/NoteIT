import React, { useEffect, useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  RefreshCw,
  Search,
  Unlink,
  FolderPlus,
  Copy,
  Check
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import type { GitFileStatus, RepoEntry, RepoGitStatusSummary } from '@shared/types/domain'

interface TreeItemProps {
  entry: RepoEntry
  repoPath: string
  level: number
  onFileClick?: (entry: RepoEntry) => void
}

const GitBadge: React.FC<{ status?: GitFileStatus }> = ({ status }) => {
  if (!status) return null

  switch (status) {
    case 'modified':
      return (
        <span
          title="Dimodifikasi"
          className="text-[10px] font-mono px-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30"
        >
          M
        </span>
      )
    case 'added':
      return (
        <span
          title="Ditambahkan"
          className="text-[10px] font-mono px-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
        >
          A
        </span>
      )
    case 'untracked':
      return (
        <span
          title="Untracked"
          className="text-[10px] font-mono px-1 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
        >
          ?
        </span>
      )
    case 'deleted':
      return (
        <span
          title="Dihapus"
          className="text-[10px] font-mono px-1 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30"
        >
          D
        </span>
      )
    default:
      return null
  }
}

const TreeItem: React.FC<TreeItemProps> = ({ entry, repoPath, level, onFileClick }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [children, setChildren] = useState<RepoEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!entry.isDirectory) {
      onFileClick?.(entry)
      return
    }

    if (!isOpen && children.length === 0) {
      setIsLoading(true)
      try {
        const list = await window.noteitAPI.readRepoDir({
          repoPath,
          relPath: entry.relPath
        })
        setChildren(list)
      } catch (err) {
        console.error('Failed to read dir:', err)
      } finally {
        setIsLoading(false)
      }
    }
    setIsOpen(!isOpen)
  }

  const paddingLeft = `${level * 14 + 6}px`

  return (
    <div>
      <div
        onClick={handleToggle}
        style={{ paddingLeft }}
        className={`group h-6 pr-2 rounded-[3px] flex items-center justify-between text-xs cursor-pointer select-none transition-colors ${
          entry.isDirectory
            ? 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary font-medium'
            : 'text-ink-muted hover:bg-surface-hover/80 hover:text-ink-primary font-mono'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {entry.isDirectory ? (
            <span className="text-ink-muted shrink-0">
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          ) : (
            <span className="w-3 shrink-0" />
          )}

          {entry.isDirectory ? (
            isOpen ? (
              <FolderOpen size={13} className="text-accent-cobalt shrink-0" />
            ) : (
              <Folder size={13} className="text-ink-muted shrink-0" />
            )
          ) : entry.name.endsWith('.md') ? (
            <FileText size={13} className="text-amber-400/80 shrink-0" />
          ) : (
            <FileCode size={13} className="text-ink-muted shrink-0" />
          )}

          <span className="truncate">{entry.name}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <GitBadge status={entry.gitStatus} />
        </div>
      </div>

      {/* Anak Folder */}
      {isOpen && entry.isDirectory && (
        <div>
          {isLoading ? (
            <div style={{ paddingLeft: `${(level + 1) * 14 + 6}px` }} className="text-[11px] text-ink-muted py-1 font-mono">
              Memuat...
            </div>
          ) : children.length === 0 ? (
            <div style={{ paddingLeft: `${(level + 1) * 14 + 6}px` }} className="text-[11px] text-ink-muted py-0.5 font-mono italic opacity-60">
              (kosong)
            </div>
          ) : (
            children.map((child) => (
              <TreeItem
                key={child.relPath}
                entry={child}
                repoPath={repoPath}
                level={level + 1}
                onFileClick={onFileClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export const RepoExplorerTree: React.FC<{ isSplitMode?: boolean }> = () => {
  const {
    notebooks,
    activeNotebookId,
    sections,
    activePageId,
    pages,
    updateNotebookRepo,
    showToast
  } = useWorkspaceStore()

  const currentNotebook = notebooks.find((nb) => nb.id === activeNotebookId) || notebooks[0]
  const activePage = pages.find((p) => p.id === activePageId)
  const activeSection = sections.find((s) => s.id === activePage?.sectionId)

  const repoPath = activeSection?.repoPathOverride || currentNotebook?.repoPath || ''

  const [rootEntries, setRootEntries] = useState<RepoEntry[]>([])
  const [gitStatus, setGitStatus] = useState<RepoGitStatusSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [copiedPath, setCopiedPath] = useState<string | null>(null)

  const loadRepoData = async (targetPath: string) => {
    if (!targetPath) {
      setRootEntries([])
      setGitStatus(null)
      return
    }

    setIsLoading(true)
    try {
      const [entries, status] = await Promise.all([
        window.noteitAPI.readRepoDir({ repoPath: targetPath }),
        window.noteitAPI.getRepoGitStatus(targetPath)
      ])
      setRootEntries(entries)
      setGitStatus(status)
    } catch (error) {
      console.error('Failed to load repo data:', error)
      showToast('Gagal memuat isi repositori.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (repoPath) {
      loadRepoData(repoPath)
    } else {
      setRootEntries([])
      setGitStatus(null)
    }
  }, [repoPath])

  // Tombol Bind Repo Folder
  const handlePickRepo = async () => {
    if (!currentNotebook) return
    const res = await window.noteitAPI.pickRepoFolder(repoPath || undefined)
    if (!res.canceled && res.path) {
      await updateNotebookRepo(currentNotebook.id, res.path, res.branch)
      loadRepoData(res.path)
    }
  }

  // Tombol Unbind Repo Folder
  const handleUnlinkRepo = async () => {
    if (!currentNotebook) return
    await updateNotebookRepo(currentNotebook.id, null)
    setRootEntries([])
    setGitStatus(null)
  }

  // Klik file: salin WikiLink format [[relPath]] ke clipboard
  const handleFileClick = (entry: RepoEntry) => {
    const wikiRef = `[[${entry.relPath}]]`
    navigator.clipboard.writeText(wikiRef)
    setCopiedPath(entry.relPath)
    showToast(`Referensi ${wikiRef} disalin ke clipboard!`)
    setTimeout(() => setCopiedPath(null), 2000)
  }

  // Filter pencarian nama berkas
  const filteredEntries = useMemo(() => {
    if (!searchFilter.trim()) return rootEntries
    const q = searchFilter.toLowerCase()
    return rootEntries.filter((e) => e.name.toLowerCase().includes(q))
  }, [rootEntries, searchFilter])

  // State Kosong (Belum ada repo)
  if (!repoPath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-canvas-primary animate-view-enter">
        <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border-hairline flex items-center justify-center text-ink-muted mb-3 shadow-sm">
          <GitBranch size={22} className="text-accent-cobalt" />
        </div>
        <h3 className="font-semibold text-ink-primary text-sm mb-1">Hubungkan Repositori Proyek</h3>
        <p className="text-xs text-ink-secondary max-w-[280px] mb-4">
          Ikatkan folder git lokal ke Notebook <strong>{currentNotebook?.name}</strong> untuk mengaktifkan pohon berkas, status branch, dan ADE terminal context.
        </p>
        <button
          onClick={handlePickRepo}
          className="px-3.5 py-1.5 rounded-[5px] bg-accent-cobalt hover:bg-accent-cobalt/90 text-white font-medium text-xs flex items-center gap-2 shadow-sm transition-colors"
        >
          <FolderPlus size={14} />
          <span>Pilih Folder Repositori</span>
        </button>
      </div>
    )
  }

  const folderName = repoPath.split(/[/\\]/).pop()

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-canvas-primary border-l border-border-hairline select-none overflow-hidden animate-view-enter">
      {/* Header Info Repo */}
      <div className="p-2.5 bg-surface-chrome border-b border-border-hairline flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <GitBranch size={14} className="text-accent-cobalt shrink-0" />
            <span className="font-semibold text-xs text-ink-primary truncate font-mono">
              {folderName}
            </span>
            {gitStatus?.branch && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-accent-cobalt/15 text-accent-cobalt border border-accent-cobalt/30 shrink-0">
                {gitStatus.branch}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => loadRepoData(repoPath)}
              title="Muat Ulang Status Git & Berkas"
              disabled={isLoading}
              className="p-1 rounded hover:bg-surface-hover text-ink-muted hover:text-ink-primary disabled:opacity-40"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleUnlinkRepo}
              title="Lepas Hubungan Repositori dari Notebook Ini"
              className="p-1 rounded hover:bg-surface-hover text-ink-muted hover:text-rose-400"
            >
              <Unlink size={12} />
            </button>
          </div>
        </div>

        {/* Git Telemetry Strip */}
        {gitStatus && (
          <div className="flex items-center justify-between text-[10px] font-mono px-2 py-1 rounded bg-surface-elevated border border-border-hairline">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  gitStatus.isClean ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span className={gitStatus.isClean ? 'text-ink-secondary' : 'text-amber-400 font-medium'}>
                {gitStatus.isClean
                  ? 'Tree bersih'
                  : `${gitStatus.changedFiles.length} file diubah`}
              </span>
            </div>

            {(gitStatus.linesAdded > 0 || gitStatus.linesRemoved > 0) && (
              <div className="flex items-center gap-1">
                <span className="text-emerald-400">+{gitStatus.linesAdded}</span>
                <span className="text-rose-400">-{gitStatus.linesRemoved}</span>
              </div>
            )}
          </div>
        )}

        {/* Search Input Filter */}
        <div className="relative">
          <Search size={12} className="absolute left-2 top-2 text-ink-muted" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Cari berkas di repo..."
            className="w-full h-7 pl-6 pr-2 rounded-[4px] bg-surface-elevated border border-border-hairline text-ink-primary placeholder:text-ink-muted text-[11px] font-mono focus:outline-none focus:border-accent-cobalt"
          />
        </div>
      </div>

      {/* Directory Tree Scroll View */}
      <div className="flex-1 overflow-y-auto p-1.5 no-scrollbar">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-xs text-ink-muted font-mono">
            {searchFilter ? 'Tidak ada berkas yang cocok.' : 'Direktori kosong.'}
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <TreeItem
              key={entry.relPath}
              entry={entry}
              repoPath={repoPath}
              level={0}
              onFileClick={handleFileClick}
            />
          ))
        )}
      </div>

      {/* Footer Info / Hint */}
      <div className="p-2 border-t border-border-hairline bg-surface-chrome/60 text-[10px] font-mono text-ink-muted flex items-center justify-between shrink-0">
        <span>Klik berkas untuk salin [[path]]</span>
        {copiedPath && (
          <span className="text-emerald-400 flex items-center gap-1">
            <Check size={10} /> Disalin!
          </span>
        )}
      </div>
    </div>
  )
}
