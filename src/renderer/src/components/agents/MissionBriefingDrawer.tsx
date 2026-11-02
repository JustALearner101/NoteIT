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
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Command Deck Body */}
      <div className="relative w-full max-w-[540px] h-full bg-[#111317] border-l border-border-hairline shadow-2xl flex flex-col z-10 animate-slide-left text-ink-primary font-sans">
        {/* Header HUD */}
        <div className="p-4 bg-[#14171E] border-b border-border-hairline flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[6px] bg-accent-cobalt/15 border border-accent-cobalt/30 flex items-center justify-center text-accent-cobalt">
              <Rocket size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-wider uppercase text-accent-cobalt font-bold">
                  MISSION BRIEFING
                </span>
                <span className="text-[10px] text-ink-muted">·</span>
                <span className="font-mono text-[10px] text-ink-muted">SPEC-TO-AGENT DISPATCH</span>
              </div>
              <h2 className="font-semibold text-sm text-ink-primary flex items-center gap-1.5 truncate max-w-[340px]">
                <span className="text-base">{page.icon}</span>
                <span>{page.code} · {page.title}</span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Tutup (ESC)"
            className="p-1.5 rounded-[5px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* Target Repo Banner */}
          <div className="p-3 rounded-[6px] bg-[#181B22] border border-border-hairline text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FolderGit2 size={15} className="text-accent-cobalt shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-ink-muted uppercase">Target Repository</div>
                <div className="truncate text-ink-primary font-medium">
                  {repoPath ? repoPath.split(/[/\\]/).pop() : '(Belum ada repo dihubungkan)'}
                </div>
              </div>
            </div>

            {repoPath ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] flex items-center gap-1 shrink-0">
                <CheckCircle2 size={11} /> Siap
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] flex items-center gap-1 shrink-0">
                <AlertCircle size={11} /> Butuh Repo
              </span>
            )}
          </div>

          {/* Compiled Artifacts Bundle (.noteit/) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-semibold text-ink-secondary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Layers size={13} className="text-accent-amber" />
                <span>Kompilasi Artefak (.noteit/)</span>
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck size={11} /> Zero Git Pollution
              </span>
            </div>

            <div className="p-2.5 rounded-[6px] bg-[#14171E] border border-border-hairline space-y-2">
              {isCompiling ? (
                <div className="py-4 text-center text-xs text-ink-muted font-mono animate-pulse">
                  Mengompilasi DBML DDL & blok spesifikasi...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-[#181B22] border border-border-hairline/60 flex items-center gap-2">
                      <FileText size={14} className="text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-ink-primary font-medium truncate">active-task.md</div>
                        <div className="text-[10px] text-ink-muted">Kontrak PRD & Spec</div>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-[#181B22] border border-border-hairline/60 flex items-center gap-2">
                      <FileCode size={14} className="text-accent-cobalt shrink-0" />
                      <div className="min-w-0">
                        <div className="text-ink-primary font-medium truncate">schema.sql</div>
                        <div className="text-[10px] text-ink-muted">
                          {bundleSummary?.dbmlTableCount || 0} Tabel SQLite DDL
                        </div>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-[#181B22] border border-border-hairline/60 flex items-center gap-2">
                      <Sparkles size={14} className="text-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-ink-primary font-medium truncate">architecture.mmd</div>
                        <div className="text-[10px] text-ink-muted">
                          {bundleSummary?.diagramCount || 0} Diagram Mermaid
                        </div>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-[#181B22] border border-border-hairline/60 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-ink-primary font-medium truncate">task-contract.json</div>
                        <div className="text-[10px] text-ink-muted">
                          {bundleSummary?.taskCount || 0} Sub-Tasks
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-ink-muted font-mono leading-relaxed pt-1 border-t border-border-hairline/40">
                    Folder <code>.noteit/</code> otomatis dikecualikan secara lokal lewat <code>.git/info/exclude</code>, aman dari pencemaran git commit tim.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Preset Selector */}
          <div className="space-y-1.5">
            <span className="font-semibold text-ink-secondary uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
              <Zap size={13} className="text-accent-cobalt" />
              <span>Eksekutor / CLI Agent Preset</span>
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {presets.map((p) => {
                const isSelected = selectedPresetId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPresetId(p.id)}
                    className={`p-2.5 rounded-[6px] border text-left flex flex-col gap-1 transition-all ${
                      isSelected
                        ? 'bg-accent-cobalt/15 border-accent-cobalt text-ink-primary shadow-sm'
                        : 'bg-[#181B22] border-border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold">{p.name}</span>
                      {p.available ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Tersedia di PATH" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-ink-muted" title="Belum terdeteksi di PATH" />
                      )}
                    </div>
                    <span className="text-[10px] text-ink-muted truncate">
                      {p.available ? `Command: ${p.command}` : 'Belum terpasang'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Isolation & Worktree Mode */}
          <div className="space-y-1.5">
            <span className="font-semibold text-ink-secondary uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
              <GitBranch size={13} className="text-emerald-400" />
              <span>Isolasi Eksekusi & Workspace</span>
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => setIsolationMode('worktree')}
                className={`p-2.5 rounded-[6px] border text-left flex flex-col gap-1 transition-all ${
                  isolationMode === 'worktree'
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-ink-primary'
                    : 'bg-[#181B22] border-border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Isolated Worktree</span>
                  <span className="text-[10px] text-emerald-400">Rekomendasi</span>
                </div>
                <span className="text-[10px] text-ink-muted truncate">
                  Branch: {suggestedBranch}
                </span>
              </button>

              <button
                onClick={() => setIsolationMode('direct')}
                className={`p-2.5 rounded-[6px] border text-left flex flex-col gap-1 transition-all ${
                  isolationMode === 'direct'
                    ? 'bg-accent-cobalt/15 border-accent-cobalt text-ink-primary'
                    : 'bg-[#181B22] border-border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                }`}
              >
                <span className="font-semibold">Direct Repo</span>
                <span className="text-[10px] text-ink-muted">
                  Bekerja langsung di CWD aktif
                </span>
              </button>
            </div>
          </div>

          {/* Autonomy Level / Approval Gate */}
          <div className="space-y-1.5">
            <span className="font-semibold text-ink-secondary uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
              <Cpu size={13} className="text-purple-400" />
              <span>Tingkat Otonomi (Approval Gate)</span>
            </span>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              {(
                [
                  { id: 'plan-only', label: 'Plan-Only', desc: 'Rancang saja' },
                  { id: 'ask-edit', label: 'Ask-Edit', desc: 'Minta konfirmasi' },
                  { id: 'auto-edit', label: 'Auto-Edit', desc: 'Otonom penuh' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setApprovalMode(opt.id)}
                  className={`p-2 rounded-[5px] border text-center transition-all ${
                    approvalMode === opt.id
                      ? 'bg-purple-500/15 border-purple-500/60 text-purple-300 font-semibold'
                      : 'bg-[#181B22] border-border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-hover'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-[10px] text-ink-muted">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Directive Input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-ink-secondary uppercase tracking-wider text-[11px] font-mono">
              Arahan Tambahan (Opsional)
            </label>
            <textarea
              value={customDirective}
              onChange={(e) => setCustomDirective(e.target.value)}
              placeholder="Contoh: Fokus pada pembuatan unit test di Vitest dan pastikan token secret dibaca via env..."
              rows={2}
              className="w-full p-2.5 rounded-[6px] bg-[#181B22] border border-border-hairline text-xs font-mono text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent-cobalt resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-[#14171E] border-t border-border-hairline flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-[5px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary text-xs font-mono"
          >
            Batal (ESC)
          </button>

          <button
            onClick={handleLaunchMission}
            disabled={isLaunching || !repoPath}
            className="px-4 py-2 rounded-[5px] bg-accent-cobalt hover:bg-accent-cobalt/90 text-white font-medium text-xs font-mono flex items-center gap-2 shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={13} className="fill-current" />
            <span>{isLaunching ? 'Meluncurkan Misi...' : 'LAUNCH MISSION (Ctrl+Enter)'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
