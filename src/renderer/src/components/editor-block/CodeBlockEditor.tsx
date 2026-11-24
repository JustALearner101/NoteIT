import React, { useEffect, useRef, useState } from 'react'
import { Check, Code2, Copy, Hash } from 'lucide-react'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { markdown } from '@codemirror/lang-markdown'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import { cn } from '@renderer/components/ui'

interface CodeBlockEditorProps {
  content: string
  language?: string
  onChange: (patch: { content?: string; language?: string }) => void
}

const LANGUAGES = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'sql', label: 'SQL' },
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'bash', label: 'Bash / Shell' },
  { id: 'plaintext', label: 'Plaintext' }
] as const

function resolveLanguageExtension(lang: string): Extension {
  const normalized = (lang || '').trim().toLowerCase()
  switch (normalized) {
    case 'ts':
    case 'tsx':
    case 'typescript':
      return javascript({ typescript: true, jsx: true })
    case 'js':
    case 'jsx':
    case 'javascript':
      return javascript({ jsx: true })
    case 'py':
    case 'python':
      return python()
    case 'sql':
    case 'postgres':
    case 'sqlite':
      return sql()
    case 'json':
      return json()
    case 'html':
    case 'xml':
      return html()
    case 'css':
    case 'scss':
      return css()
    case 'md':
    case 'markdown':
      return markdown()
    default:
      return []
  }
}

function buildEditorTheme(isDark: boolean): Extension {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: 'transparent',
        color: 'var(--ink-primary)',
        fontSize: '12.5px',
        fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)'
      },
      '.cm-scroller': {
        overflowX: 'auto',
        lineHeight: '1.6'
      },
      '.cm-content': {
        padding: '12px 14px',
        caretColor: 'var(--accent-cobalt)'
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        color: 'var(--ink-muted)',
        borderRight: '1px solid var(--border-subtle)',
        paddingRight: '4px'
      },
      '.cm-activeLine': {
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'
      },
      '&.cm-focused': {
        outline: 'none'
      }
    },
    { dark: isDark }
  )
}

export const CodeBlockEditor: React.FC<CodeBlockEditorProps> = ({
  content,
  language = 'typescript',
  onChange
}) => {
  const theme = useWorkspaceStore((s) => s.theme)
  const isDark = theme === 'dark'

  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const langCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())
  const gutterCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const state = EditorState.create({
      doc: content,
      extensions: [
        keymap.of([...defaultKeymap, indentWithTab]),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        langCompartment.current.of(resolveLanguageExtension(language)),
        themeCompartment.current.of(buildEditorTheme(isDark)),
        gutterCompartment.current.of(showLineNumbers ? lineNumbers() : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current({ content: update.state.doc.toString() })
          }
        })
      ]
    })

    const view = new EditorView({ state, parent: host })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external content changes (e.g. Undo/Redo or AI Replace)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content }
      })
    }
  }, [content])

  // Reconfigure language dynamically
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: langCompartment.current.reconfigure(resolveLanguageExtension(language))
    })
  }, [language])

  // Reconfigure theme dynamically
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(buildEditorTheme(isDark))
    })
  }, [isDark])

  // Reconfigure line numbers dynamically
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: gutterCompartment.current.reconfigure(showLineNumbers ? lineNumbers() : [])
    })
  }, [showLineNumbers])

  const handleCopy = (): void => {
    void navigator.clipboard?.writeText(content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="rounded-[10px] bg-surface-chrome border border-border-hairline overflow-hidden">
      <div className="h-8 px-3 bg-surface-elevated/80 border-b border-border-hairline flex items-center justify-between gap-2 text-[11px] text-ink-muted select-none">
        <div className="flex items-center gap-1.5 font-medium text-ink-secondary">
          <Code2 size={12} className="text-[var(--marker-violet)]" aria-hidden="true" />
          <span>Code</span>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            aria-label="Code snippet language"
            value={
              LANGUAGES.some((l) => l.id === (language || '').toLowerCase())
                ? (language || '').toLowerCase()
                : 'plaintext'
            }
            onChange={(e) => onChange({ language: e.target.value })}
            className="h-6 px-1.5 rounded-[5px] bg-surface-chrome border border-border-hairline font-mono text-[10.5px] text-accent-amber focus:outline-none focus:border-accent-cobalt"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowLineNumbers((prev) => !prev)}
            title="Toggle line numbers"
            aria-label="Toggle line numbers"
            aria-pressed={showLineNumbers}
            className={cn(
              'p-1 rounded-[5px] transition-colors',
              showLineNumbers
                ? 'bg-surface-hover text-ink-primary'
                : 'text-ink-muted hover:text-ink-primary hover:bg-surface-hover'
            )}
          >
            <Hash size={11} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            title="Copy code"
            aria-label="Copy code"
            className="px-1.5 py-0.5 rounded-[5px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary flex items-center gap-1 transition-colors"
          >
            {copied ? (
              <>
                <Check size={11} className="text-accent-teal" aria-hidden="true" />
                <span className="text-[10.5px] text-accent-teal">Copied</span>
              </>
            ) : (
              <>
                <Copy size={11} aria-hidden="true" />
                <span className="text-[10.5px]">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div ref={hostRef} aria-label="Code snippet editor" className="min-h-[76px]" />
    </div>
  )
}
