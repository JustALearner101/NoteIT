import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Columns2,
  Edit3,
  FileCode,
  FolderGit2,
  GitCompare,
  RefreshCw,
  RotateCcw,
  Save,
  X
} from 'lucide-react'
import { EditorState, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
   GutterMarker,
  gutter,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { MergeView, unifiedMergeView } from '@codemirror/merge'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import {
  Badge,
  Button,
  ConfirmModal,
  SegmentedControl,
  cn
} from '@renderer/components/ui'
import type { RepoFileDiffResult, RepoGitStatusSummary } from '@shared/types/domain'

export type DiffInspectorMode = 'side-by-side' | 'unified' | 'quick-edit'

const obsidianHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#60A5FA', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#34D399' },
  { tag: [tags.number, tags.bool, tags.null], color: '#FBBF24' },
  { tag: [tags.comment, tags.quote], color: '#6E6E7A', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.propertyName], color: '#93C5FD' },
  { tag: [tags.typeName, tags.className], color: '#C084FC' },
  { tag: tags.operator, color: '#A1A1AE' }
])

const obsidianEditorTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--bg-canvas)',
      fontSize: '12px',
      fontFamily: '"JetBrains Mono", monospace',
      height: '100%'
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: '"JetBrains Mono", monospace',
      lineHeight: '1.6'
    },
    '.cm-content': {
      caretColor: 'var(--accent-cobalt)',
      padding: '8px 0'
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-surface-chrome)',
      color: 'var(--text-muted)',
      borderRight: '1px solid var(--border-hairline)',
      fontSize: '11px'
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(59, 130, 246, 0.08)'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(59, 130, 246, 0.14)',
      color: 'var(--text-primary)'
    },
    '.cm-target-line-highlight': {
      backgroundColor: 'rgba(245, 158, 11, 0.18)',
      borderLeft: '2px solid #F59E0B'
    }
  },
  { dark: true }
)

function resolveLanguageExtension(lang: string): Extension {
  switch (lang) {
    case 'typescript':
      return javascript({ typescript: true, jsx: true })
    case 'javascript':
      return javascript({ jsx: true })
    case 'python':
      return python()
    case 'sql':
      return sql()
    case 'json':
      return json()
    case 'markdown':
      return markdown()
    case 'html':
      return html()
    case 'css':
      return css()
    default:
      return []
  }
}

function buildTargetLineExtension(
  docText: string,
  startLine?: number,
  endLine?: number
): Extension {
  if (!startLine || startLine < 1) return []
  const lines = docText.split('\n')
  const clampedStart = Math.min(Math.max(1, startLine), lines.length)
  const clampedEnd = Math.min(Math.max(clampedStart, endLine ?? clampedStart), lines.length)

  return EditorView.decorations.compute(['doc'], (state) => {
    const decos = []
    const lineDeco = Decoration.line({ attributes: { class: 'cm-target-line-highlight' } })
    for (let ln = clampedStart; ln <= clampedEnd; ln++) {
      if (ln <= state.doc.lines) {
        const lineObj = state.doc.line(ln)
        decos.push(lineDeco.range(lineObj.from))
      }
    }
    return Decoration.set(decos)
  })
}

export const RepoDiffInspectorPane: React.FC = () => {
  const {
    notebooks,
    activeNotebookId,
    sections,
    pages,
    activePageId,
    diffTarget,
    openCodeInDiffInspector,
    setRightSplitMode,
    showToast
  } = useWorkspaceStore()

  const currentNotebook = notebooks.find((nb) => nb.id === activeNotebookId) || notebooks[0]
  const activePage = pages.find((p) => p.id === activePageId)
  const activeSection = sections.find((s) => s.id === activePage?.sectionId)

  const repoPath =
    diffTarget?.repoPath || activeSection?.repoPathOverride || currentNotebook?.repoPath || ''

  const [mode, setMode] = useState<DiffInspectorMode>('side-by-side')
  const [gitStatus, setGitStatus] = useState<RepoGitStatusSummary | null>(null)
  const [diffData, setDiffData] = useState<RepoFileDiffResult | null>(null)
  const [draftContent, setDraftContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const editorContainerRef = useRef<HTMLDivElement>(null)
  const activeViewRef = useRef<EditorView | MergeView | null>(null)

  const activeRelPath = useMemo(() => {
    if (diffTarget?.relPath) return diffTarget.relPath
    if (gitStatus?.changedFiles?.length) return gitStatus.changedFiles[0].relPath
    return ''
  }, [diffTarget?.relPath, gitStatus?.changedFiles])

  const loadDiffForFile = useCallback(
    async (targetRepo: string, relPath: string) => {
      if (!targetRepo) return
      setIsLoading(true)
      setErrorMsg(null)
      try {
        const status = await window.noteitAPI.getRepoGitStatus(targetRepo)
        setGitStatus(status)

        const targetFile = relPath || status.changedFiles[0]?.relPath || ''
        if (!targetFile) {
          setDiffData(null)
          setDraftContent('')
          setIsDirty(false)
          return
        }

        const diff = await window.noteitAPI.getRepoFileDiff({
          repoPath: targetRepo,
          relPath: targetFile
        })
        setDiffData(diff)
        setDraftContent(diff.workingContent)
        setIsDirty(false)

        // If opened via Code WikiLink with specific line anchor on a clean file, default to quick-edit so line highlights are clear
        if (diff.status === 'clean' && diffTarget?.startLine) {
          setMode('quick-edit')
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err))
      } finally {
        setIsLoading(false)
      }
    },
    [diffTarget?.startLine]
  )

  useEffect(() => {
    if (repoPath) {
      void loadDiffForFile(repoPath, diffTarget?.relPath || '')
    }
  }, [repoPath, diffTarget?.relPath, diffTarget?.startLine, diffTarget?.endLine, loadDiffForFile])

  const handleSaveFile = useCallback(async () => {
    if (!repoPath || !diffData) return
    setIsSaving(true)
    try {
      await window.noteitAPI.writeRepoFile({
        repoPath,
        relPath: diffData.relPath,
        content: draftContent
      })
      showToast(`Saved ${diffData.relPath}`)
      await loadDiffForFile(repoPath, diffData.relPath)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save file', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [repoPath, diffData, draftContent, showToast, loadDiffForFile])

  const handleConfirmDiscard = async (): Promise<void> => {
    if (!repoPath || !diffData) return
    try {
      await window.noteitAPI.discardRepoFileChanges({
        repoPath,
        relPath: diffData.relPath
      })
      showToast(`Discarded changes in ${diffData.relPath}`)
      await loadDiffForFile(repoPath, diffData.relPath)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to discard changes', 'error')
    }
  }

  // Mount CodeMirror 6 MergeView / Unified / EditorView
  useEffect(() => {
    const container = editorContainerRef.current
    if (!container || !diffData || diffData.isBinary) return

    // Cleanup previous instance
    if (activeViewRef.current) {
      activeViewRef.current.destroy()
      activeViewRef.current = null
    }
    container.innerHTML = ''

    const langExt = resolveLanguageExtension(diffData.language)
    const targetHighlightExt = buildTargetLineExtension(
      diffData.workingContent,
      diffTarget?.startLine,
      diffTarget?.endLine
    )

    const baseExtensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      syntaxHighlighting(obsidianHighlightStyle),
      obsidianEditorTheme,
      langExt,
      targetHighlightExt,
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        {
          key: 'Mod-s',
          run: () => {
            void handleSaveFile()
            return true
          }
        }
      ])
    ]

    const scrollToTargetLine = (view: EditorView): void => {
      if (!diffTarget?.startLine || diffTarget.startLine < 1) return
      const targetLn = Math.min(diffTarget.startLine, view.state.doc.lines)
      if (targetLn >= 1) {
        const lineInfo = view.state.doc.line(targetLn)
        view.dispatch({
          selection: { anchor: lineInfo.from },
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' })
        })
      }
    }

    if (mode === 'side-by-side') {
      const mergeView = new MergeView({
        parent: container,
        a: {
          doc: diffData.headContent,
          extensions: [
            ...baseExtensions,
            EditorState.readOnly.of(true),
            EditorView.editable.of(false)
          ]
        },
        b: {
          doc: diffData.workingContent,
          extensions: [
            ...baseExtensions,
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                const next = update.state.doc.toString()
                setDraftContent(next)
                setIsDirty(next !== diffData.workingContent)
              }
            })
          ]
        },
        gutter: true,
        highlightChanges: true,
        revertControls: 'a-to-b'
      })
      activeViewRef.current = mergeView
      scrollToTargetLine(mergeView.b)
    } else if (mode === 'unified') {
      const view = new EditorView({
        parent: container,
        state: EditorState.create({
          doc: diffData.workingContent,
          extensions: [
            ...baseExtensions,
            unifiedMergeView({
              original: diffData.headContent,
              gutter: true,
              highlightChanges: true,
              syntaxHighlightDeletions: true,
              mergeControls: true
            }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                const next = update.state.doc.toString()
                setDraftContent(next)
                setIsDirty(next !== diffData.workingContent)
              }
            })
          ]
        })
      })
      activeViewRef.current = view
      scrollToTargetLine(view)
    } else {
      const view = new EditorView({
        parent: container,
        state: EditorState.create({
          doc: diffData.workingContent,
          extensions: [
            ...baseExtensions,
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                const next = update.state.doc.toString()
                setDraftContent(next)
                setIsDirty(next !== diffData.workingContent)
              }
            })
          ]
        })
      })
      activeViewRef.current = view
      scrollToTargetLine(view)
    }

    return () => {
      if (activeViewRef.current) {
        activeViewRef.current.destroy()
        activeViewRef.current = null
      }
    }
  }, [
    diffData,
    mode,
    diffTarget?.startLine,
    diffTarget?.endLine,
    handleSaveFile
  ])

  if (!repoPath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-canvas-primary border-l border-border-hairline select-none">
        <FolderGit2 size={24} className="text-ink-muted mb-2" aria-hidden="true" />
        <h3 className="font-semibold text-sm text-ink-primary mb-1">No repository bound</h3>
        <p className="text-xs text-ink-secondary max-w-xs mb-4">
          Bind a local Git repository in the Repo Explorer first to inspect diffs and quick-edit code files.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setRightSplitMode('repo-explorer')}>
          Open Repo Explorer
        </Button>
      </div>
    )
  }

  return (
    <section
      aria-label="Repository Diff and Quick-Edit Inspector"
      className="flex-1 flex flex-col min-w-0 h-full bg-canvas-primary border-l border-border-hairline overflow-hidden animate-view-enter"
    >
      {/* Top Inspector Header Bar */}
      <div className="px-3 py-2 bg-surface-chrome border-b border-border-hairline flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <GitCompare size={14} className="text-accent-cobalt shrink-0" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold text-ink-primary truncate">
            {diffData?.relPath || activeRelPath || 'Diff Inspector'}
          </span>
          {diffTarget?.startLine && (
            <Badge tone="amber" size="sm" className="font-mono">
              L{diffTarget.startLine}
              {diffTarget.endLine && diffTarget.endLine !== diffTarget.startLine
                ? `-L${diffTarget.endLine}`
                : ''}
            </Badge>
          )}
          {diffData && (
            <div className="flex items-center gap-1.5 font-mono text-[10.5px] tabular-nums">
              <Badge
                tone={
                  diffData.status === 'modified'
                    ? 'amber'
                    : diffData.status === 'added' || diffData.status === 'untracked'
                      ? 'teal'
                      : diffData.status === 'deleted'
                        ? 'red'
                        : 'neutral'
                }
                size="sm"
              >
                {diffData.status}
              </Badge>
              <span className="text-[var(--pill-teal-text)]">+{diffData.additions}</span>
              <span className="text-[var(--pill-red-text)]">-{diffData.deletions}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <SegmentedControl<DiffInspectorMode>
            size="sm"
            ariaLabel="Diff inspector mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'side-by-side', label: 'Side-by-side', icon: <Columns2 size={11} /> },
              { value: 'unified', label: 'Unified', icon: <GitCompare size={11} /> },
              { value: 'quick-edit', label: 'Quick edit', icon: <Edit3 size={11} /> }
            ]}
          />

          <button
            type="button"
            onClick={() => void loadDiffForFile(repoPath, diffData?.relPath || activeRelPath)}
            title="Refresh file diff"
            aria-label="Refresh file diff"
            className="p-1.5 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary transition-colors"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setRightSplitMode('page')}
            title="Close Diff Inspector"
            aria-label="Close Diff Inspector"
            className="p-1.5 rounded-[6px] hover:bg-surface-hover text-ink-muted hover:text-ink-primary transition-colors"
          >
            <X size={12.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Changed Files Selector & Action Toolbar */}
      <div className="px-3 py-1.5 bg-surface-elevated/70 border-b border-border-hairline flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode size={12.5} className="text-ink-muted shrink-0" aria-hidden="true" />
          <select
            aria-label="Select repository file to inspect"
            value={diffData?.relPath || activeRelPath}
            onChange={(e) => {
              if (e.target.value) {
                openCodeInDiffInspector({
                  repoPath,
                  relPath: e.target.value
                })
              }
            }}
            className="h-6 max-w-[280px] bg-surface-chrome border border-border-hairline rounded-[6px] px-2 font-mono text-[11px] text-ink-primary focus:border-accent-cobalt"
          >
            {diffData &&
              !gitStatus?.changedFiles.some((f) => f.relPath === diffData.relPath) && (
                <option value={diffData.relPath}>{diffData.relPath} (clean)</option>
              )}
            {gitStatus?.changedFiles.map((file) => (
              <option key={file.relPath} value={file.relPath}>
                [{file.status[0].toUpperCase()}] {file.relPath}
              </option>
            ))}
            {(!gitStatus || gitStatus.changedFiles.length === 0) && !diffData && (
              <option value="">No modified files</option>
            )}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          {diffData && diffData.status !== 'clean' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsDiscardModalOpen(true)}
              title="Discard working-tree changes for this file"
              className="text-[var(--pill-red-text)] hover:bg-[var(--pill-red-bg)]"
            >
              <RotateCcw size={11} aria-hidden="true" />
              <span>Discard</span>
            </Button>
          )}

          <Button
            variant={isDirty ? 'primary' : 'secondary'}
            size="xs"
            disabled={!diffData || isSaving}
            loading={isSaving}
            onClick={() => void handleSaveFile()}
            title="Save file changes (Ctrl+S)"
          >
            {isDirty ? <Save size={11} aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
            <span>{isDirty ? 'Save (Ctrl+S)' : 'Saved'}</span>
          </Button>
        </div>
      </div>

      {/* Main Editor / Merge Body */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {errorMsg ? (
          <div className="p-6 text-xs font-mono text-[var(--pill-red-text)]">{errorMsg}</div>
        ) : !diffData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-ink-muted font-mono">
            {isLoading
              ? 'Loading repository diff...'
              : 'Working tree is clean. Click any file in Repo Explorer or a [[path#L10]] code WikiLink to inspect.'}
          </div>
        ) : diffData.isBinary ? (
          <div className="flex-1 flex items-center justify-center p-6 text-xs font-mono text-ink-muted">
            Binary file ({diffData.relPath}) cannot be displayed in text diff mode.
          </div>
        ) : (
          <div
            ref={editorContainerRef}
            className={cn(
              'flex-1 min-h-0 overflow-auto [&_.cm-mergeView]:h-full [&_.cm-mergeView]:overflow-auto [&_.cm-mergeViewEditors]:min-h-full [&_.cm-editor]:h-full'
            )}
          />
        )}
      </div>

      <ConfirmModal
        open={isDiscardModalOpen}
        onOpenChange={setIsDiscardModalOpen}
        title="Discard file changes?"
        description={
          diffData
            ? `Are you sure you want to discard all uncommitted changes in "${diffData.relPath}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Discard changes"
        variant="danger"
        onConfirm={handleConfirmDiscard}
      />
    </section>
  )
}
