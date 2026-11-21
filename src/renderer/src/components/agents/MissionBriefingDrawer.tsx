import React, { useEffect, useState, useMemo } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  FileCode,
  FileText,
  FolderGit2,
  GitBranch,
  Layers,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
  Zap
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { useTerminalStore } from '@renderer/stores/useTerminalStore'
import { Badge, Button, Kbd, cn } from '@renderer/components/ui'
import type {
  DetectedCliPreset,
  DispatchMissionInput,
  Page,
  SpecBundleSummary
} from '@shared/types/domain'

function slugifyTitle(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

interface MissionBriefingDrawerProps {
  page: Page
  isOpen: boolean
  onClose: () => void
}

export const MissionBriefingDrawer: React.FC<MissionBriefingDrawerProps> = ({
  page,
  isOpen,
  onClose
}) => {
  const { notebooks, activeNotebookId, sections, showToast } = useWorkspaceStore()
  const { presets, loadPresets, openDrawer } = useTerminalStore()

  const currentNotebook = notebooks.find((nb) => nb.id === activeNotebookId) || notebooks[0]
  const currentSection = sections.find((s) => s.id === page.sectionId)
  const repoPath = currentSection?.repoPathOverride || currentNotebook?.repoPath || ''

  // Form States
  const [selectedPresetId, setSelectedPresetId] = useState<DispatchMissionInput['presetId']>('claude')
  const [isolationMode, setIsolationMode] = useState<'direct' | 'worktree'>('worktree')
  const [approvalMode, setApprovalMode] = useState<'plan-only' | 'ask-edit' | 'auto-edit'>('ask-edit')
  const [customDirective, setCustomDirective] = useState('')
  const [bundleSummary, setBundleSummary] = useState<SpecBundleSummary | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)

  // Auto-generate suggested branch name
  const suggestedBranch = useMemo(() => {
    const slug = slugifyTitle(page.title) || 'task'
    const codeSlug = page.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return `feat/${codeSlug}-${slug}`.slice(0, 40)
  }, [page.title, page.code])

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  // Pilih preset yang tersedia secara pintar
  useEffect(() => {
    if (presets.length > 0) {
      const claude = presets.find((p) => p.id === 'claude' && p.available)
      const codex = presets.find((p) => p.id === 'codex' && p.available)
      const gemini = presets.find((p) => p.id === 'gemini' && p.available)
      const aider = presets.find((p) => p.id === 'aider' && p.available)

      if (claude) setSelectedPresetId('claude')
      else if (codex) setSelectedPresetId('codex')
      else if (gemini) setSelectedPresetId('gemini')
      else if (aider) setSelectedPresetId('aider')
      else setSelectedPresetId('pwsh')
    }
  }, [presets])

  // Kompilasi bundel spec saat drawer dibuka
  useEffect(() => {
    if (!isOpen || !repoPath) return

    let isMounted = true
    setIsCompiling(true)

    window.noteitAPI
      .compileSpec({ pageId: page.id, targetCwd: repoPath })
      .then((res) => {
        if (isMounted) {
          setBundleSummary(res)
          setIsCompiling(false)
        }
      })
      .catch((err) => {
        console.error('Failed to compile spec bundle:', err)
        if (isMounted) setIsCompiling(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, page.id, repoPath])

  // Keyboard shortcut: Esc tutup, Ctrl+Enter luncurkan
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void handleLaunchMission()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedPresetId, isolationMode, approvalMode, customDirective])

  const handleLaunchMission = async () => {
    if (!repoPath) {
      showToast('Hubungkan folder repositori proyek terlebih dahulu!')
      return
    }

    setIsLaunching(true)
    try {
      const res = await window.noteitAPI.dispatchMission({
        pageId: page.id,
        presetId: selectedPresetId,
        isolationMode,
        approvalMode,
        customDirective: customDirective.trim() || undefined,
        worktreeBranch: isolationMode === 'worktree' ? suggestedBranch : undefined
      })

      if (res.ok) {
        showToast(`Misi ${selectedPresetId.toUpperCase()} diluncurkan di terminal ADE!`)
        openDrawer()
        onClose()
      } else {
        showToast(`Gagal meluncurkan misi: ${res.error || 'Terjadi kesalahan'}`)
      }
    } catch (error) {
      console.error('Failed to dispatch mission:', error)
      showToast('Gagal meluncurkan misi agen.')
    } finally {
      setIsLaunching(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-[3px] transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Command Deck Body */}
      <div className="relative w-full max-w-[540px] h-full bg-canvas-primary border-l border-border-hairline shadow-popover flex flex-col z-10 animate-view-enter text-ink-primary font-sans">
        {/* Header */}
        <div className="px-5 py-4 bg-surface-chrome border-b border-border-hairline flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-[8px] bg-[var(--pill-cobalt-bg)] border border-[var(--pill-cobalt-border)] flex items-center justify-center text-[var(--pill-cobalt-text)] shrink-0">
              <Rocket size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Mission Briefing · Spec Dispatch
              </div>
              <h2 className="font-display font-semibold text-sm text-ink-primary flex items-center gap-1.5 truncate mt-0.5">
                <span>{page.icon}</span>
                <span className="truncate">
                  {page.code} · {page.title}
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Tutup (ESC)"
            className="p-1.5 rounded-[7px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
          {/* Target Repo Banner */}
          <div className="p-3.5 rounded-[10px] bg-surface-elevated border border-border-hairline text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FolderGit2 size={15} className="text-accent-cobalt shrink-0" />
              <div className="min-w-0">
                <div className="text-[10.5px] text-ink-muted">Target repository</div>
                <div className="truncate text-ink-primary font-medium font-mono text-[12px] mt-0.5">
                  {repoPath ? repoPath.split(/[/\\]/).pop() : '(Belum ada repo dihubungkan)'}
                </div>
              </div>
            </div>

            {repoPath ? (
              <Badge tone="teal" size="sm">
                <CheckCircle2 size={11} /> Siap
              </Badge>
            ) : (
              <Badge tone="red" size="sm">
                <AlertCircle size={11} /> Butuh repo
              </Badge>
            )}
          </div>

          {/* Compiled Artifacts Bundle (.noteit/) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-secondary flex items-center gap-1.5">
                <Layers size={13} className="text-accent-amber" />
                <span>Compiled artifacts (.noteit/)</span>
              </span>
              <span className="text-[11px] text-[var(--pill-teal-text)] flex items-center gap-1">
                <ShieldCheck size={12} /> Zero git pollution
              </span>
            </div>

            <div className="p-3 rounded-[10px] bg-surface-chrome/70 border border-border-hairline space-y-2.5">
              {isCompiling ? (
                <div className="py-4 text-center text-xs text-ink-muted animate-pulse">
                  Mengompilasi DBML DDL &amp; blok spesifikasi...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-[8px] bg-surface-elevated border border-border-subtle flex items-center gap-2.5">
                      <FileText size={14} className="text-accent-amber shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono text-[11.5px] text-ink-primary font-medium truncate">
                          active-task.md
                        </div>
                        <div className="text-[10.5px] text-ink-muted">Kontrak PRD &amp; Spec</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-[8px] bg-surface-elevated border border-border-subtle flex items-center gap-2.5">
                      <FileCode size={14} className="text-accent-cobalt shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono text-[11.5px] text-ink-primary font-medium truncate">
                          schema.sql
                        </div>
                        <div className="text-[10.5px] text-ink-muted tabular-nums">
                          {bundleSummary?.dbmlTableCount || 0} Tabel SQLite DDL
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-[8px] bg-surface-elevated border border-border-subtle flex items-center gap-2.5">
                      <Sparkles size={14} className="text-accent-violet shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono text-[11.5px] text-ink-primary font-medium truncate">
                          architecture.mmd
                        </div>
                        <div className="text-[10.5px] text-ink-muted tabular-nums">
                          {bundleSummary?.diagramCount || 0} Diagram Mermaid
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-[8px] bg-surface-elevated border border-border-subtle flex items-center gap-2.5">
                      <CheckCircle2 size={14} className="text-accent-teal shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono text-[11.5px] text-ink-primary font-medium truncate">
                          task-contract.json
                        </div>
                        <div className="text-[10.5px] text-ink-muted tabular-nums">
                          {bundleSummary?.taskCount || 0} Sub-Tasks
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-ink-muted leading-relaxed pt-2 border-t border-border-subtle">
                    Folder <code className="font-mono text-ink-secondary">.noteit/</code> otomatis
                    dikecualikan lewat <code className="font-mono text-ink-secondary">.git/info/exclude</code>.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Preset Selector */}
          <div className="space-y-2">
            <span className="font-medium text-ink-secondary text-xs flex items-center gap-1.5">
              <Zap size={13} className="text-accent-cobalt" />
              <span>CLI agent executor</span>
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {presets.map((p) => {
                const isSelected = selectedPresetId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPresetId(p.id)}
                    className={cn(
                      'p-3 rounded-[9px] border text-left flex flex-col gap-1 transition-all',
                      isSelected
                        ? 'bg-[var(--node-selected-bg)] border-[var(--node-selected-border)] text-ink-primary'
                        : 'bg-surface-elevated border-border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{p.name}</span>
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          p.available ? 'bg-accent-emerald' : 'bg-ink-muted/50'
                        )}
                        title={p.available ? 'Tersedia di PATH' : 'Belum terdeteksi di PATH'}
                      />
                    </div>
                    <span className="font-mono text-[10.5px] text-ink-muted truncate">
                      {p.available ? p.command : 'Belum terpasang'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Isolation & Worktree Mode */}
          <div className="space-y-2">
            <span className="font-medium text-ink-secondary text-xs flex items-center gap-1.5">
              <GitBranch size={13} className="text-accent-teal" />
              <span>Workspace isolation</span>
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsolationMode('worktree')}
                className={cn(
                  'p-3 rounded-[9px] border text-left flex flex-col gap-1 transition-all',
                  isolationMode === 'worktree'
                    ? 'bg-[var(--pill-teal-bg)] border-[var(--pill-teal-border)] text-ink-primary'
                    : 'bg-surface-elevated border-border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Isolated Worktree</span>
                  <Badge tone="teal">Recommended</Badge>
                </div>
                <span className="font-mono text-[10.5px] text-ink-muted truncate">
                  {suggestedBranch}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsolationMode('direct')}
                className={cn(
                  'p-3 rounded-[9px] border text-left flex flex-col gap-1 transition-all',
                  isolationMode === 'direct'
                    ? 'bg-[var(--node-selected-bg)] border-[var(--node-selected-border)] text-ink-primary'
                    : 'bg-surface-elevated border-border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                )}
              >
                <span className="font-medium">Direct Repo</span>
                <span className="text-[11px] text-ink-muted">Bekerja langsung di CWD aktif</span>
              </button>
            </div>
          </div>

          {/* Autonomy Level / Approval Gate */}
          <div className="space-y-2">
            <span className="font-medium text-ink-secondary text-xs flex items-center gap-1.5">
              <Cpu size={13} className="text-accent-violet" />
              <span>Approval gate</span>
            </span>

            <div className="grid grid-cols-3 gap-2 text-xs">
              {(
                [
                  { id: 'plan-only', label: 'Plan-Only', desc: 'Rancang saja' },
                  { id: 'ask-edit', label: 'Ask-Edit', desc: 'Minta konfirmasi' },
                  { id: 'auto-edit', label: 'Auto-Edit', desc: 'Otonom penuh' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setApprovalMode(opt.id)}
                  className={cn(
                    'p-2.5 rounded-[9px] border text-center transition-all',
                    approvalMode === opt.id
                      ? 'bg-[var(--pill-violet-bg)] border-[var(--pill-violet-border)] text-[var(--pill-violet-text)] font-medium'
                      : 'bg-surface-elevated border-border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                  )}
                >
                  <div>{opt.label}</div>
                  <div className="text-[10.5px] text-ink-muted mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Directive Input */}
          <div className="space-y-1.5">
            <label className="font-medium text-ink-secondary text-xs block">
              Arahan tambahan (opsional)
            </label>
            <textarea
              value={customDirective}
              onChange={(e) => setCustomDirective(e.target.value)}
              placeholder="Contoh: Fokus pada pembuatan unit test di Vitest dan pastikan token secret dibaca via env..."
              rows={2}
              className="w-full p-3 rounded-[9px] bg-surface-elevated border border-border-hairline text-xs text-ink-primary placeholder:text-ink-muted focus:border-accent-cobalt resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-surface-chrome border-t border-border-hairline flex items-center justify-between shrink-0">
          <Button variant="ghost" size="md" onClick={onClose}>
            <span>Batal</span>
            <Kbd>Esc</Kbd>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleLaunchMission}
            disabled={isLaunching || !repoPath}
          >
            <Play size={12.5} className="fill-current" />
            <span>{isLaunching ? 'Meluncurkan...' : 'Launch Mission'}</span>
            <Kbd className="bg-white/15 border-white/20 text-white ml-1">Ctrl ↵</Kbd>
          </Button>
        </div>
      </div>
    </div>
  )
}
