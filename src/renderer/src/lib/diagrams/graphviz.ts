import { sanitizeSvg } from '@shared/svg-sanitize'

/**
 * Engine layout Graphviz yang diekspos ke UI. Daftar ini subset dari
 * `engines` yang dibawa @viz-js/viz — `nop`/`osage`/`patchwork`/`sfdp`
 * sengaja tidak ditampilkan supaya dropdown tetap ringkas.
 */
export const GRAPHVIZ_ENGINES = ['dot', 'neato', 'fdp', 'circo', 'twopi'] as const

export type GraphvizEngine = (typeof GRAPHVIZ_ENGINES)[number]

export const DEFAULT_GRAPHVIZ_ENGINE: GraphvizEngine = 'dot'

/** Isi awal blok graphviz baru — cukup kecil untuk dirender instan. */
export const DEFAULT_DOT = `digraph G {
  rankdir=LR
  node [shape=box, style="rounded", fontname="JetBrains Mono"]
  edge [color="#64748B"]

  client [label="Renderer"]
  ipc    [label="IPC Bridge"]
  sqlite [label="SQLite WAL"]

  client -> ipc -> sqlite
}`

/** Trim sumber DOT; kosong berarti pakai DEFAULT_DOT supaya preview tidak kosong. */
export function normalizeDotSource(src: string): string {
  const trimmed = (src || '').trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_DOT
}

/** Engine tak dikenal / kosong jatuh ke 'dot'. */
export function resolveGraphvizEngine(value?: string | null): GraphvizEngine {
  const candidate = (value || '').trim().toLowerCase()
  return (GRAPHVIZ_ENGINES as readonly string[]).includes(candidate)
    ? (candidate as GraphvizEngine)
    : DEFAULT_GRAPHVIZ_ENGINE
}

type VizModule = typeof import('@viz-js/viz')
type VizInstance = Awaited<ReturnType<VizModule['instance']>>

let vizPromise: Promise<VizInstance> | null = null

/**
 * `instance()` dari @viz-js/viz tidak memoize — ia meng-compile ulang wasm tiap
 * panggilan. Cache promise-nya supaya mengetik di editor tidak memicu recompile
 * wasm per ketikan.
 */
async function getVizInstance(): Promise<VizInstance> {
  if (!vizPromise) {
    vizPromise = import('@viz-js/viz').then((mod) => mod.instance())
    vizPromise.catch(() => {
      vizPromise = null
    })
  }
  return vizPromise
}

/**
 * Render DOT → SVG (sudah disanitasi).
 *
 * Import @viz-js/viz DINAMIS di dalam fungsi: paket ini membawa wasm inline
 * (~1.2 MB) dan tidak boleh ikut initial chunk renderer.
 *
 * Melempar Error berisi pesan Graphviz bila sintaks DOT tidak valid.
 */
export async function renderGraphvizToSvg(
  src: string,
  engine?: string | null
): Promise<string> {
  const viz = await getVizInstance()
  const result = viz.render(normalizeDotSource(src), {
    format: 'svg',
    engine: resolveGraphvizEngine(engine)
  })

  if (result.status !== 'success' || !result.output) {
    const message =
      result.errors
        ?.filter((error) => error.level !== 'warning')
        .map((error) => error.message)
        .join('\n') || 'Sintaks DOT tidak valid.'
    throw new Error(message)
  }

  return sanitizeSvg(result.output)
}
