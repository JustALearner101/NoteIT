import type { AIUiArtifact, AIUiMode } from '@shared/types/domain'

export type RoutedPresentation = 'markdown' | 'openui' | 'sandbox-html'

const SANDBOX_PATTERNS =
  /\b(3d|three\.?js|webgl|canvas|animation|animate|simulation|simulate|physics|game|arcade|interactive\s+demo|visualizer|sorting\s+visualizer|pendulum|orbit|solar\s+system|airplane|pitch.*roll.*yaw)\b/i

const OPENUI_PATTERNS =
  /\b(calculator|kalkulator|slider|compare|comparison|bandingkan|chart|grafik|graph|dashboard|table|tabel|flashcard|quiz|kuis|planner|itinerary|budget|split\s+bill|mortgage|loan|cicilan|converter|timer|interactive|interaktif|widget|pricing|roadmap|timeline)\b/i

/**
 * Fast, deterministic presentation router (works 100% offline & with CLI bridges).
 * Decides whether a user prompt is best answered as Markdown, OpenUI Lang 1.0, or
 * a Sandboxed HTML/CSS/JS interactive widget.
 */
export function routePresentationMode(
  prompt: string,
  requestedUiMode: AIUiMode = 'auto'
): RoutedPresentation {
  if (requestedUiMode === 'markdown') return 'markdown'
  if (SANDBOX_PATTERNS.test(prompt)) return 'sandbox-html'
  if (requestedUiMode === 'intelligent-ui') return 'openui'
  if (OPENUI_PATTERNS.test(prompt)) return 'openui'
  return 'markdown'
}

/**
 * Compact OpenUI Lang 1.0 system prompt extension compatible with `@openuidev/intelligent-ui-library`
 * plus NoteIT's native `NoteItMermaid` and `NoteItDBML` extensions.
 */
export function buildIntelligentUiSystemPrompt(routed: RoutedPresentation): string {
  if (routed === 'markdown') return ''

  if (routed === 'sandbox-html') {
    return [
      'INTELLIGENT UI MODE (Sandboxed Interactive HTML/CSS/JS Widget):',
      'When building a custom interactive simulation, canvas, visualizer, or mini-app, call the `render_interactive_widget` tool with clean self-contained HTML, CSS, and vanilla JS (no external CDN scripts required).',
      'Inside the widget JS, you may send follow-up prompts back to NoteIT via `window.parent.postMessage({ type: "noteit-widget-action", action: "follow-up", payload: "..." }, "*")`.'
    ].join('\n')
  }

  return [
    'INTELLIGENT UI MODE (OpenUI Lang 1.0):',
    'In addition to a brief explanation, emit a fenced ```openui code block containing valid OpenUI Lang 1.0 statements that render an interactive UI.',
    'Core primitives available: Col, Row, Grid, Card, Title, Text, Caption, Badge, Divider, Button, Input, Slider, Select, SegmentedControl, Checkbox, Switch, Table, Chart (bar/line/area/pie/donut/scatter), List, ListItem, Code, Math, Flashcard, Timer, NoteItMermaid(code), NoteItDBML(code).',
    'State & reactivity: Bind inputs to `$variables` (e.g. `Slider($amount, 100, 10000, 100)`), compute values with `@functions` (`@Pow`, `@Percent`, `@Payment`, `@Format`, `@Round`, `@Range`, `@Each`, `@Sum`), and mutate state on buttons with `@Set($var, value)`.',
    'Always define `root = ...` as the top-level statement inside ```openui ... ```.'
  ].join('\n')
}

/**
 * Extracts a fenced ```openui ... ``` block from streamed assistant text.
 */
export function extractOpenUiArtifact(text: string): {
  prose: string
  artifact: AIUiArtifact | null
} {
  const match = /```openui\s*\n([\s\S]*?)```/i.exec(text)
  if (!match) {
    return { prose: text, artifact: null }
  }
  const openuiSource = match[1].trim()
  if (!openuiSource) {
    return { prose: text, artifact: null }
  }
  const prose = text.replace(match[0], '').trim()
  return {
    prose,
    artifact: {
      kind: 'openui',
      title: 'Interactive UI',
      openuiSource
    }
  }
}
