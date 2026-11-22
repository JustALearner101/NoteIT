import React, { Suspense } from 'react'
import { GraduationCap, MessageSquare, Network, Sparkles } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { cn } from '@renderer/components/ui'
import type { AIStudioSubMode } from '@shared/types/domain'
import { AIChatView } from '@renderer/components/chat/AIChatView'
import { LearnWorkbenchView } from '@renderer/components/learn/LearnWorkbenchView'
import { KnowledgeGraphView } from '@renderer/components/learn/KnowledgeGraphView'

const STUDIO_MODES: Array<{
  id: AIStudioSubMode
  label: string
  icon: React.ReactNode
  activeCls: string
}> = [
  {
    id: 'chat',
    label: 'Chat & Build',
    icon: <MessageSquare size={12.5} aria-hidden="true" />,
    activeCls: 'bg-[var(--pill-violet-bg)] text-[var(--pill-violet-text)] border-[var(--pill-violet-border)]'
  },
  {
    id: 'learn',
    label: 'Active Learn',
    icon: <GraduationCap size={12.5} aria-hidden="true" />,
    activeCls: 'bg-[var(--pill-teal-bg)] text-[var(--pill-teal-text)] border-[var(--pill-teal-border)]'
  },
  {
    id: 'graph',
    label: 'Knowledge Graph',
    icon: <Network size={12.5} aria-hidden="true" />,
    activeCls: 'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]'
  }
]

/**
 * Unified AI Studio v2.4:
 * Combines Agentic Chat & Hybrid Intelligent UI, Active Learn (Measure->Plan->Teach->Practice),
 * and the Propositional Knowledge Graph under one cohesive studio shell.
 */
export const AIStudioView: React.FC = () => {
  const { aiStudioSubMode, setAiStudioSubMode } = useWorkspaceStore()

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas-primary">
      {/* Unified AI Studio Mode Switcher Bar */}
      <div className="h-[38px] px-4 bg-surface-chrome border-b border-border-hairline flex items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--marker-violet)]" aria-hidden="true" />
          <span className="font-display text-xs font-semibold text-ink-primary">AI Studio</span>
          <div className="h-3.5 w-[1px] bg-border-hairline mx-1" />
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
                    'h-7 px-2.5 rounded-[7px] border text-xs flex items-center gap-1.5 transition-colors',
                    active
                      ? `${m.activeCls} font-medium`
                      : 'border-transparent text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'
                  )}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <span className="hidden md:inline font-mono text-[10px] text-ink-muted">
          Vercel AI SDK v7 · Hybrid Intelligent UI
        </span>
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
            <AIChatView />
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
