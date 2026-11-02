import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  FilePlus2,
  FileText,
  Globe,
  Hand,
  MessageSquarePlus,
  Plus,
  Sparkles,
  Terminal,
  Trash2,
  X
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import type { AIApprovalProposal, AIChatStreamEvent } from '@shared/ipc-channels'
import type { Page } from '@shared/types/domain'

interface ToolCallBadge {
  toolName: string
  argsSummary: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  providerLabel?: string
  toolCalls?: ToolCallBadge[]
  proposals?: AIApprovalProposal[]
  mentionedPages?: { id: string; code: string; title: string }[]
  browserContext?: { url: string; title: string } | null
  createdAt: number
}

interface ChatSession {
  id: string
  title: string
  mode: string
  messages: ChatMessage[]
  updatedAt: number
}

const CHAT_MODES = [
  'Free chat',
  'Spec Architect',
  'DBML Schema Co-Pilot',
  'Mermaid & DOT Diagrammer'
]

const MODEL_OPTIONS = [
  'Default (recommended) · High',
  'Gemini 2.5 Flash · Fast',
  'Claude Sonnet · High',
  'Ollama Local · Offline'
]

const APPROVAL_MODES = [
  { id: 'ask', label: 'Ask for approval' },
  { id: 'auto-edit', label: 'Auto-insert to page' },
  { id: 'plan-only', label: 'Plan & discuss only' }
] as const

const STARTER_PROMPTS = [
  {
    label: 'Generate DBML schema',
    prompt: 'Buatkan rancangan skema DBML relasional untuk modul autentikasi & sesi browser.'
  },
  {
    label: 'Draft Mermaid flowchart',
    prompt: 'Buatkan diagram alur Mermaid untuk sinkronisasi offline-first SQLite WAL & AI SDK.'
  },
  {
    label: 'Review spesifikasi aktif',
    prompt: 'Ringkas poin arsitektur utama dan ajukan blok spesifikasi baru untuk halaman aktif.'
  }
]

export const AIChatView: React.FC = () => {
  const {
    pages,
    sections,
    activeNotebookId,
    activePageId,
    updatePage,
    createPage,
    openPageInTab,
    loadWorkspace,
    preferences,
    updatePreferences,
    browserContextForAI,
    setBrowserContextForAI,
    setActiveMainView,
    showToast
  } = useWorkspaceStore()

  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 'session-default',
      title: 'Sesi Free Chat Baru',
      mode: 'Free chat',
      messages: [],
      updatedAt: Date.now()
    }
  ])
  const [activeSessionId, setActiveSessionId] = useState('session-default')
  const [chatMode, setChatMode] = useState('Free chat')
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false)
  const [isApprovalMenuOpen, setIsApprovalMenuOpen] = useState(false)
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const [isMentionMenuOpen, setIsMentionMenuOpen] = useState(false)

  const [promptText, setPromptText] = useState('')
  const [mentionedPageIds, setMentionedPageIds] = useState<string[]>([])
  const [isStreamingReply, setIsStreamingReply] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeRequestMap = useRef<Record<string, { sessionId: string; assistantMsgId: string }>>({})

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  )

  const mentionedPages = useMemo(
    () => pages.filter((p) => mentionedPageIds.includes(p.id)),
    [pages, mentionedPageIds]
  )

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) || pages[0],
    [pages, activePageId]
  )

  // Langganan stream dari Vercel AI SDK di Main Process
  useEffect(() => {
    if (!window.noteitAPI?.onAIChatStreamEvent) return
    return window.noteitAPI.onAIChatStreamEvent((event: AIChatStreamEvent) => {
      const target = activeRequestMap.current[event.requestId]
      if (!target) return

      if (event.type === 'text-delta') {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === target.sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === target.assistantMsgId
                      ? { ...m, content: m.content + event.textDelta }
                      : m
                  )
                }
              : s
          )
        )
      } else if (event.type === 'tool-call') {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === target.sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === target.assistantMsgId
                      ? {
                          ...m,
                          toolCalls: [
                            ...(m.toolCalls || []),
                            { toolName: event.toolName, argsSummary: event.argsSummary }
                          ]
                        }
                      : m
                  )
                }
              : s
          )
        )
      } else if (event.type === 'approval-request' || event.type === 'auto-applied') {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === target.sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === target.assistantMsgId
                      ? {
                          ...m,
                          proposals: [...(m.proposals || []), event.proposal]
                        }
                      : m
                  )
                }
              : s
          )
        )
        if (event.type === 'auto-applied') {
          void loadWorkspace()
          showToast(
            `Auto-insert: ${event.proposal.blocks.length} blok ditambahkan ke ${event.proposal.targetPageCode}`
          )
        }
      } else if (event.type === 'done') {
        setIsStreamingReply(false)
        setSessions((prev) =>
          prev.map((s) =>
            s.id === target.sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === target.assistantMsgId
                      ? {
                          ...m,
                          isStreaming: false,
                          providerLabel: event.providerLabel
                        }
                      : m
                  )
                }
              : s
          )
        )
      } else if (event.type === 'error') {
        setIsStreamingReply(false)
        setSessions((prev) =>
          prev.map((s) =>
            s.id === target.sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === target.assistantMsgId
                      ? {
                          ...m,
                          isStreaming: false,
                          content: m.content + `\n\n[Error: ${event.error}]`
                        }
                      : m
                  )
                }
              : s
          )
        )
      }
    })
  }, [loadWorkspace, showToast])

  const handleNewSession = (): void => {
    const newId = `session-${Date.now()}`
    const next: ChatSession = {
      id: newId,
      title: 'Sesi Free Chat Baru',
      mode: chatMode,
      messages: [],
      updatedAt: Date.now()
    }
    setSessions((prev) => [next, ...prev])
    setActiveSessionId(newId)
    setPromptText('')
    setMentionedPageIds([])
  }

  const handleToggleMentionPage = (pageId: string): void => {
    setMentionedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    )
    setIsMentionMenuOpen(false)
    textareaRef.current?.focus()
  }

  const handleSendMessage = async (customPrompt?: string): Promise<void> => {
    const text = (customPrompt ?? promptText).trim()
    if (!text || isStreamingReply) return

    const requestId = `req-${Date.now()}`
    const userMsgId = `msg-u-${Date.now()}`
    const assistantMsgId = `msg-a-${Date.now() + 1}`

    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      mentionedPages: mentionedPages.map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title
      })),
      browserContext: browserContextForAI
        ? { url: browserContextForAI.url, title: browserContextForAI.title }
        : null,
      createdAt: Date.now()
    }

    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
      proposals: [],
      createdAt: Date.now() + 1
    }

    const historyForSdk = [
      ...activeSession.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text }
    ]

    activeRequestMap.current[requestId] = {
      sessionId: activeSession.id,
      assistantMsgId
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title: s.messages.length === 0 ? text.slice(0, 42) : s.title,
              messages: [...s.messages, userMsg, assistantPlaceholder],
              updatedAt: Date.now()
            }
          : s
      )
    )
    setPromptText('')
    setIsStreamingReply(true)

    await window.noteitAPI.startAIChatStream({
      requestId,
      provider: preferences.aiProvider,
      modelId: preferences.aiModel,
      apiKey: preferences.aiApiKeyMasked,
      approvalMode: preferences.aiApprovalMode,
      chatMode,
      messages: historyForSdk,
      mentionedPageIds,
      activePageId: activePage?.id,
      browserContext: browserContextForAI
    })
  }

  const handleApproveProposal = async (
    messageId: string,
    proposal: AIApprovalProposal
  ): Promise<void> => {
    const targetPage =
      pages.find((p) => p.id === proposal.targetPageId) || activePage
    if (!targetPage) {
      showToast('Halaman target tidak ditemukan')
      return
    }

    const appendedBlocks = [
      ...targetPage.blocks,
      ...proposal.blocks.map((b, idx) => ({
        id: `blk-approved-${Date.now()}-${idx}`,
        type: b.type,
        content: b.content
      }))
    ]
    await updatePage({ id: targetPage.id, blocks: appendedBlocks })

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      proposals: m.proposals?.map((p) =>
                        p.proposalId === proposal.proposalId
                          ? { ...p, status: 'approved' }
                          : p
                      )
                    }
                  : m
              )
            }
          : s
      )
    )
    showToast(`Disetujui: ${proposal.blocks.length} blok ditambahkan ke ${targetPage.code}`)
  }

  const handleRejectProposal = (messageId: string, proposalId: string): void => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              messages: s.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      proposals: m.proposals?.map((p) =>
                        p.proposalId === proposalId ? { ...p, status: 'rejected' } : p
                      )
                    }
                  : m
              )
            }
          : s
      )
    )
    showToast('Usulan perubahan blok ditolak')
  }

  const handleCreateSpecFromMessage = async (msg: ChatMessage): Promise<void> => {
    const targetSec =
      sections.find((s) => s.notebookId === activeNotebookId) || sections[0]
    if (!targetSec) return
    const firstProposal = msg.proposals?.[0]
    const created = await createPage({
      sectionId: targetSec.id,
      title: `AI Spec · ${activeSession.title.slice(0, 28)}`,
      template:
        firstProposal?.blocks.some((b) => b.type === 'dbml') ? 'dbml' : 'blank'
    })
    const blocks: Page['blocks'] = [
      {
        id: `blk-${Date.now()}`,
        type: 'paragraph',
        content: msg.content
      },
      ...(firstProposal?.blocks.map((b, i) => ({
        id: `blk-prop-${Date.now()}-${i}`,
        type: b.type,
        content: b.content
      })) || [])
    ]
    await updatePage({ id: created.id, blocks })
    openPageInTab(created.id)
  }

  const renderComposerCard = (): React.ReactNode => (
    <div className="w-full max-w-2xl rounded-[14px] bg-surface-elevated border border-border-hairline shadow-2xl p-3.5 transition-all focus-within:border-accent-cobalt/70 relative">
      {/* Context Mention & Browser Context Pills */}
      {(mentionedPages.length > 0 || browserContextForAI) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-2 border-b border-border-subtle">
          {browserContextForAI && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-cobalt/15 border border-accent-cobalt/40 text-[11px] text-accent-cobalt">
              <Globe size={11} />
              <span className="truncate max-w-[180px]">{browserContextForAI.title}</span>
              <button
                type="button"
                onClick={() => setBrowserContextForAI(null)}
                className="hover:opacity-75"
              >
                <X size={11} />
              </button>
            </span>
          )}
          {mentionedPages.map((mp) => (
            <span
              key={mp.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-chrome border border-border-hairline text-[11px] text-ink-primary"
            >
              <span>{mp.icon}</span>
              <span className="font-mono text-[10px] text-accent-cobalt">{mp.code}</span>
              <span className="truncate max-w-[140px]">{mp.title}</span>
              <button
                type="button"
                onClick={() => handleToggleMentionPage(mp.id)}
                className="text-ink-muted hover:text-ink-primary"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={promptText}
        onChange={(e) => {
          const val = e.target.value
          setPromptText(val)
          if (val.endsWith('@')) {
            setIsMentionMenuOpen(true)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void handleSendMessage()
          }
        }}
        rows={3}
        placeholder="Ask anything, @ to mention pages, $ skills, or / commands (Powered by Vercel AI SDK)"
        className="w-full bg-transparent resize-none text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none leading-relaxed"
      />

      {/* Mention Popover */}
      {isMentionMenuOpen && (
        <div className="absolute left-3 bottom-14 z-30 w-72 max-h-56 overflow-y-auto rounded-lg bg-surface-chrome border border-border-hairline shadow-2xl p-1.5 space-y-0.5 animate-popover-enter">
          <div className="px-2 py-1 font-mono text-[10px] text-ink-muted uppercase flex items-center justify-between">
            <span>LAMPIRKAN HALAMAN (@MENTION)</span>
            <button
              type="button"
              onClick={() => setIsMentionMenuOpen(false)}
              className="text-ink-muted hover:text-ink-primary"
            >
              <X size={11} />
            </button>
          </div>
          {pages.map((p) => {
            const selected = mentionedPageIds.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (promptText.endsWith('@')) {
                    setPromptText((prev) => prev.slice(0, -1))
                  }
                  handleToggleMentionPage(p.id)
                }}
                className={`w-full px-2 py-1.5 rounded text-left text-xs flex items-center justify-between ${
                  selected
                    ? 'bg-accent-cobalt/15 text-accent-cobalt'
                    : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span>{p.icon}</span>
                  <span className="truncate">{p.title}</span>
                </span>
                <span className="font-mono text-[10px] text-ink-muted">{p.code}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Bottom Controls Row (Orca Style: + | Ask for approval v | Model v | Submit ^) */}
      <div className="flex items-center justify-between pt-2 mt-1">
        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            onClick={() => setIsMentionMenuOpen(!isMentionMenuOpen)}
            title="Lampirkan Halaman NoteIT (@mention)"
            className="w-7 h-7 rounded-full hover:bg-surface-hover flex items-center justify-center text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <Plus size={15} />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsApprovalMenuOpen(!isApprovalMenuOpen)}
              className="px-2.5 py-1 rounded-md hover:bg-surface-hover text-xs text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
            >
              <Hand size={13} className="text-accent-amber" />
              <span>
                {APPROVAL_MODES.find((m) => m.id === preferences.aiApprovalMode)?.label ||
                  'Ask for approval'}
              </span>
              <ChevronDown size={12} className="text-ink-muted" />
            </button>

            {isApprovalMenuOpen && (
              <div className="absolute left-0 bottom-9 z-30 w-52 rounded-lg bg-surface-chrome border border-border-hairline shadow-xl p-1 space-y-0.5 animate-popover-enter">
                {APPROVAL_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      updatePreferences({ aiApprovalMode: m.id })
                      setIsApprovalMenuOpen(false)
                    }}
                    className={`w-full px-2.5 py-1.5 rounded text-left text-xs ${
                      preferences.aiApprovalMode === m.id
                        ? 'bg-surface-hover text-ink-primary font-medium'
                        : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
              className="px-2.5 py-1 rounded-md hover:bg-surface-hover text-xs text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
            >
              <Sparkles size={12} className="text-accent-cobalt" />
              <span>{preferences.aiModel}</span>
              <ChevronDown size={12} className="text-ink-muted" />
            </button>

            {isModelMenuOpen && (
              <div className="absolute right-0 bottom-9 z-30 w-64 rounded-lg bg-surface-chrome border border-border-hairline shadow-xl p-1 space-y-0.5 animate-popover-enter">
                {MODEL_OPTIONS.map((mdl) => (
                  <button
                    key={mdl}
                    type="button"
                    onClick={() => {
                      updatePreferences({ aiModel: mdl })
                      setIsModelMenuOpen(false)
                    }}
                    className={`w-full px-2.5 py-1.5 rounded text-left text-xs ${
                      preferences.aiModel === mdl
                        ? 'bg-surface-hover text-ink-primary font-medium'
                        : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                    }`}
                  >
                    {mdl}
                  </button>
                ))}
                <div className="border-t border-border-subtle pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModelMenuOpen(false)
                      setActiveMainView('settings', 'ai-providers')
                    }}
                    className="w-full px-2.5 py-1 rounded text-left font-mono text-[10px] text-accent-cobalt hover:bg-surface-hover"
                  >
                    ⚙️ Konfigurasi API Key / Ollama →
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleSendMessage()}
            disabled={!promptText.trim() || isStreamingReply}
            title="Kirim Pesan (Enter)"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              promptText.trim() && !isStreamingReply
                ? 'bg-accent-cobalt text-white shadow-md hover:scale-105'
                : 'bg-surface-hover text-ink-muted cursor-not-allowed'
            }`}
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas-primary ambient-aurora-host animate-view-enter">
      {/* Top Session Bar */}
      <div className="h-[38px] px-4 bg-surface-chrome border-b border-border-hairline flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={handleNewSession}
            className="px-2.5 py-1 rounded-md bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5 shrink-0"
          >
            <MessageSquarePlus size={13} className="text-accent-cobalt" />
            <span>New chat</span>
          </button>

          <div className="h-3.5 w-[1px] bg-border-hairline mx-1" />

          {sessions.map((sess) => {
            const active = sess.id === activeSession.id
            return (
              <div
                key={sess.id}
                onClick={() => setActiveSessionId(sess.id)}
                className={`px-2.5 py-1 rounded-md text-xs cursor-pointer flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-surface-elevated border border-border-hairline text-ink-primary font-medium'
                    : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                }`}
              >
                <Clock size={11} className="text-ink-muted" />
                <span className="truncate max-w-[150px]">{sess.title}</span>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      const remaining = sessions.filter((s) => s.id !== sess.id)
                      setSessions(remaining)
                      if (active && remaining[0]) setActiveSessionId(remaining[0].id)
                    }}
                    className="text-ink-muted hover:text-[#EF4444]"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-ink-secondary">
          <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-hairline text-accent-amber">
            VERCEL AI SDK
          </span>
          {activePage && (
            <button
              type="button"
              onClick={() => handleToggleMentionPage(activePage.id)}
              className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-accent-cobalt"
            >
              + @{activePage.code}
            </button>
          )}
        </div>
      </div>

      {/* Main Body: Empty Hero State OR Active Conversation Thread */}
      {activeSession.messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12 select-none">
          {/* Orca-Style Centered Heading */}
          <div className="text-center mb-6 relative">
            <div className="text-xs text-ink-muted font-medium mb-1">Let&apos;s work in</div>
            <button
              type="button"
              onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
              className="inline-flex items-center gap-2 font-display text-3xl font-bold text-ink-primary hover:opacity-90 transition-opacity"
            >
              <span>{chatMode}</span>
              <ChevronDown size={20} className="text-ink-muted mt-1" />
            </button>

            {isModeMenuOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-16 z-30 w-56 rounded-lg bg-surface-elevated border border-border-hairline shadow-2xl p-1 space-y-0.5 animate-popover-enter">
                {CHAT_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setChatMode(m)
                      setIsModeMenuOpen(false)
                    }}
                    className={`w-full px-3 py-1.5 rounded text-left text-xs ${
                      chatMode === m
                        ? 'bg-accent-cobalt/15 text-accent-cobalt font-semibold'
                        : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {renderComposerCard()}

          {/* Quick Starter Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 max-w-2xl">
            {STARTER_PROMPTS.map((sp) => (
              <button
                key={sp.label}
                type="button"
                onClick={() => void handleSendMessage(sp.prompt)}
                className="px-3 py-1.5 rounded-full bg-surface-elevated/80 hover:bg-surface-hover border border-border-hairline text-xs text-ink-secondary hover:text-ink-primary transition-colors flex items-center gap-1.5"
              >
                <Sparkles size={11} className="text-accent-cobalt" />
                <span>{sp.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages List */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            <div className="max-w-2xl mx-auto space-y-5">
              {activeSession.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-xl border animate-view-enter ${
                    msg.role === 'user'
                      ? 'bg-surface-chrome border-border-subtle ml-8'
                      : 'bg-surface-elevated border-border-hairline mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                      <span>
                        {msg.role === 'user' ? 'YOU' : `NOTEIT AI · ${chatMode.toUpperCase()}`}
                      </span>
                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-cobalt animate-pulse" />
                      )}
                    </span>

                    <div className="flex items-center gap-1 flex-wrap">
                      {msg.browserContext && (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-accent-cobalt/15 text-accent-cobalt">
                          🌐 {msg.browserContext.title.slice(0, 22)}
                        </span>
                      )}
                      {msg.mentionedPages?.map((mp) => (
                        <span
                          key={mp.id}
                          className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface-elevated border border-border-hairline text-accent-cobalt"
                        >
                          @{mp.code}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Tool Call Trace Pills */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {msg.toolCalls.map((tc, idx) => (
                        <span
                          key={`${tc.toolName}-${idx}`}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-chrome border border-border-hairline font-mono text-[10px] text-ink-secondary"
                        >
                          <Terminal size={10} className="text-accent-amber" />
                          <span className="text-ink-primary font-semibold">{tc.toolName}</span>
                          <span className="text-ink-muted">({tc.argsSummary})</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-ink-primary whitespace-pre-line leading-relaxed selectable-text">
                    {msg.content || (msg.isStreaming ? 'Menyusun respons...' : '')}
                  </div>

                  {/* Orca-Style Approval Gate Cards for Proposed Blocks */}
                  {msg.proposals &&
                    msg.proposals.map((prop) => (
                      <div
                        key={prop.proposalId}
                        className="mt-3 p-3 rounded-lg bg-surface-chrome border border-border-hairline space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-ink-primary">
                            <Hand size={13} className="text-accent-amber shrink-0" />
                            <span>{prop.summary}</span>
                          </div>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-elevated border border-border-hairline text-accent-cobalt shrink-0">
                            Target: {prop.targetPageCode}
                          </span>
                        </div>

                        {prop.blocks.map((blk, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="font-mono text-[10px] text-ink-muted uppercase">
                              BLOCK [{blk.type.toUpperCase()}]
                            </div>
                            <pre className="p-2.5 rounded bg-[#090B10] border border-[#222634] font-mono text-[11px] text-[#E5E7EB] overflow-x-auto selectable-text">
                              <code>{blk.content}</code>
                            </pre>
                          </div>
                        ))}

                        <div className="flex items-center justify-between pt-1">
                          {prop.status === 'pending' ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleApproveProposal(msg.id, prop)}
                                className="px-3 py-1 rounded bg-accent-cobalt text-white text-xs font-medium flex items-center gap-1.5 hover:opacity-90"
                              >
                                <Check size={12} />
                                <span>Approve &amp; Insert to {prop.targetPageCode}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectProposal(msg.id, prop.proposalId)}
                                className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border-hairline text-xs text-ink-secondary hover:text-ink-primary"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`font-mono text-[11px] flex items-center gap-1 ${
                                prop.status === 'approved'
                                  ? 'text-[#10B981]'
                                  : 'text-ink-muted line-through'
                              }`}
                            >
                              {prop.status === 'approved'
                                ? `✓ Disetujui & disisipkan ke ${prop.targetPageCode}`
                                : '✕ Ditolak'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                  {msg.role === 'assistant' && !msg.isStreaming && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-border-subtle">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCreateSpecFromMessage(msg)}
                          className="px-2.5 py-1 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-[11px] text-ink-primary flex items-center gap-1.5"
                        >
                          <FilePlus2 size={11} className="text-accent-amber" />
                          <span>Jadikan Halaman Spesifikasi Baru</span>
                        </button>
                        {activePage && (
                          <button
                            type="button"
                            onClick={() => openPageInTab(activePage.id)}
                            className="px-2.5 py-1 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-[11px] text-ink-secondary hover:text-ink-primary flex items-center gap-1.5"
                          >
                            <FileText size={11} className="text-accent-cobalt" />
                            <span>Buka {activePage.code}</span>
                          </button>
                        )}
                      </div>
                      {msg.providerLabel && (
                        <span className="font-mono text-[10px] text-ink-muted">
                          {msg.providerLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Composer Dock */}
          <div className="p-4 border-t border-border-hairline bg-surface-chrome/60 flex justify-center">
            {renderComposerCard()}
          </div>
        </div>
      )}
    </div>
  )
}
