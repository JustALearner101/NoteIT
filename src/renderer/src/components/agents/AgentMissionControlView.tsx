import React, { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  Clock,
  ExternalLink,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitMerge,
  Radio,
  RefreshCw,
  Sparkles,
  Terminal,
  Trash2
} from 'lucide-react'
import { useAgentStore, type AgentFilter } from '@renderer/stores/useAgentStore'
import { useTerminalStore } from '@renderer/stores/useTerminalStore'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import type { AgentSessionRecord, AgentSessionStatus } from '@shared/types/domain'

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${Math.max(1, seconds)}d lalu`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}j lalu`
  return `${Math.floor(hours / 24)}h lalu`
}

function renderStatusBadge(status: AgentSessionStatus): React.ReactNode {
  switch (status) {
    case 'thinking':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          <span>REASONING</span>
        </span>
      )
    case 'waiting_approval':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
          <span>APPROVAL REQUIRED</span>
        </span>
      )
    case 'running_tests':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse inline-block" />
          <span>RUNNING TESTS</span>
        </span>
      )
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wider bg-teal-500/15 text-teal-300 border border-teal-500/30">
          <Check size={11} className="text-teal-400" />
          <span>COMPLETED</span>
        </span>
      )
    case 'merged':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          <GitMerge size={11} className="text-emerald-400" />
          <span>MERGED TO MAIN</span>
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <AlertTriangle size={11} className="text-rose-400" />
          <span>FAILED</span>
        </span>
      )
    case 'idle':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[11px] text-ink-muted bg-surface-elevated border border-border-hairline">
          <span className="w-1.5 h-1.5 rounded-full bg-ink-muted inline-block" />
          <span>STANDBY</span>
        </span>
      )
  }
}

function renderExecutorBadge(preset: string): React.ReactNode {
  switch (preset.toLowerCase()) {
    case 'claude-code':
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
          <Bot size={11} className="text-amber-400" />
          <span>Claude Code</span>
        </span>
      )
    case 'codex':
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
          <Sparkles size={11} className="text-emerald-400" />
          <span>Codex</span>
        </span>
      )
    case 'gemini':
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
          <Radio size={11} className="text-blue-400" />
          <span>Gemini CLI</span>
        </span>
      )
    case 'aider':
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
          <Terminal size={11} className="text-purple-400" />
          <span>Aider</span>
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-secondary bg-surface-elevated border border-border-hairline px-2 py-0.5 rounded">
          <Bot size={11} />
          <span>{preset}</span>
        </span>
      )
  }
}

export const AgentMissionControlView: React.FC = () => {
  const {
    sessions,
    activeFilter,
    isLoading,
    loadSessions,
    mergeSession,
    discardSession,
    quickApprove,
    setFilter,
    initListener
  } = useAgentStore()

  const { ensureSessionTab } = useTerminalStore()
  const { openPageInTab, setActiveMainView, activeNotebookId } = useWorkspaceStore()

  const [mergingSessionId, setMergingSessionId] = useState<string | null>(null)
  const [discardingSessionId, setDiscardingSessionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    loadSessions(activeNotebookId)
    const cleanup = initListener()
    return cleanup
  }, [activeNotebookId, loadSessions, initListener])

  // Filtered Sessions
  const filteredSessions = sessions.filter((s) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'active') return ['thinking', 'running_tests', 'idle'].includes(s.status)
    if (activeFilter === 'waiting') return s.status === 'waiting_approval'
    if (activeFilter === 'completed') return ['completed', 'merged'].includes(s.status)
    if (activeFilter === 'failed') return s.status === 'failed'
    return true
  })

  // Telemetry Aggregations
  const activeCount = sessions.filter((s) =>
    ['thinking', 'running_tests', 'idle'].includes(s.status)
  ).length
  const waitingCount = sessions.filter((s) => s.status === 'waiting_approval').length
  const totalFilesChanged = sessions.reduce((acc, s) => acc + (s.filesChanged || 0), 0)
  const totalLinesAdded = sessions.reduce((acc, s) => acc + (s.linesAdded || 0), 0)
  const totalLinesRemoved = sessions.reduce((acc, s) => acc + (s.linesRemoved || 0), 0)

  const handleOpenTerminal = (session: AgentSessionRecord): void => {
    ensureSessionTab({
      id: session.id,
      title: session.title,
      taskCode: session.taskCode,
      agentPreset: session.agentPreset,
      worktreePath: session.worktreePath,
      repoPath: session.repoPath,
      status: session.status === 'merged' ? 'completed' : session.status,
      lastOutputTail: session.lastOutputTail
    })
  }

  const handleQuickApprove = async (sessionId: string): Promise<void> => {
    await quickApprove(sessionId)
  }

  const handleMerge = async (session: AgentSessionRecord): Promise<void> => {
    setActionError(null)
    const defaultMsg = `feat(${session.taskCode || 'ADE'}): ${session.title}`
    const commitMsg = window.prompt(
      `Masukkan pesan commit merge untuk cabang [${session.branchName || 'worktree'}]:`,
      defaultMsg
    )
    if (commitMsg === null) return // Canceled

    setMergingSessionId(session.id)
    try {
      const res = await mergeSession(session.id, commitMsg.trim() || defaultMsg)
      if (!res.ok) {
        setActionError(res.error || 'Gagal menggabungkan worktree ke cabang utama.')
      }
    } finally {
      setMergingSessionId(null)
    }
  }

  const handleDiscard = async (session: AgentSessionRecord): Promise<void> => {
    setActionError(null)
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin membuang worktree [${session.branchName || session.id}]?\n\nSemua perubahan yang belum di-commit dan folder worktree terisolasi akan dihapus secara permanen.`
    )
    if (!confirmed) return

    setDiscardingSessionId(session.id)
    try {
      const res = await discardSession(session.id)
      if (!res.ok) {
        setActionError(res.error || 'Gagal membuang worktree.')
      }
    } finally {
      setDiscardingSessionId(null)
    }
  }

  const handleNavigateToSpec = (pageId: string | null | undefined): void => {
    if (!pageId) return
    openPageInTab(pageId)
    setActiveMainView('workbench')
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0A0D12] text-ink-primary font-sans select-none">
      {/* HUD Header Bar */}
      <header className="px-6 py-4 border-b border-border-hairline/80 bg-[#0E1218]/90 backdrop-blur flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-500/10">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-sm font-bold tracking-wider uppercase text-ink-primary">
                AGENT MISSION CONTROL
              </h1>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border-hairline text-ink-muted">
                v2.0 HUD
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Monitoring Real-Time Agen Eksekutor & Smart Git Worktree Sibling
            </p>
          </div>
        </div>

        {/* Global Telemetry Chips */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#141922] border border-border-hairline rounded-lg px-3 py-1.5 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-ink-secondary">ACTIVE:</span>
              <span className="font-bold text-ink-primary">{activeCount}</span>
            </div>
            <span className="text-border-hairline">|</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${waitingCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-ink-muted'}`}
              />
              <span className="text-ink-secondary">AWAITING APPROVAL:</span>
              <span
                className={`font-bold ${waitingCount > 0 ? 'text-amber-300' : 'text-ink-primary'}`}
              >
                {waitingCount}
              </span>
            </div>
            <span className="text-border-hairline">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-ink-secondary">DELTA:</span>
              <span className="text-ink-muted">{totalFilesChanged} files</span>
              <span className="text-emerald-400 font-bold">+{totalLinesAdded}</span>
              <span className="text-rose-400 font-bold">-{totalLinesRemoved}</span>
            </div>
          </div>

          <button
            onClick={() => void loadSessions(activeNotebookId)}
            title="Refresh Data Sesi"
            className="h-8 w-8 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border-hairline flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Filter Segmented Control & Status Message */}
      <div className="px-6 py-2.5 bg-[#0C1016] border-b border-border-hairline/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 font-mono text-xs">
          {(
            [
              { id: 'all', label: 'ALL MISSIONS', count: sessions.length },
              { id: 'active', label: 'ACTIVE', count: activeCount },
              { id: 'waiting', label: 'APPROVAL REQUIRED', count: waitingCount },
              {
                id: 'completed',
                label: 'COMPLETED & MERGED',
                count: sessions.filter((s) => ['completed', 'merged'].includes(s.status)).length
              },
              {
                id: 'failed',
                label: 'FAILED',
                count: sessions.filter((s) => s.status === 'failed').length
              }
            ] as const
          ).map((filter) => {
            const active = activeFilter === filter.id
            return (
              <button
                key={filter.id}
                onClick={() => setFilter(filter.id as AgentFilter)}
                className={`px-3 py-1 rounded-[5px] border transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-accent-cobalt text-white border-accent-cobalt font-medium shadow-sm'
                    : 'bg-[#12161E] text-ink-muted hover:text-ink-secondary border-border-hairline/60 hover:border-border-hairline'
                }`}
              >
                <span>{filter.label}</span>
                <span className="text-[10px] opacity-75 font-bold">({filter.count})</span>
              </button>
            )
          })}
        </div>

        {actionError && (
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs">
            <AlertTriangle size={13} />
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-2 hover:text-white">
              ×
            </button>
          </div>
        )}
      </div>

      {/* Mission Cards Grid */}
      <main className="flex-1 overflow-y-auto p-6">
        {filteredSessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-16">
            <div className="h-16 w-16 rounded-2xl bg-surface-elevated/60 border border-border-hairline flex items-center justify-center text-ink-muted mb-4 shadow-inner">
              <FolderGit2 size={32} className="opacity-50" />
            </div>
            <h3 className="font-mono text-base font-bold text-ink-primary tracking-wide uppercase mb-1">
              {sessions.length === 0 ? 'TIDAK ADA MISI AKTIF' : 'TIDAK ADA HASIL FILTER'}
            </h3>
            <p className="text-xs text-ink-muted mb-6 leading-relaxed">
              {sessions.length === 0
                ? 'Belum ada misi agen yang diluncurkan. Buka dokumen spesifikasi Anda di Workbench, lalu klik tombol "Dispatch Spec" atau tekan Ctrl+Shift+D untuk meluncurkan agen.'
                : 'Tidak ada sesi agen yang sesuai dengan kriteria filter saat ini.'}
            </p>
            {sessions.length === 0 && (
              <button
                onClick={() => setActiveMainView('workbench')}
                className="px-4 py-2 rounded-lg bg-accent-cobalt hover:bg-accent-cobalt/90 text-white font-mono text-xs font-semibold flex items-center gap-2 shadow-md transition-colors"
              >
                <FileCode2 size={14} />
                <span>Buka Workbench Spesifikasi</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredSessions.map((session) => {
              const isWorktree = session.isolationMode === 'worktree'
              const isMerging = mergingSessionId === session.id
              const isDiscarding = discardingSessionId === session.id
              const isWaiting = session.status === 'waiting_approval'

              return (
                <article
                  key={session.id}
                  className={`rounded-xl border transition-all duration-200 bg-[#0F131A] flex flex-col justify-between overflow-hidden ${
                    isWaiting
                      ? 'border-amber-500/50 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                      : 'border-border-hairline hover:border-ink-muted/60'
                  }`}
                >
                  {/* Top Bar of Card */}
                  <div className="p-4 border-b border-border-hairline/60 bg-[#12161E]/80 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {session.taskCode && (
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-accent-cobalt/20 text-accent-cobalt border border-accent-cobalt/30">
                            {session.taskCode}
                          </span>
                        )}
                        {renderStatusBadge(session.status)}
                        {renderExecutorBadge(session.agentPreset)}
                      </div>

                      <h2
                        onClick={() => handleNavigateToSpec(session.pageId)}
                        title="Klik untuk membuka spesifikasi di Workbench"
                        className="font-medium text-sm text-ink-primary hover:text-accent-cobalt transition-colors truncate cursor-pointer flex items-center gap-1.5 group"
                      >
                        <span className="truncate">{session.title}</span>
                        <ExternalLink
                          size={12}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-accent-cobalt"
                        />
                      </h2>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 font-mono text-[10px] text-ink-muted">
                        <Clock size={10} />
                        <span>{formatTimeAgo(session.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Branch & Isolation Telemetry */}
                  <div className="px-4 py-2.5 bg-[#0D1017] border-b border-border-hairline/40 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 truncate text-ink-muted">
                      {isWorktree ? (
                        <>
                          <GitBranch size={13} className="text-accent-teal shrink-0" />
                          <span className="text-accent-teal font-semibold">
                            {session.branchName || 'worktree'}
                          </span>
                          <span className="text-[10px] text-ink-muted truncate max-w-[220px]">
                            ({session.worktreePath})
                          </span>
                        </>
                      ) : (
                        <>
                          <FolderGit2 size={13} className="text-ink-secondary shrink-0" />
                          <span className="text-ink-secondary">direct (main repository)</span>
                        </>
                      )}
                    </div>

                    {/* Diff Stat Counter */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-ink-muted">{session.filesChanged} file diubah</span>
                      <span className="text-emerald-400 font-bold">+{session.linesAdded}</span>
                      <span className="text-rose-400 font-bold">-{session.linesRemoved}</span>
                    </div>
                  </div>

                  {/* Monospace Live Tail Box */}
                  <div className="px-4 py-3 bg-[#080A0E] flex-1 flex flex-col justify-end">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[10px] tracking-wider uppercase text-ink-muted flex items-center gap-1">
                        <Activity size={10} />
                        <span>TERMINAL OUTPUT TAIL</span>
                      </span>
                      <span className="font-mono text-[10px] text-ink-muted">
                        APPROVAL: {session.approvalMode.toUpperCase()}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#050608] border border-border-hairline/50 font-mono text-[11px] text-ink-secondary min-h-[58px] flex flex-col justify-center overflow-x-auto leading-relaxed">
                      {session.lastOutputTail ? (
                        <pre className="whitespace-pre-wrap break-all text-ink-secondary">
                          {session.lastOutputTail}
                        </pre>
                      ) : (
                        <span className="text-ink-muted italic">
                          Menunggu data keluaran dari terminal...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer Bar */}
                  <div className="p-3 bg-[#11151D] border-t border-border-hairline/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Quick Approve Button for interactive waiting */}
                      {isWaiting && (
                        <button
                          onClick={() => handleQuickApprove(session.id)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all animate-bounce"
                        >
                          <Check size={13} className="stroke-[3]" />
                          <span>Approve (y)</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenTerminal(session)}
                        className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-ink-primary font-mono text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Terminal size={12} className="text-accent-cobalt" />
                        <span>Buka Terminal</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Worktree Merge & Discard Actions */}
                      {isWorktree && session.status !== 'merged' && (
                        <>
                          <button
                            disabled={isMerging}
                            onClick={() => handleMerge(session)}
                            title="Gabungkan hasil kerja worktree ini ke cabang utama"
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <GitMerge size={12} />
                            <span>{isMerging ? 'Merging...' : 'Merge to Main'}</span>
                          </button>

                          <button
                            disabled={isDiscarding}
                            onClick={() => handleDiscard(session)}
                            title="Batalkan & hapus direktori worktree terisolasi secara aman"
                            className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300 border border-border-hairline text-ink-muted font-mono text-xs transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}

                      {session.status === 'merged' && (
                        <span className="font-mono text-xs text-emerald-400 flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <Check size={12} />
                          <span>Merged</span>
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
