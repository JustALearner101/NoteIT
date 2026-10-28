/**
 * Sanitizer SVG untuk diagram (Graphviz).
 *
 * Mermaid memakai `securityLevel: 'loose'`; Graphviz TIDAK. Setiap SVG yang
 * dihasilkan Graphviz harus lewat fungsi ini sebelum masuk ke `dangerouslySetInnerHTML`.
 *
 * Fungsi murni: SVG yang tidak mengandung konstruksi berbahaya dikembalikan
 * byte-identik (tanpa normalisasi, tanpa re-serialize).
 */

/** Elemen berpasangan yang dibuang bersama seluruh isinya. */
const DROP_ELEMENTS = ['foreignObject', 'script'] as const

/**
 * Satu tag pembuka/self-closing. Grup 2 berisi seluruh atribut mentah,
 * termasuk tanda kutip, sehingga `>` di dalam nilai atribut tidak memotong tag.
 */
const TAG_PATTERN = /<([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g

/** Atribut event handler: onload, onclick, onbegin, ... */
const EVENT_HANDLER_PATTERN = /\s+on[a-zA-Z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/g

/** href / xlink:href — nilainya diperiksa terpisah. */
const HREF_PATTERN = /\s+(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/gi

/** Buang pembungkus kutip pada nilai atribut. */
function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/**
 * `javascript:alert(1)`, ` java\nscript:alert(1) `, `JaVaScRiPt:...`
 * semuanya dianggap skema berbahaya.
 */
function isJavascriptUrl(rawValue: string): boolean {
  // eslint-disable-next-line no-control-regex
  const normalized = unquote(rawValue).replace(/[\u0000-\u0020]/g, '').toLowerCase()
  return normalized.startsWith('javascript:')
}

function stripDangerousAttributes(attrs: string): string {
  let out = attrs.replace(EVENT_HANDLER_PATTERN, '')
  out = out.replace(HREF_PATTERN, (match: string, value: string) =>
    isJavascriptUrl(value) ? '' : match
  )
  return out
}

/**
 * Hapus elemen berpasangan beserta isinya, lalu sisa tag yatim (mis. `<script>`
 * tanpa penutup) supaya tidak ada tag berbahaya yang tersisa.
 */
function stripElement(svg: string, name: string): string {
  const paired = new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?<\\/${name}\\s*>`, 'gi')
  const selfClosing = new RegExp(`<${name}\\b[^>]*\\/>`, 'gi')
  const orphanTag = new RegExp(`<\\/?${name}\\b[^>]*>`, 'gi')

  return svg.replace(paired, '').replace(selfClosing, '').replace(orphanTag, '')
}

/**
 * Bersihkan SVG dari vektor XSS: `<script>`, `<foreignObject>`,
 * atribut `on*`, dan `href`/`xlink:href` berskema `javascript:`.
 *
 * Atribut sah (viewBox, width, height, class, style, transform, d, fill, stroke,
 * font-*, marker-*, xmlns) tidak disentuh.
 */
export function sanitizeSvg(svg: string): string {
  if (typeof svg !== 'string' || svg.length === 0) return svg || ''

  let out = svg
  for (const element of DROP_ELEMENTS) {
    out = stripElement(out, element)
  }

  out = out.replace(TAG_PATTERN, (match: string, name: string, attrs: string) => {
    const cleaned = stripDangerousAttributes(attrs)
    return cleaned === attrs ? match : `<${name}${cleaned}>`
  })

  return out
}
