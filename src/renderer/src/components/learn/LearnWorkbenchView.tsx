import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  GraduationCap,
  HelpCircle,
  Loader2,
  MessageSquare,
  Network,
  Plus,
  Sparkles,
  Trash2,
  X
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { Badge, Button, cn } from '@renderer/components/ui'
import type {
  LearnPhase,
  LearnSession,
  LearnSideThread,
  LearnTurn
} from '@shared/types/domain'
import { KnowledgeGraphView } from './KnowledgeGraphView'
import { LearnMarkdown, MermaidDiagramPreview } from './LearnMarkdown'

const PHASES: Array<{ id: LearnPhase; label: string; step: number }> = [
  { id: 'probe', label: '1. Measure', step: 1 },
  { id: 'plan', label: '2. Plan', step: 2 },
  { id: 'teach', label: '3. Teach', step: 3 },
  { id: 'practice', label: '4. Practice', step: 4 }
]

const CONFIDENCE_LABELS: Record<number, string> = {
  1: '1 Guessed',
  2: '2 Fuzzy',
  3: '3 Partial',
  4: '4 Likely',
  5: '5 Solid'
}

export const LearnWorkbenchView: React.FC = () => {
  const {
    pages,
    sections,
    preferences,
    pendingLearnSeed,
    clearPendingLearnSeed,
    loadWorkspace,
    openPageInTab,
    setActiveMainView,
    showToast
  } = useWorkspaceStore()

  const [activeTab, setActiveTab] = useState<'session' | 'graph'>('session')
  const [sessions, setSessions] = useState<LearnSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<LearnSession | null>(null)
  const [turns, setTurns] = useState<LearnTurn[]>([])
  const [sideThreads, setSideThreads] = useState<LearnSideThread[]>([])
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false)

  // Live provider status surfaced in topbar
  const [lastProviderLabel, setLastProviderLabel] = useState<string>('')
  const [lastUsedLiveProvider, setLastUsedLiveProvider] = useState<boolean | null>(null)

  // New session form
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [newKind, setNewKind] = useState<'teach' | 'practice'>('teach')
  const [newSourcePageId, setNewSourcePageId] = useState('')
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [newSourceExcerpt, setNewSourceExcerpt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Active turn composer (Answer + Think Out Loud + Confidence 1..5)
  const [answerText, setAnswerText] = useState('')
  const [thinkingText, setThinkingText] = useState('')
  const [confidence, setConfidence] = useState<number>(3)

  // Right dock (Dependency Plan SVG + Side Questions)
  const [isSideOpen, setIsSideOpen] = useState(true)
  const [sideQuote, setSideQuote] = useState('')
  const [sideAnchorTurnId, setSideAnchorTurnId] = useState('')
  const [sideQuestionInput, setSideQuestionInput] = useState('')
  const [isAskingSide, setIsAskingSide] = useState(false)

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const providerOverrides = {
    providerOverride: preferences.aiProvider,
    profileIdOverride: preferences.aiProfileId,
    modelIdOverride: preferences.aiModel
  }

  const refreshSessions = useCallback(async () => {
    try {
      const list = await window.noteitAPI.listLearnSessions()
      setSessions(list)
      if (!activeSessionId && list[0]) {
        setActiveSessionId(list[0].id)
      }
    } catch {
      // ignore in test env
    }
  }, [activeSessionId])

  const loadSessionDetail = useCallback(async (id: string) => {
    const detail = await window.noteitAPI.getLearnSession(id)
    if (detail) {
      setActiveSession(detail.session)
      setTurns(detail.turns)
      setSideThreads(detail.sideThreads)
      const lastAssistant = [...detail.turns].reverse().find((t) => t.role === 'assistant')
      if (lastAssistant?.metadata?.providerLabel) {
        setLastProviderLabel(String(lastAssistant.metadata.providerLabel))
      }
      if (typeof lastAssistant?.metadata?.usedLiveProvider === 'boolean') {
        setLastUsedLiveProvider(lastAssistant.metadata.usedLiveProvider)
      }
    }
  }, [])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    if (activeSessionId) {
      void loadSessionDetail(activeSessionId)
    }
  }, [activeSessionId, loadSessionDetail])

  // Auto-scroll transcript to newest turn
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns.length, isSubmitting])

  // Auto-open New Session form when launched from Web Workbench ("Learn This Page") or SpecHeader
  useEffect(() => {
    if (!pendingLearnSeed) return
    setActiveTab('session')
    setIsCreating(true)
    setNewTitle(pendingLearnSeed.title)
    setNewGoal(pendingLearnSeed.goal || `Master ${pendingLearnSeed.title}`)
    setNewSourcePageId(pendingLearnSeed.pageId || '')
    setNewSourceUrl(pendingLearnSeed.url || '')
    setNewSourceExcerpt(pendingLearnSeed.contentExcerpt || '')
    clearPendingLearnSeed()
  }, [pendingLearnSeed, clearPendingLearnSeed])

  const handleCreateSession = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newGoal.trim()) return
    setIsSubmitting(true)
    try {
      const created = await window.noteitAPI.createLearnSession({
        title: newTitle.trim() || newGoal.trim().slice(0, 48),
        goal: newGoal.trim(),
        kind: newKind,
        sourcePageIds: newSourcePageId ? [newSourcePageId] : [],
        sourceUrl: newSourceUrl || undefined,
        sourceExcerpt: newSourceExcerpt || undefined,
        ...providerOverrides
      })
      setIsCreating(false)
      setNewTitle('')
      setNewGoal('')
      setNewSourcePageId('')
      setNewSourceUrl('')
      setNewSourceExcerpt('')
      await refreshSessions()
      setActiveSessionId(created.session.id)
      setActiveSession(created.session)
      setTurns(created.turns)
      setSideThreads([])
      setLastProviderLabel(created.providerLabel)
      setLastUsedLiveProvider(created.usedLiveProvider)
      showToast(`Started learning session "${created.session.title}"`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitResponse = async (
    requestedPhase?: LearnPhase,
    overrideAnswer?: string
  ): Promise<void> => {
    const text = (overrideAnswer ?? answerText).trim()
    if (!activeSession || !text || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await window.noteitAPI.submitLearnResponse({
        sessionId: activeSession.id,
        answer: text,
        thinkingText: overrideAnswer ? undefined : thinkingText.trim() || undefined,
        confidence,
        requestedPhase,
        ...providerOverrides
      })
      setActiveSession(res.session)
      setTurns(res.turns)
      setLastProviderLabel(res.providerLabel)
      setLastUsedLiveProvider(res.usedLiveProvider)
      if (!overrideAnswer) {
        setAnswerText('')
        setThinkingText('')
      }
      await refreshSessions()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAskSide = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!activeSession || !sideQuestionInput.trim() || isAskingSide) return
    setIsAskingSide(true)
    try {
      await window.noteitAPI.askLearnSideQuestion({
        sessionId: activeSession.id,
        anchorTurnId: sideAnchorTurnId || undefined,
        selectedQuote: sideQuote || undefined,
        question: sideQuestionInput.trim(),
        ...providerOverrides
      })
      setSideQuestionInput('')
      await loadSessionDetail(activeSession.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(msg, 'error')
    } finally {
      setIsAskingSide(false)
    }
  }

  const handleExtractToKG = async (): Promise<void> => {
    if (!activeSession) return
    try {
      const res = await window.noteitAPI.extractKnowledgeGraph({ sessionId: activeSession.id })
      showToast(
        `Extracted ${res.addedPropositions} proposition(s) & ${res.addedChains} chain(s) to Knowledge Graph`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(msg, 'error')
    }
  }

  const handleCrystallizeToPage = async (): Promise<void> => {
    if (!activeSession) return
    const page = await window.noteitAPI.crystallizeLearnSessionToPage({
      sessionId: activeSession.id,
      sectionId: sections[0]?.id
    })
    await loadWorkspace()
    openPageInTab(page.id)
    setActiveMainView('workbench')
    showToast(`Crystallized lesson into NoteIT page "${page.title}"`)
  }

  const handleDeleteSession = async (id: string): Promise<void> => {
    await window.noteitAPI.deleteLearnSession(id)
    if (activeSessionId === id) {
      setActiveSessionId(null)
      setActiveSession(null)
      setTurns([])
      setSideThreads([])
    }
    await refreshSessions()
    showToast('Learning session deleted')
  }

  const activeProviderBadgeText =
    lastUsedLiveProvider === false
      ? 'Offline Fallback · Configure Provider →'
      : lastProviderLabel || `${preferences.aiProvider} · ${preferences.aiModel || 'default'}`

  return (
    <main
      aria-label="Learn Workbench"
      className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas-primary animate-view-enter"
    >
      {/* Top Bar (with compact Session Switcher replacing the 3rd sidebar!) */}
      <div className="h-[42px] px-4 bg-surface-chrome border-b border-border-hairline flex items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap size={15} className="text-[var(--marker-teal)] shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-ink-primary shrink-0">Learn</span>

          {/* Compact Session Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSessionMenuOpen((v) => !v)}
              className="h-7 px-2.5 rounded-[7px] bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5 max-w-[210px] transition-colors"
            >
              <span className="truncate">
                {activeSession ? activeSession.title : `Sessions (${sessions.length})`}
              </span>
              <ChevronDown size={12} className="text-ink-muted shrink-0" />
            </button>

            {isSessionMenuOpen && (
              <div className="absolute left-0 top-9 z-40 w-72 rounded-xl bg-surface-elevated border border-border-hairline shadow-popover p-1.5 space-y-1 animate-popover-enter max-h-80 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-ink-muted flex items-center justify-between">
                  <span>Lessons ({sessions.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSessionMenuOpen(false)
                      setActiveTab('session')
                      setIsCreating(true)
                    }}
                    className="text-accent-cobalt hover:underline"
                  >
                    + New
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <div className="px-2.5 py-2 text-xs text-ink-muted">No lessons yet.</div>
                ) : (
                  sessions.map((s) => {
                    const isCur = s.id === activeSessionId
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setIsCreating(false)
                          setActiveTab('session')
                          setActiveSessionId(s.id)
                          setIsSessionMenuOpen(false)
                        }}
                        className={cn(
                          'group px-2.5 py-1.5 rounded-[7px] cursor-pointer flex items-center justify-between gap-2 transition-colors',
                          isCur
                            ? 'bg-surface-hover text-ink-primary font-medium'
                            : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                        )}
                      >
                        <div className="min-w-0">
                          <div className="text-xs truncate">{s.title}</div>
                          <div className="text-[10px] font-mono text-ink-muted">{s.phase}</div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete ${s.title}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDeleteSession(s.id)
                          }}
                          className="opacity-0 group-hover:opacity-80 hover:text-accent-rose p-1"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          <div className="h-3.5 w-[1px] bg-border-hairline mx-0.5 shrink-0" />

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('session')}
              className={cn(
                'px-2.5 py-1 rounded-[7px] text-xs flex items-center gap-1.5 transition-colors',
                activeTab === 'session'
                  ? 'bg-surface-elevated border border-border-hairline text-ink-primary font-medium'
                  : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
              )}
            >
              <BookOpen size={12} />
              <span>Session</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('graph')}
              className={cn(
                'px-2.5 py-1 rounded-[7px] text-xs flex items-center gap-1.5 transition-colors',
                activeTab === 'graph'
                  ? 'bg-surface-elevated border border-border-hairline text-ink-primary font-medium'
                  : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
              )}
            >
              <Network size={12} />
              <span>Knowledge Graph</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Active Provider / Offline Warning Pill */}
          <button
            type="button"
            onClick={() => setActiveMainView('settings', 'ai-providers')}
            title="Click to switch CLI bridge, custom endpoint, or API key"
            className={cn(
              'hidden lg:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] border text-[11px] font-mono transition-colors max-w-[230px]',
              lastUsedLiveProvider === false
                ? 'bg-[var(--pill-amber-bg)] border-[var(--pill-amber-border)] text-[var(--pill-amber-text)]'
                : 'bg-surface-elevated border-border-hairline text-ink-secondary hover:text-ink-primary'
            )}
          >
            {lastUsedLiveProvider === false ? (
              <AlertCircle size={11} className="shrink-0" />
            ) : (
              <Sparkles size={11} className="text-accent-cobalt shrink-0" />
            )}
            <span className="truncate">{activeProviderBadgeText}</span>
          </button>

          {activeTab === 'session' && activeSession && (
            <>
              <Button variant="secondary" size="xs" onClick={() => void handleExtractToKG()}>
                <Network size={11.5} className="text-[var(--marker-teal)]" />
                <span className="hidden sm:inline">Extract to KG</span>
              </Button>
              <Button variant="secondary" size="xs" onClick={() => void handleCrystallizeToPage()}>
                <FilePlus2 size={11.5} className="text-[var(--marker-cobalt)]" />
                <span className="hidden md:inline">Crystallize</span>
              </Button>
            </>
          )}
          <Button
            variant="primary"
            size="xs"
            onClick={() => {
              setActiveTab('session')
              setIsCreating(true)
            }}
          >
            <Plus size={12} />
            <span>New Lesson</span>
          </Button>
        </div>
      </div>

      {activeTab === 'graph' ? (
        <KnowledgeGraphView
          onOpenSession={(sid) => {
            setActiveSessionId(sid)
            setActiveTab('session')
          }}
        />
      ) : (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {isCreating || !activeSession ? (
            <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
              <form
                onSubmit={(e) => void handleCreateSession(e)}
                className="w-full max-w-xl p-6 rounded-2xl bg-surface-elevated border border-border-hairline space-y-4 shadow-card"
              >
                <div className="flex items-center gap-2">
                  <GraduationCap size={18} className="text-[var(--marker-teal)]" />
                  <h2 className="font-display text-base font-bold text-ink-primary">
                    Start a New Learning Session
                  </h2>
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  NoteIT maps your current intuition first, builds a live Mermaid dependency plan,
                  teaches one reasoning step at a time, and extracts propositions into your
                  Knowledge Graph.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                      Topic / Session Title
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Go Concurrency: Channels & Select"
                      className="w-full px-3 py-2 rounded-lg bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus:border-accent-cobalt"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                      What do you want to understand deeply? *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      placeholder="e.g. Understand goroutine scheduling, unbuffered vs buffered channels, and how to avoid deadlocks."
                      className="w-full px-3 py-2 rounded-lg bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus:border-accent-cobalt"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                        Session Mode
                      </label>
                      <select
                        value={newKind}
                        onChange={(e) => setNewKind(e.target.value as 'teach' | 'practice')}
                        className="w-full px-3 py-2 rounded-lg bg-surface-chrome border border-border-hairline text-xs text-ink-primary"
                      >
                        <option value="teach">Full Teaching (Measure → Plan → Teach → Practice)</option>
                        <option value="practice">Practice Only (Transfer Problems)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                        Attach NoteIT Page (Optional)
                      </label>
                      <select
                        value={newSourcePageId}
                        onChange={(e) => setNewSourcePageId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-chrome border border-border-hairline text-xs text-ink-primary"
                      >
                        <option value="">None (from scratch)</option>
                        {pages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} · {p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {newSourceUrl && (
                    <div className="text-[11px] font-mono text-accent-cobalt bg-surface-chrome px-3 py-1.5 rounded border border-border-hairline truncate">
                      Web source attached: {newSourceUrl}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  {activeSession && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreating(false)}>
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
                    <Sparkles size={12} />
                    <span>Begin Measure Phase</span>
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Phase Stepper Bar */}
              <div className="px-4 py-2 bg-surface-chrome/60 border-b border-border-hairline flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {PHASES.map((ph) => {
                    const active = activeSession.phase === ph.id
                    return (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => {
                          if (active || isSubmitting) return
                          void handleSubmitResponse(
                            ph.id,
                            answerText.trim() || `Move to the ${ph.label} phase.`
                          )
                        }}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 transition-colors',
                          active
                            ? 'bg-[var(--pill-teal-bg)] text-[var(--pill-teal-text)] border border-[var(--pill-teal-border)]'
                            : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary hover:bg-surface-hover border border-border-subtle'
                        )}
                      >
                        {active && <CheckCircle2 size={11} />}
                        <span>{ph.label}</span>
                      </button>
                    )
                  })}
                </div>

                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setIsSideOpen((v) => !v)}
                >
                  <HelpCircle size={12} />
                  <span>Plan &amp; Side ({sideThreads.length})</span>
                </Button>
              </div>

              {/* Transcript + Right Plan SVG & Side Questions Dock */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className="max-w-3xl mx-auto space-y-4">
                      {turns.map((turn, idx) => {
                        const isLatest = idx === turns.length - 1
                        return (
                          <div
                            key={turn.id}
                            className={cn(
                              'p-4 rounded-xl border space-y-2.5',
                              turn.role === 'user'
                                ? 'bg-surface-chrome border-border-subtle ml-12'
                                : 'bg-surface-elevated border-border-hairline mr-4'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                                  {turn.role === 'user' ? 'YOU' : 'TUTOR'}
                                </span>
                                <Badge tone={turn.role === 'user' ? 'cobalt' : 'teal'} size="sm">
                                  {turn.role === 'user' ? turn.phase : turn.cardKind}
                                </Badge>
                                {turn.confidence !== null && (
                                  <Badge tone="amber" size="sm">
                                    {CONFIDENCE_LABELS[turn.confidence] || `Confidence ${turn.confidence}/5`}
                                  </Badge>
                                )}
                              </div>
                              {turn.role === 'assistant' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sel = window.getSelection?.()?.toString().trim() || ''
                                    setSideAnchorTurnId(turn.id)
                                    setSideQuote(sel || turn.content.slice(0, 120))
                                    setIsSideOpen(true)
                                  }}
                                  className="text-[11px] text-ink-muted hover:text-accent-cobalt flex items-center gap-1"
                                >
                                  <MessageSquare size={11} />
                                  <span>Ask side question</span>
                                </button>
                              )}
                            </div>

                            <LearnMarkdown content={turn.content} />

                            {turn.thinkingText && (
                              <div className="p-2.5 rounded-lg bg-surface-elevated/60 border border-border-subtle text-[11.5px] text-ink-secondary">
                                <span className="font-mono text-[10px] uppercase text-accent-amber mr-1.5">
                                  Think out loud:
                                </span>
                                {turn.thinkingText}
                              </div>
                            )}

                            {/* Contextual next-step CTA on latest Plan or Teach turn */}
                            {isLatest && turn.role === 'assistant' && !isSubmitting && (
                              <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center gap-2">
                                {activeSession.phase === 'plan' && (
                                  <Button
                                    variant="primary"
                                    size="xs"
                                    onClick={() =>
                                      void handleSubmitResponse(
                                        'teach',
                                        'Plan looks great — let us begin Step N1.'
                                      )
                                    }
                                  >
                                    <span>Approve Plan &amp; Start Step N1</span>
                                    <ArrowRight size={11} />
                                  </Button>
                                )}
                                {activeSession.phase === 'teach' && (
                                  <Button
                                    variant="secondary"
                                    size="xs"
                                    onClick={() =>
                                      void handleSubmitResponse(
                                        'practice',
                                        'I am ready for a transfer practice problem.'
                                      )
                                    }
                                  >
                                    <span>Jump to Practice</span>
                                    <ArrowRight size={11} />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {isSubmitting && (
                        <div className="p-4 rounded-xl bg-surface-elevated/70 border border-border-hairline mr-4 flex items-center gap-2.5 text-xs text-ink-secondary">
                          <Loader2 size={14} className="animate-spin text-[var(--marker-teal)]" />
                          <span>Tutor is analyzing your reasoning...</span>
                        </div>
                      )}
                      <div ref={transcriptEndRef} />
                    </div>
                  </div>

                  {/* Interactive Composer: Answer + Think Out Loud + Labeled Confidence */}
                  <div className="p-3 bg-surface-chrome border-t border-border-hairline shrink-0">
                    <div className="max-w-3xl mx-auto space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <textarea
                          rows={2}
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault()
                              void handleSubmitResponse()
                            }
                          }}
                          placeholder="Your answer or prediction (Ctrl+Enter to submit)..."
                          className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border-hairline text-xs text-ink-primary focus:border-accent-cobalt"
                        />
                        <textarea
                          rows={2}
                          value={thinkingText}
                          onChange={(e) => setThinkingText(e.target.value)}
                          placeholder="Think out loud (optional): explain your reasoning, doubts, or intuition..."
                          className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border-hairline text-xs text-ink-secondary focus:border-accent-amber"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[11px] text-ink-muted mr-1">Confidence:</span>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              title={CONFIDENCE_LABELS[n]}
                              onClick={() => setConfidence(n)}
                              className={cn(
                                'px-2 h-6 rounded text-[10.5px] font-mono border transition-colors',
                                confidence === n
                                  ? 'bg-[var(--pill-amber-bg)] text-[var(--pill-amber-text)] border-[var(--pill-amber-border)] font-semibold'
                                  : 'bg-surface-elevated border-border-hairline text-ink-secondary hover:bg-surface-hover'
                              )}
                            >
                              {confidence === n ? CONFIDENCE_LABELS[n] : n}
                            </button>
                          ))}
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          loading={isSubmitting}
                          disabled={!answerText.trim()}
                          onClick={() => void handleSubmitResponse()}
                        >
                          <ArrowUp size={12} />
                          <span>Send Response</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Dock: Live Rendered Mermaid Dependency Plan + Side Questions */}
                {isSideOpen && (
                  <aside className="w-[340px] shrink-0 bg-surface-chrome border-l border-border-hairline flex flex-col overflow-hidden">
                    {activeSession.planMermaid && (
                      <div className="p-3 border-b border-border-hairline space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[var(--marker-teal)]">
                            Dependency Plan
                          </span>
                          <Badge tone="cobalt" size="sm">
                            Node: {activeSession.activeNodeId || 'N1'}
                          </Badge>
                        </div>
                        <MermaidDiagramPreview code={activeSession.planMermaid} compact />
                      </div>
                    )}

                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
                        <span className="text-xs font-medium text-ink-primary">Side Questions</span>
                        <button
                          type="button"
                          onClick={() => setIsSideOpen(false)}
                          className="text-ink-muted hover:text-ink-primary"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {sideThreads.length === 0 ? (
                          <div className="text-[11.5px] text-ink-muted leading-relaxed">
                            Highlight any sentence in the lesson and click{' '}
                            <strong className="text-ink-secondary">Ask side question</strong> to get
                            a quick clarification without interrupting the main step.
                          </div>
                        ) : (
                          sideThreads.map((st) => (
                            <div
                              key={st.id}
                              className="p-2.5 rounded-lg bg-surface-elevated border border-border-subtle space-y-2"
                            >
                              {st.selectedQuote && (
                                <div className="text-[10px] italic text-ink-muted border-l-2 border-accent-cobalt pl-2 line-clamp-2">
                                  &ldquo;{st.selectedQuote}&rdquo;
                                </div>
                              )}
                              {st.messages.map((m) => (
                                <div
                                  key={m.id}
                                  className={cn(
                                    'text-[11.5px] leading-snug',
                                    m.role === 'user'
                                      ? 'text-accent-cobalt font-medium'
                                      : 'text-ink-primary'
                                  )}
                                >
                                  {m.role === 'assistant' ? (
                                    <LearnMarkdown content={m.content} />
                                  ) : (
                                    m.content
                                  )}
                                </div>
                              ))}
                            </div>
                          ))
                        )}
                      </div>

                      <form
                        onSubmit={(e) => void handleAskSide(e)}
                        className="p-2.5 border-t border-border-subtle flex gap-1.5"
                      >
                        <input
                          type="text"
                          value={sideQuestionInput}
                          onChange={(e) => setSideQuestionInput(e.target.value)}
                          placeholder="Ask a quick side question..."
                          className="flex-1 h-7 px-2 rounded bg-surface-elevated border border-border-hairline text-xs text-ink-primary"
                        />
                        <Button
                          type="submit"
                          variant="primary"
                          size="xs"
                          loading={isAskingSide}
                          disabled={!sideQuestionInput.trim()}
                        >
                          Ask
                        </Button>
                      </form>
                    </div>
                  </aside>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  )
}
