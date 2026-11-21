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
  GitCompare,
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
import {
  Badge,
  Button,
  ConfirmModal,
  PromptModal,
  SegmentedControl,
  cn
} from '@renderer/components/ui'
import type { AgentSessionRecord, AgentSessionStatus } from '@shared/types/domain'

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function renderStatusBadge(status: AgentSessionStatus): React.ReactNode {
  switch (status) {
    case 'thinking':
      return (
        <Badge tone="teal" dot pulseDot size="sm">
          Reasoning
        </Badge>
      )
    case 'waiting_approval':
      return (
        <Badge tone="amber" dot pulseDot size="sm">
          Approval required
        </Badge>
      )
    case 'running_tests':
      return (
        <Badge tone="cobalt" dot pulseDot size="sm">
          Running tests
        </Badge>
      )
    case 'completed':
      return (
        <Badge tone="teal" size="sm">
          <Check size={11} />
          <span>Completed</span>
        </Badge>
      )
    case 'merged':
      return (
        <Badge tone="teal" size="sm">
          <GitMerge size={11} />
          <span>Merged</span>
        </Badge>
      )
    case 'failed':
      return (
        <Badge tone="red" size="sm">
          <AlertTriangle size={11} />
          <span>Failed</span>
        </Badge>
      )
    case 'idle':
    default:
      return (
        <Badge tone="neutral" dot size="sm">
          Standby
        </Badge>
      )
  }
}

function renderExecutorBadge(preset: string): React.ReactNode {
  switch (preset.toLowerCase()) {
    case 'claude-code':
      return (
        <Badge tone="amber" size="sm">
          <Bot size={11} />
          <span>Claude Code</span>
        </Badge>
      )
    case 'codex':
      return (
        <Badge tone="teal" size="sm">
          <Sparkles size={11} />
          <span>Codex</span>
        </Badge>
      )
    case 'gemini':
      return (
        <Badge tone="cobalt" size="sm">
          <Radio size={11} />
          <span>Gemini CLI</span>
        </Badge>
      )
    case 'aider':
      return (
        <Badge tone="violet" size="sm">
          <Terminal size={11} />
          <span>Aider</span>
        </Badge>
      )
    default:
      return (
        <Badge tone="neutral" size="sm">
          <Bot size={11} />
          <span>{preset}</span>
        </Badge>
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
  const { openPageInTab, setActiveMainView, activeNotebookId, openCodeInDiffInspector } =
    useWorkspaceStore()

  const [mergingSessionId, setMergingSessionId] = useState<string | null>(null)
  const [discardingSessionId, setDiscardingSessionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState<AgentSessionRecord | null>(null)
  const [discardTarget, setDiscardTarget] = useState<AgentSessionRecord | null>(null)

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

  const handleMerge = (session: AgentSessionRecord): void => {
    setActionError(null)
    setMergeTarget(session)
  }

  const confirmMerge = async (commitMsg: string): Promise<void> => {
    if (!mergeTarget) return
    const session = mergeTarget
    const defaultMsg = `feat(${session.taskCode || 'ADE'}): ${session.title}`

    setMergingSessionId(session.id)
    try {
      const res = await mergeSession(session.id, commitMsg.trim() || defaultMsg)
      if (!res.ok) {
        setActionError(res.error || 'Failed to merge worktree into the main branch.')
      }
    } finally {
      setMergingSessionId(null)
    }
  }

  const handleDiscard = (session: AgentSessionRecord): void => {
    setActionError(null)
    setDiscardTarget(session)
  }

  const confirmDiscard = async (): Promise<void> => {
    if (!discardTarget) return
    const session = discardTarget

    setDiscardingSessionId(session.id)
    try {
      const res = await discardSession(session.id)
      if (!res.ok) {
        setActionError(res.error || 'Failed to discard worktree.')
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
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas-primary text-ink-primary font-sans select-none animate-view-enter">
      {/* Studio Header Bar */}
      <div className="px-6 py-4 border-b border-border-hairline bg-surface-chrome/70 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[10px] bg-[var(--pill-teal-bg)] border border-[var(--pill-teal-border)] flex items-center justify-center text-[var(--pill-teal-text)]">
            <Radio size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[16px] font-semibold tracking-[-0.015em] text-ink-primary">
                Mission Control
              </h1>
              <span className="text-xs text-ink-muted tabular-nums">
                {activeCount} active · {waitingCount} awaiting approval
              </span>
            </div>
            <p className="text-xs text-ink-secondary mt-0.5">
              Real-time CLI agent executors &amp; isolated Git worktrees
            </p>
          </div>
        </div>

        {/* Global Telemetry Summary Pill + Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-3 bg-surface-elevated border border-border-hairline rounded-[8px] px-3 py-1.5 text-xs tabular-nums">
            <span className="flex items-center gap-1.5 text-ink-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald" />
              <span>Active</span>
              <strong className="font-mono text-ink-primary">{activeCount}</strong>
            </span>
            <span className="text-border-hairline">·</span>
            <span className="flex items-center gap-1.5 text-ink-secondary">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  waitingCount > 0 ? 'bg-accent-amber animate-pulse' : 'bg-ink-muted'
                )}
              />
              <span>Approval</span>
              <strong
                className={cn(
                  'font-mono',
                  waitingCount > 0 ? 'text-[var(--pill-amber-text)]' : 'text-ink-primary'
                )}
              >
                {waitingCount}
              </strong>
            </span>
            <span className="text-border-hairline">·</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-ink-muted">{totalFilesChanged} files</span>
              <span className="text-[var(--pill-teal-text)] font-semibold">+{totalLinesAdded}</span>
              <span className="text-[var(--pill-red-text)] font-semibold">-{totalLinesRemoved}</span>
            </span>
          </div>

          <Button
            variant="secondary"
            size="icon"
            onClick={() => void loadSessions(activeNotebookId)}
            title="Refresh sessions"
            aria-label="Refresh sessions"
          >
            <RefreshCw size={13.5} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Filter Segmented Toolbar */}
      <div className="px-6 py-2.5 bg-surface-chrome/40 border-b border-border-hairline flex flex-wrap items-center justify-between gap-3 shrink-0">
        <SegmentedControl<AgentFilter>
          size="sm"
          ariaLabel="Filter agent missions"
          value={activeFilter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All missions', count: sessions.length },
            { value: 'active', label: 'Active', count: activeCount },
            { value: 'waiting', label: 'Approval', count: waitingCount },
            {
              value: 'completed',
              label: 'Completed',
              count: sessions.filter((s) => ['completed', 'merged'].includes(s.status)).length
            },
            {
              value: 'failed',
              label: 'Failed',
              count: sessions.filter((s) => s.status === 'failed').length
            }
          ]}
        />

        {actionError && (
          <Badge tone="red" size="sm" className="gap-2 py-1 px-2.5">
            <AlertTriangle size={12} aria-hidden="true" />
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
              className="ml-1 hover:opacity-75"
            >
              ×
            </button>
          </Badge>
        )}
      </div>

      {/* Mission Cards Grid */}
      <main aria-label="Mission Control" className="flex-1 overflow-y-auto p-6">
        {filteredSessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-16">
            <div className="h-14 w-14 rounded-[14px] bg-surface-elevated border border-border-hairline flex items-center justify-center text-ink-muted mb-4 shadow-card">
              <FolderGit2 size={26} className="opacity-65" />
            </div>
            <h3 className="font-display text-base font-semibold text-ink-primary mb-1">
              {sessions.length === 0 ? 'No active missions yet' : 'No matching missions'}
            </h3>
            <p className="text-xs text-ink-secondary mb-6 leading-relaxed">
              {sessions.length === 0
                ? 'Open your specification document in the Workbench, then click "Dispatch Spec" or press Ctrl+Shift+D to launch an agent.'
                : 'No agent sessions match the current filter.'}
            </p>
            {sessions.length === 0 && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setActiveMainView('workbench')}
              >
                <FileCode2 size={14} aria-hidden="true" />
                <span>Open Specification Workbench</span>
              </Button>
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
                  className={cn(
                    'rounded-[12px] border transition-colors duration-150 bg-surface-elevated flex flex-col justify-between overflow-hidden shadow-card',
                    isWaiting
                      ? 'border-[var(--pill-amber-border)] ring-1 ring-accent-amber/30'
                      : 'border-border-hairline hover:border-border-strong'
                  )}
                >
                  {/* Top Bar of Card */}
                  <div className="p-4 border-b border-border-subtle flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {session.taskCode && (
                          <Badge tone="cobalt" size="sm" className="font-mono">
                            {session.taskCode}
                          </Badge>
                        )}
                        {renderStatusBadge(session.status)}
                        {renderExecutorBadge(session.agentPreset)}
                      </div>

                      <h2 className="font-display font-semibold text-[14px] text-ink-primary truncate">
                        <button
                          type="button"
                          onClick={() => handleNavigateToSpec(session.pageId)}
                          title="Open specification in Workbench"
                          className="w-full text-left hover:text-accent-cobalt transition-colors flex items-center gap-1.5 group truncate rounded-[4px]"
                        >
                          <span className="truncate">{session.title}</span>
                          <ExternalLink
                            size={12}
                            aria-hidden="true"
                            className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity shrink-0 text-accent-cobalt"
                          />
                        </button>
                      </h2>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 font-mono text-[10.5px] text-ink-muted tabular-nums">
                        <Clock size={10.5} />
                        <span>{formatTimeAgo(session.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Branch & Isolation Telemetry */}
                  <div className="px-4 py-2.5 bg-surface-chrome/50 border-b border-border-subtle flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate text-ink-muted font-mono text-[11px]">
                      {isWorktree ? (
                        <>
                          <GitBranch size={12.5} className="text-[var(--pill-teal-text)] shrink-0" />
                          <span className="text-[var(--pill-teal-text)] font-medium">
                            {session.branchName || 'worktree'}
                          </span>
                          <span className="text-[10.5px] text-ink-muted truncate max-w-[200px]">
                            ({session.worktreePath})
                          </span>
                        </>
                      ) : (
                        <>
                          <FolderGit2 size={12.5} className="text-ink-secondary shrink-0" />
                          <span className="text-ink-secondary">direct (main repository)</span>
                        </>
                      )}
                    </div>

                    {/* Diff Stat Counter */}
                    <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] tabular-nums">
                      <span className="text-ink-muted">{session.filesChanged} files</span>
                      <span className="text-[var(--pill-teal-text)] font-medium">
                        +{session.linesAdded}
                      </span>
                      <span className="text-[var(--pill-red-text)] font-medium">
                        -{session.linesRemoved}
                      </span>
                    </div>
                  </div>

                  {/* Monospace Live Tail Box */}
                  <div className="px-4 py-3 bg-canvas-primary/50 flex-1 flex flex-col justify-end">
                    <div className="flex items-center justify-between mb-1.5 text-[10.5px] text-ink-muted">
                      <span className="font-medium uppercase tracking-[0.06em] flex items-center gap-1">
                        <Activity size={10.5} />
                        <span>Output tail</span>
                      </span>
                      <span className="font-mono text-[10px]">
                        Mode: {session.approvalMode}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-[8px] bg-surface-chrome border border-border-subtle font-mono text-[11px] text-ink-secondary min-h-[58px] flex flex-col justify-center overflow-x-auto leading-relaxed">
                      {session.lastOutputTail ? (
                        <pre className="whitespace-pre-wrap break-all text-ink-secondary">
                          {session.lastOutputTail}
                        </pre>
                      ) : (
                        <span className="text-ink-muted italic">
                          Waiting for terminal output...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer Bar */}
                  <div className="px-4 py-3 bg-surface-chrome/65 border-t border-border-subtle flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isWaiting && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleQuickApprove(session.id)}
                        >
                          <Check size={12.5} aria-hidden="true" />
                          <span>Approve (y)</span>
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenTerminal(session)}
                      >
                        <Terminal size={12} className="text-accent-cobalt" aria-hidden="true" />
                        <span>Open Terminal</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          openCodeInDiffInspector({
                            repoPath: session.worktreePath || session.repoPath,
                            relPath: ''
                          })
                        }
                        title="Inspect repository diff in Split Pane"
                      >
                        <GitCompare size={12} className="text-accent-amber" aria-hidden="true" />
                        <span>Review Diff</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isWorktree && session.status !== 'merged' && (
                        <>
                          <button
                            type="button"
                            disabled={isMerging}
                            onClick={() => handleMerge(session)}
                            title="Merge this worktree branch into the main branch"
                            className="h-7 px-2.5 rounded-[7px] bg-[var(--pill-teal-bg)] hover:brightness-110 border border-[var(--pill-teal-border)] text-[var(--pill-teal-text)] text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <GitMerge size={12} />
                            <span>{isMerging ? 'Merging...' : 'Merge to Main'}</span>
                          </button>

                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDiscarding}
                            onClick={() => handleDiscard(session)}
                            title="Discard and delete isolated worktree"
                            aria-label="Discard worktree"
                            className="hover:bg-[var(--pill-red-bg)] hover:text-[var(--pill-red-text)]"
                          >
                            <Trash2 size={12.5} aria-hidden="true" />
                          </Button>
                        </>
                      )}

                      {session.status === 'merged' && (
                        <Badge tone="teal" size="sm">
                          <Check size={11} />
                          <span>Merged</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      <PromptModal
        open={Boolean(mergeTarget)}
        onOpenChange={(open) => {
          if (!open) setMergeTarget(null)
        }}
        title="Merge worktree to main branch"
        description={
          mergeTarget
            ? `Enter a merge commit message for branch [${mergeTarget.branchName || 'worktree'}].`
            : undefined
        }
        label="Merge commit message"
        defaultValue={
          mergeTarget ? `feat(${mergeTarget.taskCode || 'ADE'}): ${mergeTarget.title}` : ''
        }
        confirmLabel="Merge to Main"
        loading={Boolean(mergeTarget && mergingSessionId === mergeTarget.id)}
        onSubmit={confirmMerge}
      />

      <ConfirmModal
        open={Boolean(discardTarget)}
        onOpenChange={(open) => {
          if (!open) setDiscardTarget(null)
        }}
        title="Discard isolated worktree?"
        description={
          discardTarget
            ? `Are you sure you want to discard worktree [${discardTarget.branchName || discardTarget.id}]? All uncommitted changes and the isolated worktree folder will be permanently deleted.`
            : ''
        }
        confirmLabel="Discard worktree"
        variant="danger"
        loading={Boolean(discardTarget && discardingSessionId === discardTarget.id)}
        onConfirm={confirmDiscard}
      />
    </div>
  )
}
