import React, { useState } from 'react'
import { Renderer } from '@openuidev/react-lang'
import { Code2, FilePlus2, Sparkles } from 'lucide-react'
import { Button } from '@renderer/components/ui'
import type { AIUiArtifact } from '@shared/types/domain'
import { noteitOpenUiLibrary } from './noteit-openui-library'
import { SandboxedWidgetFrame } from './SandboxedWidgetFrame'

interface IntelligentUiCardProps {
  artifact: AIUiArtifact
  isStreaming?: boolean
  onFollowUp?: (prompt: string) => void
  onSaveToPage?: (title: string, markdown: string) => void
}

/**
 * Unified Intelligent UI renderer: dispatches either OpenUI Lang 1.0 (`@openuidev/react-lang`)
 * or a CopilotKit-style Sandboxed HTML/CSS/JS interactive widget.
 */
export const IntelligentUiCard: React.FC<IntelligentUiCardProps> = ({
  artifact,
  isStreaming = false,
  onFollowUp,
  onSaveToPage
}) => {
  const [showOpenUiSource, setShowOpenUiSource] = useState(false)

  if (artifact.kind === 'sandbox-html' && artifact.sandbox) {
    return (
      <SandboxedWidgetFrame
        spec={{ title: artifact.title, ...artifact.sandbox }}
        onFollowUp={onFollowUp}
        onSaveToPage={onSaveToPage}
      />
    )
  }

  if (artifact.kind === 'openui' && artifact.openuiSource) {
    return (
      <div className="my-3 rounded-xl bg-surface-chrome border border-border-hairline overflow-hidden shadow-card">
        <div className="px-3 py-1.5 bg-surface-elevated/80 border-b border-border-subtle flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={12} className="text-[var(--marker-teal)] shrink-0" />
            <span className="text-xs font-medium text-ink-primary truncate">
              {artifact.title || 'Interactive UI'}
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-chrome border border-border-subtle text-ink-muted">
              OpenUI
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setShowOpenUiSource((v) => !v)}
            >
              <Code2 size={11} />
              <span>{showOpenUiSource ? 'UI' : 'OpenUI'}</span>
            </Button>
            {onSaveToPage && (
              <Button
                variant="secondary"
                size="xs"
                onClick={() =>
                  onSaveToPage(
                    artifact.title || 'OpenUI Artifact',
                    `\`\`\`openui\n${artifact.openuiSource}\n\`\`\``
                  )
                }
              >
                <FilePlus2 size={11} />
                <span>Save</span>
              </Button>
            )}
          </div>
        </div>

        {showOpenUiSource ? (
          <pre className="p-3 font-mono text-[11px] text-ink-secondary overflow-x-auto whitespace-pre-wrap">
            {artifact.openuiSource}
          </pre>
        ) : (
          <div className="p-4">
            <Renderer
              response={artifact.openuiSource}
              library={noteitOpenUiLibrary}
              isStreaming={isStreaming}
              onAction={(event: any) => {
                if (event?.type === 'continue_conversation' && event?.humanFriendlyMessage) {
                  onFollowUp?.(String(event.humanFriendlyMessage))
                }
              }}
            />
          </div>
        )}
      </div>
    )
  }

  return null
}
