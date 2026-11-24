import React, { Suspense } from 'react'
import { GraduationCap, Maximize2, MessageSquare, Network, Sparkles, X } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { cn } from '@renderer/components/ui'
import type { AIStudioSubMode } from '@shared/types/domain'
import { AIChatView } from '@renderer/components/chat/AIChatView'
import { LearnWorkbenchView } from '@renderer/components/learn/LearnWorkbenchView'
import { KnowledgeGraphView } from '@renderer/components/learn/KnowledgeGraphView'

interface AIStudioViewProps {
  isSplitMode?: boolean
}

const STUDIO_MODES: Array<{
  id: AIStudioSubMode
  label: string
  compactLabel: string
  icon: React.ReactNode
  activeCls: string
}> = [
  {
    id: 'chat',
    label: 'Chat & Build',
    compactLabel: 'Chat',
    icon: <MessageSquare size={12.5} aria-hidden="true" />,
    activeCls: 'bg-[var(--pill-violet-bg)] text-[var(--pill-violet-text)] border-[var(--pill-violet-border)]'
  },
  {
    id: 'learn',
    label: 'Active Learn',
    compactLabel: 'Learn',
    icon: <GraduationCap size={12.5} aria-hidden="true" />,
    activeCls: 'bg-[var(--pill-teal-bg)] text-[var(--pill-teal-text)] border-[var(--pill-teal-border)]'
  },
  {
    id: 'graph',
    label: 'Knowledge Graph',
    compactLabel: 'Graph',
    icon: <Network size={12.5} aria-hidden="true" />,
    activeCls: 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]'
  }
]

/**
 * Unified AI Studio v2.4:
 * Combines Agentic Chat & Hybrid Intelligent UI, Active Learn (Measure->Plan->Teach->Practice),
 * and the Propositional Knowledge Graph under one cohesive studio shell.
 */
export const AIStudioView: React.FC<AIStudioViewProps> = ({ isSplitMode = false }) => {
  const { aiStudioSubMode, setAiStudioSubMode, setRightSplitMode, setActiveMainView } =
    useWorkspaceStore()

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas-primary">
      {/* Unified AI Studio Mode Switcher Bar */}
      <div
        className={cn(
          'h-[38px] bg-surface-chrome border-b border-border-hairline flex items-center justify-between gap-2 shrink-0 select-none',
          isSplitMode ? 'px-2.5' : 'px-4'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles size={14} className="text-[var(--marker-violet)] shrink-0" aria-hidden="true" />
          {!isSplitMode && (
            <>
              <span className="font-display text-xs font-semibold text-ink-primary">AI Studio</span>
              <div className="h-3.5 w-[1px] bg-border-hairline mx-1" />
            </>
          )}
          <div role="tablist" aria-label="AI Studio modes" className="flex items-center gap-1">
            {STUDIO_MODES.map((m) => {
              const active = aiStudioSubMode === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setAiStudioSubMode(m.id)}
                  className={cn(
                    'h-7 rounded-[7px] border text-xs flex items-center gap-1.5 transition-colors',
                    isSplitMode ? 'px-2' : 'px-2.5',
                    active
                      ? `${m.activeCls} font-medium`
                      : 'border-transparent text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                  )}
                >
                  {m.icon}
                  <span>{isSplitMode ? m.compactLabel : m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {isSplitMode ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setRightSplitMode('page')
                setActiveMainView('ai-chat')
              }}
              title="Open AI Studio in full view"
              aria-label="Open AI Studio in full view"
              className="p-1.5 rounded-[6px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors"
            >
              <Maximize2 size={12} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setRightSplitMode('page')}
              title="Close AI Studio split pane (Ctrl+Alt+C)"
              aria-label="Close AI Studio split pane"
              className="p-1.5 rounded-[6px] text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span className="hidden md:inline font-mono text-[10px] text-ink-muted">
            Vercel AI SDK v7 · Hybrid Intelligent UI
          </span>
        )}
      </div>

      {/* Sub-mode Body */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-xs font-mono text-ink-muted">
              Loading AI Studio...
            </div>
          }
        >
          {aiStudioSubMode === 'chat' ? (
            <AIChatView isSplitMode={isSplitMode} />
          ) : aiStudioSubMode === 'learn' ? (
            <LearnWorkbenchView />
          ) : (
            <KnowledgeGraphView
              onOpenSession={() => {
                setAiStudioSubMode('learn')
              }}
            />
          )}
        </Suspense>
      </div>
    </div>
  )
}
