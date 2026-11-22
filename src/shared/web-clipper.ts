import type { DocumentBlock } from './types/domain'

export interface ExtractedWebSection {
  kind: 'heading' | 'paragraph' | 'code' | 'list'
  text: string
  language?: string
}

export interface ExtractedWebDocument {
  url: string
  title: string
  selection?: string
  sections: ExtractedWebSection[]
  plainExcerpt: string
}

export type BrowserSearchEngine = 'google' | 'bing' | 'brave' | 'duckduckgo'

const SEARCH_ENGINE_TEMPLATES: Record<BrowserSearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q='
}

export function normalizeBrowserUrl(
  raw: string,
  searchEngine: BrowserSearchEngine = 'google'
): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'https://ai-sdk.dev/docs/introduction'
  if (/^https?:\/\//i.test(trimmed) || /^about:/i.test(trimmed)) {
    return trimmed
  }
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`
  }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(trimmed) && !trimmed.includes(' ')) {
    return `https://${trimmed}`
  }
  const base = SEARCH_ENGINE_TEMPLATES[searchEngine] || SEARCH_ENGINE_TEMPLATES.google
  return `${base}${encodeURIComponent(trimmed)}`
}

/**
 * Converts a structured DOM extraction into clean NoteIT DocumentBlocks
 * (header callout + structured paragraphs + fenced code blocks with language).
 */
export function buildClipBlocksFromExtraction(
  doc: ExtractedWebDocument,
  now = Date.now()
): DocumentBlock[] {
  const blocks: DocumentBlock[] = [
    {
      id: `blk-clip-hdr-${now}`,
      type: 'callout',
      calloutTitle: `Web Clip: ${doc.title}`,
      calloutColor: 'cobalt',
      content: `Source: ${doc.url}${doc.selection ? `\n\n> ${doc.selection.slice(0, 1200)}` : ''}`
    }
  ]

  if (doc.selection && doc.selection.trim().length > 0) {
    return blocks
  }

  let idx = 0
  let paragraphBuf: string[] = []
  const flushParagraphs = (): void => {
    if (paragraphBuf.length === 0) return
    blocks.push({
      id: `blk-clip-p-${now}-${idx++}`,
      type: 'paragraph',
      content: paragraphBuf.join('\n\n')
    })
    paragraphBuf = []
  }

  for (const sec of doc.sections.slice(0, 30)) {
    const clean = sec.text.trim()
    if (!clean) continue
    if (sec.kind === 'code') {
      flushParagraphs()
      blocks.push({
        id: `blk-clip-code-${now}-${idx++}`,
        type: 'code',
        language: sec.language || 'typescript',
        content: clean.slice(0, 6000)
      })
    } else if (sec.kind === 'heading') {
      flushParagraphs()
      blocks.push({
        id: `blk-clip-h-${now}-${idx++}`,
        type: 'h3',
        content: clean.slice(0, 200)
      })
    } else {
      paragraphBuf.push(clean.slice(0, 1500))
      if (paragraphBuf.length >= 3) {
        flushParagraphs()
      }
    }
  }
  flushParagraphs()

  if (blocks.length === 1 && doc.plainExcerpt.trim()) {
    blocks.push({
      id: `blk-clip-body-${now}`,
      type: 'paragraph',
      content: doc.plainExcerpt.trim().slice(0, 3000)
    })
  }

  return blocks
}

/**
 * Script injected into `<webview>.executeJavaScript` to extract clean article structure
 * (preserving headings, paragraphs, lists, and `<pre><code>` blocks).
 */
export const WEBVIEW_EXTRACT_SCRIPT = `(() => {
  const sel = window.getSelection ? window.getSelection().toString().trim() : '';
  const root = document.querySelector('article, main, [role="main"]') || document.body;
  const sections = [];
  if (root) {
    const nodes = root.querySelectorAll('h1, h2, h3, p, pre, ul, ol');
    const seen = new Set();
    for (const el of nodes) {
      if (sections.length >= 30) break;
      if (el.closest('nav, header, footer, aside')) continue;
      const tag = el.tagName.toLowerCase();
      if (tag === 'pre') {
        const codeEl = el.querySelector('code');
        const cls = (codeEl && codeEl.className) || el.className || '';
        const langMatch = /language-([a-z0-9_+-]+)/i.exec(cls);
        const text = (el.innerText || '').trim();
        if (text.length >= 4 && !seen.has(text)) {
          seen.add(text);
          sections.push({ kind: 'code', text, language: langMatch ? langMatch[1] : 'text' });
        }
      } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        const text = (el.innerText || '').replace(/\\s+/g, ' ').trim();
        if (text.length >= 2 && !seen.has(text)) {
          seen.add(text);
          sections.push({ kind: 'heading', text });
        }
      } else if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(el.querySelectorAll(':scope > li'))
          .map((li) => '- ' + (li.innerText || '').replace(/\\s+/g, ' ').trim())
          .filter((s) => s.length > 2)
          .slice(0, 12);
        const text = items.join('\\n');
        if (text && !seen.has(text)) {
          seen.add(text);
          sections.push({ kind: 'list', text });
        }
      } else {
        const text = (el.innerText || '').replace(/\\s+/g, ' ').trim();
        if (text.length >= 24 && !seen.has(text)) {
          seen.add(text);
          sections.push({ kind: 'paragraph', text });
        }
      }
    }
  }
  const plainExcerpt = root ? (root.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 4000) : '';
  return {
    url: location.href,
    title: document.title || location.hostname,
    selection: sel || undefined,
    sections,
    plainExcerpt
  };
})()`
