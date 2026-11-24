export interface KatexRenderResult {
  html: string
  error: string | null
}

type KatexModule = typeof import('katex')['default']

let cachedKatex: KatexModule | null = null
let katexLoadPromise: Promise<KatexModule> | null = null

/**
 * Dynamically loads KaTeX and its stylesheet on demand so initial editor startup
 * pays zero bundle cost (~497 kB) until a note actually uses `$...$` or a `math` block.
 */
export function loadKatex(): Promise<KatexModule> {
  if (cachedKatex) return Promise.resolve(cachedKatex)
  if (!katexLoadPromise) {
    katexLoadPromise = Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css')
    ]).then(([mod]) => {
      cachedKatex = mod.default
      return cachedKatex
    })
  }
  return katexLoadPromise
}

export function isKatexLoaded(): boolean {
  return cachedKatex !== null
}

/**
 * Safely renders a LaTeX expression synchronously if KaTeX is already loaded,
 * returning `null` if KaTeX still needs to be loaded via `loadKatex()`.
 */
export function renderKatexSync(
  expression: string,
  displayMode: boolean
): KatexRenderResult | null {
  const clean = (expression || '').trim()
  if (!clean) {
    return { html: '', error: null }
  }
  if (!cachedKatex) return null

  try {
    const html = cachedKatex.renderToString(clean, {
      displayMode,
      throwOnError: true,
      strict: 'ignore',
      trust: false,
      output: 'html'
    })
    return { html, error: null }
  } catch (err) {
    const fallbackHtml = cachedKatex.renderToString(clean, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'html'
    })
    const message = err instanceof Error ? err.message : 'Invalid LaTeX syntax'
    return { html: fallbackHtml, error: message }
  }
}
