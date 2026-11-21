import React from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { cn } from '@renderer/components/ui'

interface OnboardingStep {
  id: string
  title: string
  desc: string
  actionLabel: string
  targetView?: 'workbench' | 'ai-chat'
  targetSection?: string
  splitAction?: boolean
  helpAction?: boolean
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'create-notebook',
    title: 'Create or explore a project notebook',
    desc: 'Organize system specs into notebooks and color-coded sections.',
    actionLabel: 'Open workbench',
    targetView: 'workbench'
  },
  {
    id: 'block-editor',
    title: 'Write specs with the block editor and DBML',
    desc: 'Use text, code, DBML schema, Mermaid, and Graphviz DOT blocks.',
    actionLabel: 'Open editor',
    targetView: 'workbench'
  },
  {
    id: 'try-themes',
    title: 'Personalize the look in Theme Studio',
    desc: 'Try Orca Carbon, Code.Zone Amber, Finns Cosmic Nebula, or build a custom theme.',
    actionLabel: 'Choose theme',
    targetSection: 'appearance'
  },
  {
    id: 'try-ai-chat',
    title: 'Start a session in AI Chat',
    desc: 'Use @mention to attach spec pages as discussion context.',
    actionLabel: 'Open AI Chat',
    targetView: 'ai-chat'
  },
  {
    id: 'try-split-pane',
    title: 'Compare two documents with split pane',
    desc: 'Alt+click a page in the sidebar to open documents side by side.',
    actionLabel: 'Enable split',
    splitAction: true
  },
  {
    id: 'read-help-html',
    title: 'Open the Help Center in your browser',
    desc: 'Learn DBML and Mermaid syntax and browse shortcuts in a static HTML page.',
    actionLabel: 'Open help',
    helpAction: true
  }
]

export const GeneralEditorTab: React.FC = () => {
  const {
    preferences,
    updatePreferences,
    toggleOnboardingItem,
    setActiveSettingsSection,
    setActiveMainView,
    toggleSplitPane,
    openHelpCenter
  } = useWorkspaceStore()

  const doneCount = preferences.onboardingDone.length

  return (
    <div className="space-y-8 animate-view-enter">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-primary">General &amp; editor</h1>
        <p className="text-xs text-ink-secondary mt-1">
          Default page mode, spellcheck, and a quick tour of NoteIT Workbench.
        </p>
      </div>

      <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
        <div className="flex items-center justify-between py-2 border-b border-border-subtle">
          <div>
            <label htmlFor="default-page-mode" className="text-xs font-medium text-ink-primary">
              Default mode for new pages
            </label>
            <div className="text-[11px] text-ink-secondary">
              Choose whether new pages open in the block editor or the spatial canvas.
            </div>
          </div>
          <select
            id="default-page-mode"
            value={preferences.defaultPageMode}
            onChange={(e) =>
              updatePreferences({ defaultPageMode: e.target.value === 'canvas' ? 'canvas' : 'block' })
            }
            className="px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus-visible:ring-2 focus-visible:ring-accent-cobalt"
          >
            <option value="block">Block document</option>
            <option value="canvas">Spatial canvas (24px grid)</option>
          </select>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <div id="spellcheck-label" className="text-xs font-medium text-ink-primary">
              Editor spellcheck
            </div>
            <div className="text-[11px] text-ink-secondary">
              Underline misspelled words inside text blocks.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.spellcheck}
            aria-labelledby="spellcheck-label"
            onClick={() => updatePreferences({ spellcheck: !preferences.spellcheck })}
            className={cn(
              'px-3 py-1 rounded border text-xs font-mono',
              preferences.spellcheck
                ? 'bg-accent-cobalt/15 border-accent-cobalt text-accent-cobalt'
                : 'bg-surface-chrome border-border-hairline text-ink-secondary'
            )}
          >
            {preferences.spellcheck ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <section aria-labelledby="onboarding-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="onboarding-heading" className="font-display text-sm font-semibold text-ink-primary">
            Onboarding checklist
          </h2>
          <div className="px-3 py-1 rounded-full bg-surface-elevated border border-border-hairline font-mono text-xs text-accent-cobalt">
            {doneCount} / {ONBOARDING_STEPS.length} done
          </div>
        </div>
        <ul className="space-y-2.5">
          {ONBOARDING_STEPS.map((step) => {
            const isDone = preferences.onboardingDone.includes(step.id)
            return (
              <li
                key={step.id}
                className={cn(
                  'p-4 rounded-lg border flex items-center justify-between gap-4',
                  isDone
                    ? 'bg-surface-elevated/60 border-border-subtle'
                    : 'bg-surface-elevated border-border-hairline'
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={`Mark "${step.title}" as ${isDone ? 'not done' : 'done'}`}
                    onClick={() => toggleOnboardingItem(step.id)}
                    className="mt-0.5"
                  >
                    {isDone ? (
                      <CheckCircle2 size={18} className="text-accent-cobalt" aria-hidden="true" />
                    ) : (
                      <Circle size={18} className="text-ink-muted" aria-hidden="true" />
                    )}
                  </button>
                  <div>
                    <div
                      className={cn(
                        'text-sm font-medium',
                        isDone ? 'line-through text-ink-secondary' : 'text-ink-primary'
                      )}
                    >
                      {step.title}
                    </div>
                    <div className="text-xs text-ink-secondary mt-0.5">{step.desc}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDone) toggleOnboardingItem(step.id)
                    if (step.targetSection) setActiveSettingsSection(step.targetSection)
                    else if (step.targetView) setActiveMainView(step.targetView)
                    else if (step.splitAction) {
                      setActiveMainView('workbench')
                      toggleSplitPane()
                    } else if (step.helpAction) void openHelpCenter()
                  }}
                  className="px-3 py-1.5 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-primary shrink-0 transition-colors"
                >
                  {step.actionLabel}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
