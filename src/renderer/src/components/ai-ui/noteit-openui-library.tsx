import React from 'react'
import { z } from 'zod'
import { defineComponent } from '@openuidev/react-lang'
import { library as intelligentUiLibrary } from '@openuidev/intelligent-ui-library'
import { MermaidDiagramPreview } from '@renderer/components/learn/LearnMarkdown'

const NoteItMermaid = defineComponent({
  name: 'NoteItMermaid',
  description: 'Renders a sanitized interactive Mermaid diagram inside NoteIT AI Studio.',
  props: z.object({
    code: z.string()
  }),
  component: ({ props }) => <MermaidDiagramPreview code={props.code} />
})

const NoteItDBML = defineComponent({
  name: 'NoteItDBML',
  description: 'Displays a formatted DBML relational schema block inside NoteIT AI Studio.',
  props: z.object({
    code: z.string()
  }),
  component: ({ props }) => (
    <div className="rounded-lg bg-surface-chrome border border-border-hairline overflow-hidden my-2">
      <div className="px-2.5 py-1 border-b border-border-subtle font-mono text-[10px] uppercase text-[var(--marker-amber)]">
        DBML Schema
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-[11px] text-ink-primary">{props.code}</pre>
    </div>
  )
})

/**
 * Extended OpenUI Lang 1.0 component library for NoteIT AI Studio:
 * includes all `@openuidev/intelligent-ui-library` primitives & 59 `@functions`
 * plus NoteIT-native Mermaid & DBML components.
 */
export const noteitOpenUiLibrary = intelligentUiLibrary.extend({
  components: {
    add: [NoteItMermaid, NoteItDBML]
  }
})
