import React, { useEffect, useMemo, useState } from 'react'
import { FileCode, Link2 } from 'lucide-react'
import { Kbd, cn } from '@renderer/components/ui'
import type { Page, RepoEntry } from '@shared/types/domain'

export interface WikiAutocompleteCandidate {
  id: string
  kind: 'page' | 'code'
  label: string
  sublabel: string
  icon?: string
  insertTarget: string
}

interface WikiAutocompletePopoverProps {
  query: string
  currentPageId: string
  pages: Page[]
  boundRepoPath?: string
  onSelectTarget: (targetText: string) => void
  onClose: () => void
}

export const WikiAutocompletePopover: React.FC<WikiAutocompletePopoverProps> = ({
  query,
  currentPageId,
  pages,
  boundRepoPath,
  onSelectTarget,
  onClose
}) => {
  const [repoFiles, setRepoFiles] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let active = true
    async function loadBoundRepoFiles(): Promise<void> {
      if (!boundRepoPath || !window.noteitAPI?.readRepoDir) {
        setRepoFiles([])
        return
      }
      try {
        const rootEntries: RepoEntry[] = await window.noteitAPI.readRepoDir({
          repoPath: boundRepoPath
        })
        const paths: string[] = []
        for (const entry of rootEntries) {
          if (!entry.isDirectory) {
            paths.push(entry.relPath)
          } else {
            try {
              const subEntries = await window.noteitAPI.readRepoDir({
                repoPath: boundRepoPath,
                relPath: entry.relPath
              })
              for (const sub of subEntries) {
                if (!sub.isDirectory) {
                  paths.push(sub.relPath)
                }
              }
            } catch {
              // ignore subfolder error
            }
          }
        }
        if (active) setRepoFiles(paths.slice(0, 80))
      } catch {
        if (active) setRepoFiles([])
      }
    }
    void loadBoundRepoFiles()
    return () => {
      active = false
    }
  }, [boundRepoPath])

  const candidates = useMemo<WikiAutocompleteCandidate[]>(() => {
    const q = query.trim().toLowerCase()
    const list: WikiAutocompleteCandidate[] = []

    for (const p of pages) {
      if (p.id === currentPageId) continue
      if (
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
      ) {
        list.push({
          id: `page-${p.id}`,
          kind: 'page',
          label: p.title,
          sublabel: p.code,
          icon: p.icon,
          insertTarget: p.title
        })
      }
    }

    for (const relPath of repoFiles) {
      if (!q || relPath.toLowerCase().includes(q)) {
        list.push({
          id: `code-${relPath}`,
          kind: 'code',
          label: relPath,
          sublabel: 'Repo File',
          insertTarget: `${relPath}#L1`
        })
      }
    }

    return list.slice(0, 12)
  }, [query, pages, currentPageId, repoFiles])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  return (
    <div
      role="listbox"
      aria-label="WikiLink autocomplete suggestions"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        } else if (e.key === 'ArrowDown' && candidates.length > 0) {
          e.preventDefault()
          setActiveIndex((prev) => (prev + 1) % candidates.length)
        } else if (e.key === 'ArrowUp' && candidates.length > 0) {
          e.preventDefault()
          setActiveIndex((prev) => (prev - 1 + candidates.length) % candidates.length)
        } else if (e.key === 'Enter' && candidates.length > 0) {
          e.preventDefault()
          const picked = candidates[activeIndex] || candidates[0]
          if (picked) onSelectTarget(picked.insertTarget)
        }
      }}
      className="mt-1.5 p-2 rounded-[10px] bg-surface-elevated border border-border-strong shadow-popover z-30 max-w-md animate-popover-enter select-none"
    >
      <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border-subtle text-[11px] font-medium text-ink-secondary">
        <span className="flex items-center gap-1.5">
          <Link2 size={11.5} className="text-accent-cobalt" aria-hidden="true" />
          <span>
            Link page or repository file {query ? `(“${query}”)` : ''}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close WikiLink autocomplete"
          className="text-ink-muted hover:text-ink-primary"
        >
          <Kbd>Esc</Kbd>
        </button>
      </div>

      {candidates.length === 0 ? (
        <div className="py-2.5 px-2 text-xs text-ink-muted font-mono">
          No matching pages or repository files.
        </div>
      ) : (
        <div className="max-h-52 overflow-y-auto space-y-0.5">
          {candidates.map((cand, idx) => {
            const isSelected = idx === activeIndex
            return (
              <button
                key={cand.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => onSelectTarget(cand.insertTarget)}
                className={cn(
                  'w-full px-2.5 py-1.5 rounded-[7px] text-left text-xs flex items-center justify-between gap-2 transition-colors',
                  isSelected
                    ? 'bg-surface-hover text-ink-primary font-medium'
                    : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                )}
              >
                <span className="flex items-center gap-2 truncate min-w-0">
                  {cand.kind === 'code' ? (
                    <FileCode size={13} className="text-[var(--pill-teal-text)] shrink-0" aria-hidden="true" />
                  ) : (
                    <span className="shrink-0">{cand.icon || '📄'}</span>
                  )}
                  <span className={cn('truncate', cand.kind === 'code' && 'font-mono')}>
                    {cand.label}
                  </span>
                </span>
                <span className="font-mono text-[10px] text-ink-muted shrink-0">
                  {cand.sublabel}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
