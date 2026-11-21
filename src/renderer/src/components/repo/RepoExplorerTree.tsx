import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  RefreshCw,
  Search,
  Unlink
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Badge, Button, cn } from '@renderer/components/ui'
import type { GitFileStatus, RepoEntry, RepoGitStatusSummary } from '@shared/types/domain'

interface TreeItemProps {
  entry: RepoEntry
  repoPath: string
  level: number
  selectedPath: string | null
  focusedPath: string | null
  treeRef: React.RefObject<HTMLUListElement | null>
  onSelectPath: (relPath: string) => void
  onFocusPath: (relPath: string) => void
  onFileClick?: (entry: RepoEntry) => void
}

const GitBadge: React.FC<{ status?: GitFileStatus }> = ({ status }) => {
  if (!status) return null

  switch (status) {
    case 'modified':
      return (
        <Badge tone="amber" title="Modified" className="font-mono text-[9.5px] px-1 py-[1px]">
          M
        </Badge>
      )
    case 'added':
      return (
        <Badge tone="teal" title="Added" className="font-mono text-[9.5px] px-1 py-[1px]">
          A
        </Badge>
      )
    case 'untracked':
      return (
        <Badge tone="cobalt" title="Untracked" className="font-mono text-[9.5px] px-1 py-[1px]">
          ?
        </Badge>
      )
    case 'deleted':
      return (
        <Badge tone="red" title="Deleted" className="font-mono text-[9.5px] px-1 py-[1px]">
          D
        </Badge>
      )
    default:
      return null
  }
}

const TreeItem: React.FC<TreeItemProps> = ({
  entry,
  repoPath,
  level,
  selectedPath,
  focusedPath,
  treeRef,
  onSelectPath,
  onFocusPath,
  onFileClick
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [children, setChildren] = useState<RepoEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const isSelected = selectedPath === entry.relPath
  const isFocused = focusedPath === entry.relPath

  const loadChildrenAndExpand = async (): Promise<void> => {
    if (!entry.isDirectory) return
    if (children.length === 0) {
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
    setIsOpen(true)
  }

  const toggleNode = async (): Promise<void> => {
    onFocusPath(entry.relPath)
    onSelectPath(entry.relPath)

    if (!entry.isDirectory) {
      onFileClick?.(entry)
      return
    }

    if (!isOpen) {
      await loadChildrenAndExpand()
    } else {
      setIsOpen(false)
    }
  }

  const handleRowClick = (e: React.MouseEvent<HTMLLIElement>): void => {
    e.stopPropagation()
    e.currentTarget.focus()
    void toggleNode()
  }

  const focusTreeItemEl = (el: HTMLElement | null | undefined): void => {
    if (!el) return
    const rel = el.getAttribute('data-rel-path')
    if (rel) onFocusPath(rel)
    el.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLLIElement>): void => {
    e.stopPropagation()
    const visibleItems = Array.from(
      treeRef.current?.querySelectorAll<HTMLLIElement>('[role="treeitem"]') ?? []
    )
    const currentIdx = visibleItems.indexOf(e.currentTarget)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (currentIdx >= 0 && currentIdx + 1 < visibleItems.length) {
        focusTreeItemEl(visibleItems[currentIdx + 1])
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (currentIdx > 0) {
        focusTreeItemEl(visibleItems[currentIdx - 1])
      }
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusTreeItemEl(visibleItems[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      focusTreeItemEl(visibleItems[visibleItems.length - 1])
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (!entry.isDirectory) return
      if (!isOpen) {
        void loadChildrenAndExpand()
      } else {
        const firstChild = e.currentTarget.querySelector<HTMLLIElement>(
          ':scope > ul[role="group"] > li[role="treeitem"]'
        )
        focusTreeItemEl(firstChild)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (entry.isDirectory && isOpen) {
        setIsOpen(false)
      } else {
        const parentItem = e.currentTarget.parentElement?.closest<HTMLLIElement>('[role="treeitem"]')
        focusTreeItemEl(parentItem)
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      void toggleNode()
    }
  }

  const paddingLeft = `${level * 14 + 6}px`

  return (
    <li
      role="treeitem"
      aria-expanded={entry.isDirectory ? isOpen : undefined}
      aria-selected={isSelected}
      aria-level={level + 1}
      tabIndex={isFocused ? 0 : -1}
      data-rel-path={entry.relPath}
      onClick={handleRowClick}
      onFocus={(e) => {
        e.stopPropagation()
        onFocusPath(entry.relPath)
      }}
      onKeyDown={handleKeyDown}
      className="outline-none focus-visible:ring-1 focus-visible:ring-accent-cobalt rounded-[3px]"
    >
      <div
        style={{ paddingLeft }}
        className={cn(
          'group h-6 pr-2 rounded-[3px] flex items-center justify-between text-xs cursor-pointer select-none transition-colors',
          isSelected && 'bg-surface-hover text-ink-primary',
          entry.isDirectory
            ? 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary font-medium'
            : 'text-ink-muted hover:bg-surface-hover/80 hover:text-ink-primary font-mono'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {entry.isDirectory ? (
            <span className="text-ink-muted shrink-0" aria-hidden="true">
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          ) : (
            <span className="w-3 shrink-0" aria-hidden="true" />
          )}

          {entry.isDirectory ? (
            isOpen ? (
              <FolderOpen size={13} className="text-accent-cobalt shrink-0" aria-hidden="true" />
            ) : (
              <Folder size={13} className="text-ink-muted shrink-0" aria-hidden="true" />
            )
          ) : entry.name.endsWith('.md') ? (
            <FileText size={13} className="text-amber-400/80 shrink-0" aria-hidden="true" />
          ) : (
            <FileCode size={13} className="text-ink-muted shrink-0" aria-hidden="true" />
          )}

          <span className="truncate">{entry.name}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <GitBadge status={entry.gitStatus} />
        </div>
      </div>

      {/* Directory Children */}
      {isOpen && entry.isDirectory && (
        <ul role="group">
          {isLoading ? (
            <li
              role="none"
              style={{ paddingLeft: `${(level + 1) * 14 + 6}px` }}
              className="text-[11px] text-ink-muted py-1 font-mono"
            >
              Loading...
            </li>
          ) : children.length === 0 ? (
            <li
              role="none"
              style={{ paddingLeft: `${(level + 1) * 14 + 6}px` }}
              className="text-[11px] text-ink-muted py-0.5 font-mono italic opacity-60"
            >
              (empty)
            </li>
          ) : (
            children.map((child) => (
              <TreeItem
                key={child.relPath}
                entry={child}
                repoPath={repoPath}
                level={level + 1}
                selectedPath={selectedPath}
                focusedPath={focusedPath}
                treeRef={treeRef}
                onSelectPath={onSelectPath}
                onFocusPath={onFocusPath}
                onFileClick={onFileClick}
              />
            ))
          )}
        </ul>
      )}
    </li>
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
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const treeRef = useRef<HTMLUListElement>(null)

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
      showToast('Failed to load repository contents.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (repoPath) {
      void loadRepoData(repoPath)
    } else {
      setRootEntries([])
      setGitStatus(null)
    }
  }, [repoPath])

  const handlePickRepo = async () => {
    if (!currentNotebook) return
    const res = await window.noteitAPI.pickRepoFolder(repoPath || undefined)
    if (!res.canceled && res.path) {
      await updateNotebookRepo(currentNotebook.id, res.path, res.branch)
      void loadRepoData(res.path)
    }
  }

  const handleUnlinkRepo = async () => {
    if (!currentNotebook) return
    await updateNotebookRepo(currentNotebook.id, null)
    setRootEntries([])
    setGitStatus(null)
  }

  const handleFileClick = (entry: RepoEntry) => {
    const wikiRef = `[[${entry.relPath}]]`
    void navigator.clipboard.writeText(wikiRef)
    setCopiedPath(entry.relPath)
    showToast(`Copied ${wikiRef} to clipboard!`)
    setTimeout(() => setCopiedPath(null), 2000)
  }

  const filteredEntries = useMemo(() => {
    if (!searchFilter.trim()) return rootEntries
    const q = searchFilter.toLowerCase()
    return rootEntries.filter((e) => e.name.toLowerCase().includes(q))
  }, [rootEntries, searchFilter])

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setFocusedPath(null)
      return
    }
    setFocusedPath((prev) => {
      if (!prev) return filteredEntries[0].relPath
      if (filteredEntries.some((entry) => entry.relPath === prev)) return prev
      const treeItems = Array.from(
        treeRef.current?.querySelectorAll<HTMLLIElement>('[role="treeitem"]') ?? []
      )
      if (treeItems.some((el) => el.getAttribute('data-rel-path') === prev)) {
        return prev
      }
      return filteredEntries[0].relPath
    })
  }, [filteredEntries])

  if (!repoPath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-canvas-primary animate-view-enter">
        <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border-hairline flex items-center justify-center text-ink-muted mb-3 shadow-sm">
          <GitBranch size={22} className="text-accent-cobalt" aria-hidden="true" />
        </div>
        <h3 className="font-semibold text-ink-primary text-sm mb-1">Connect Project Repository</h3>
        <p className="text-xs text-ink-secondary max-w-[280px] mb-4">
          Bind a local git folder to Notebook <strong>{currentNotebook?.name}</strong> to enable
          file tree exploration, branch status, and ADE terminal context.
        </p>
        <Button variant="primary" size="md" onClick={handlePickRepo}>
          <FolderPlus size={14} aria-hidden="true" />
          <span>Choose Repository Folder</span>
        </Button>
      </div>
    )
  }

  const folderName = repoPath.split(/[/\\]/).pop()

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-canvas-primary border-l border-border-hairline select-none overflow-hidden animate-view-enter">
      {/* Header Info Repo */}
      <div className="p-3 bg-surface-chrome border-b border-border-hairline flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch size={13.5} className="text-accent-cobalt shrink-0" aria-hidden="true" />
            <span className="font-semibold text-xs text-ink-primary truncate font-mono">
              {folderName}
            </span>
            {gitStatus?.branch && (
              <Badge tone="cobalt" className="font-mono text-[10px]">
                {gitStatus.branch}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => void loadRepoData(repoPath)}
              title="Refresh repository status and files"
              aria-label="Refresh repository status and files"
              disabled={isLoading}
              className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary disabled:opacity-40 transition-colors"
            >
              <RefreshCw
                size={12}
                aria-hidden="true"
                className={isLoading ? 'animate-spin' : ''}
              />
            </button>
            <button
              type="button"
              onClick={() => void handleUnlinkRepo()}
              title="Unlink repository from notebook"
              aria-label="Unlink repository from notebook"
              className="p-1 rounded-[6px] hover:bg-[var(--pill-red-bg)] text-ink-muted hover:text-[var(--pill-red-text)] transition-colors"
            >
              <Unlink size={12} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Git Telemetry Strip */}
        {gitStatus && (
          <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-[7px] bg-surface-elevated border border-border-hairline">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${
                  gitStatus.isClean ? 'bg-accent-emerald' : 'bg-accent-amber animate-pulse'
                }`}
              />
              <span
                className={
                  gitStatus.isClean ? 'text-ink-secondary' : 'text-[var(--pill-amber-text)] font-medium'
                }
              >
                {gitStatus.isClean
                  ? 'Working tree clean'
                  : `${gitStatus.changedFiles.length} modified files`}
              </span>
            </div>

            {(gitStatus.linesAdded > 0 || gitStatus.linesRemoved > 0) && (
              <div className="flex items-center gap-1.5 font-mono text-[10.5px] tabular-nums">
                <span className="text-[var(--pill-teal-text)]">+{gitStatus.linesAdded}</span>
                <span className="text-[var(--pill-red-text)]">-{gitStatus.linesRemoved}</span>
              </div>
            )}
          </div>
        )}

        {/* Search Input Filter */}
        <div className="relative">
          <Search
            size={12}
            aria-hidden="true"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="text"
            aria-label="Filter repository files"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter repository files..."
            className="w-full h-7 pl-7 pr-2.5 rounded-[7px] bg-surface-elevated border border-border-hairline text-ink-primary placeholder:text-ink-muted text-xs focus:border-accent-cobalt"
          />
        </div>
      </div>

      {/* Directory Tree Scroll View */}
      <div className="flex-1 overflow-y-auto p-1.5 no-scrollbar">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-xs text-ink-muted font-mono">
            {searchFilter ? 'No matching files.' : 'Empty directory.'}
          </div>
        ) : (
          <ul
            ref={treeRef}
            role="tree"
            aria-label={`Repository files for ${folderName || 'repository'}`}
            className="space-y-0.5"
          >
            {filteredEntries.map((entry) => (
              <TreeItem
                key={entry.relPath}
                entry={entry}
                repoPath={repoPath}
                level={0}
                selectedPath={selectedPath}
                focusedPath={focusedPath}
                treeRef={treeRef}
                onSelectPath={setSelectedPath}
                onFocusPath={setFocusedPath}
                onFileClick={handleFileClick}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer Info / Hint */}
      <div className="p-2 border-t border-border-hairline bg-surface-chrome/60 text-[10px] font-mono text-ink-muted flex items-center justify-between shrink-0">
        <span>Click file to copy [[path]]</span>
        {copiedPath && (
          <span className="text-emerald-400 flex items-center gap-1">
            <Check size={10} aria-hidden="true" /> Copied!
          </span>
        )}
      </div>
    </div>
  )
}
