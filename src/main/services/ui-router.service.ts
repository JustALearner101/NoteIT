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

/**
 * Builds a self-contained local fallback OpenUI Lang or Sandboxed HTML artifact
 * when no live cloud/CLI provider is configured, so Intelligent UI can still be tested offline.
 */
export function buildOfflineIntelligentUiFallback(
  prompt: string,
  routed: RoutedPresentation
): { prose: string; artifact: AIUiArtifact } | null {
  if (routed === 'sandbox-html') {
    return {
      prose: `Berikut widget interaktif sandboxed untuk **"${prompt.slice(0, 60)}"** (mode simulasi offline — hubungkan CLI Bridge atau API key di Settings untuk generasi AI penuh):`,
      artifact: {
        kind: 'sandbox-html',
        title: `Interactive Simulation: ${prompt.slice(0, 36)}`,
        sandbox: {
          initialHeight: 300,
          css: `
            body { margin: 0; font-family: system-ui, sans-serif; background: #141417; color: #EDEDEF; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 12px; }
            canvas { border: 1px solid #27272E; border-radius: 10px; background: #0E0E11; }
            .controls { display: flex; align-items: center; gap: 12px; font-size: 12px; }
            button { background: #6E7BF2; color: #fff; border: 0; padding: 6px 12px; border-radius: 7px; cursor: pointer; font-size: 12px; }
          `,
          html: `
            <canvas id="sim" width="460" height="190"></canvas>
            <div class="controls">
              <label>Speed <input id="spd" type="range" min="1" max="10" value="4" /></label>
              <button id="ask">Ask Follow-up →</button>
            </div>
          `,
          js: `
            const c = document.getElementById('sim');
            const ctx = c.getContext('2d');
            const spd = document.getElementById('spd');
            let t = 0;
            function frame() {
              ctx.clearRect(0, 0, c.width, c.height);
              ctx.strokeStyle = '#2DD4BF';
              ctx.lineWidth = 2;
              ctx.beginPath();
              for (let x = 0; x < c.width; x += 4) {
                const y = 95 + Math.sin((x * 0.03) + t) * 55;
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              }
              ctx.stroke();
              t += Number(spd.value) * 0.02;
              requestAnimationFrame(frame);
            }
            frame();
            document.getElementById('ask').addEventListener('click', () => {
              window.parent.postMessage({
                type: 'noteit-widget-action',
                action: 'follow-up',
                payload: 'Explain the frequency and amplitude equation behind this wave simulation at speed ' + spd.value
              }, '*');
            });
          `
        }
      }
    }
  }

  if (routed === 'openui') {
    const openuiSource = [
      'root = Card([header, controls, resultRow])',
      'header = Col([Title("Interactive Estimation Calculator"), Caption("Adjust sliders below — values recalculate live in OpenUI Lang")])',
      'controls = Col([',
      '  Row([Label("Base Amount ($)"), Slider($amount, 100, 10000, 100)]),',
      '  Row([Label("Rate (%)"), Slider($rate, 1, 25, 1)]),',
      '  Row([Label("Periods"), Slider($periods, 1, 24, 1)])',
      '])',
      'resultRow = Grid([',
      '  Card([Caption("Base"), Title(@Format("${0}", $amount))]),',
      '  Card([Caption("Projected Total"), Title(@Format("${0}", @Round($amount * (1 + ($rate / 100) * ($periods / 12)))))])',
      '])'
    ].join('\n')

    return {
      prose: `Berikut komponen **OpenUI Lang 1.0** interaktif untuk **"${prompt.slice(0, 60)}"** (hubungkan CLI Bridge atau API key di Settings untuk hasil kustom penuh):`,
      artifact: {
        kind: 'openui',
        title: 'Interactive OpenUI Calculator',
        openuiSource
      }
    }
  }

  return null
}
