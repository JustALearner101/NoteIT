import { assetRelativePath } from '@shared/assets'
import type { DocumentBlock, Page, WorkspaceSnapshot } from '@shared/types/domain'

const MAX_SLUG_LENGTH = 60

/**
 * Ubah judul jadi slug: lowercase, non-alfanumerik menjadi '-', maksimal 60 karakter.
 */
export function slugifyTitle(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')
}

/**
 * Timestamp lokal YYYYMMDD-HHmmss untuk nama berkas/folder ekspor.
 */
export function formatTimestamp(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('')
}

function yamlString(value: string): string {
  // JSON string literal adalah YAML double-quoted yang valid, jadi aman untuk tanda kutip dan newline.
  return JSON.stringify(value ?? '')
}

function buildFrontmatter(page: Page): string {
  const tags = page.tags?.length
    ? `[${page.tags.map((tag) => yamlString(tag)).join(', ')}]`
    : '[]'

  return [
    '---',
    `title: ${yamlString(page.title)}`,
    `code: ${yamlString(page.code)}`,
    `mode: ${page.mode}`,
    `tags: ${tags}`,
    `updatedAt: ${new Date(page.updatedAt).toISOString()}`,
    '---'
  ].join('\n')
}

function tableCell(value: string | number): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}

function renderCallout(block: DocumentBlock): string {
  const lines: string[] = []
  const title = block.calloutTitle?.trim()
  if (title) {
    lines.push(`> **${title}**`)
    if (block.content) lines.push('>')
  }
  for (const line of (block.content || '').split('\n')) {
    lines.push(line.length > 0 ? `> ${line}` : '>')
  }
  return lines.join('\n')
}

function renderDatabase(block: DocumentBlock): string {
  const items = block.databaseItems || []
  const lines: string[] = [`### ${block.databaseTitle?.trim() || 'Database'}`, '']

  if (items.length === 0) {
    lines.push('_Belum ada item pada database block ini._')
    return lines.join('\n')
  }

  lines.push('| Code | Title | Status | Start | End | Progress | Assignee |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const item of items) {
    lines.push(
      `| ${[
        item.code,
        item.title,
        item.status,
        item.startDate,
        item.endDate,
        `${item.progress}%`,
        item.assignee
      ]
        .map(tableCell)
        .join(' | ')} |`
    )
  }

  const milestones = items.filter((item) => item.isMilestone)
  if (milestones.length > 0) {
    lines.push('', '**Milestone:**')
    for (const milestone of milestones) {
      const suffix = milestone.endDate ? ` (${milestone.endDate})` : ''
      lines.push(`- ${milestone.code} ${milestone.title}${suffix}`)
    }
  }

  const codeById = new Map(items.map((item) => [item.id, item.code]))
  const withDependencies = items.filter((item) => item.dependsOn?.length > 0)
  if (withDependencies.length > 0) {
    lines.push('', '**Dependencies:**')
    for (const item of withDependencies) {
      const targets = item.dependsOn.map((id) => codeById.get(id) || id).join(', ')
      lines.push(`- ${item.code} depends on ${targets}`)
    }
  }

  return lines.join('\n')
}

/** Aset yang dipakai satu halaman, siap disalin ke folder assets/ hasil ekspor. */
export interface PageAssetRef {
  assetId: string
  ext: string
  name: string
  mime: string
  relativePath: string
}

/**
 * Kumpulan aset unik yang direferensikan blok image/file sebuah halaman.
 * Blok tanpa assetId/assetExt dilewati: tidak ada berkas yang bisa diekspor.
 */
export function collectPageAssets(page: Pick<Page, 'blocks'>): PageAssetRef[] {
  const assets = new Map<string, PageAssetRef>()

  for (const block of page.blocks || []) {
    // Header 'columns' tidak pernah punya aset; hanya blok image/file yang dicek.
    if (block.type !== 'image' && block.type !== 'file') continue
    if (!block.assetId || !block.assetExt) continue
    if (assets.has(block.assetId)) continue

    assets.set(block.assetId, {
      assetId: block.assetId,
      ext: block.assetExt,
      name: block.assetName || block.content || block.assetId,
      mime: block.assetMime || '',
      relativePath: assetRelativePath(block.assetId, block.assetExt)
    })
  }

  return Array.from(assets.values())
}

/** Satu blok -> potongan Markdown. Header grup kolom sengaja kosong. */
export function renderBlock(block: DocumentBlock): string {
  const content = block.content || ''

  switch (block.type) {
    case 'h1':
      return `# ${content}`
    case 'h2':
      return `## ${content}`
    case 'h3':
      return `### ${content}`
    case 'paragraph':
      return content
    case 'checklist':
      return `- [${block.checked ? 'x' : ' '}] ${content}`
    case 'callout':
      return renderCallout(block)
    case 'code':
      return ['```' + (block.language || ''), content, '```'].join('\n')
    case 'dbml':
      return ['```dbml', content, '```'].join('\n')
    case 'mermaid':
      return ['```mermaid', content, '```'].join('\n')
    case 'graphviz':
      return ['```dot', content, '```'].join('\n')
    case 'database':
      return renderDatabase(block)
    case 'columns':
      // Header grup hanya metadata; anak-anaknya dirender sebagai blok biasa.
      // String kosong membuat pageToMarkdown melewatinya (tanpa paragraf kosong).
      return ''
    case 'image': {
      if (!block.assetId || !block.assetExt) return content
      const alt = block.assetName || content || 'gambar'
      return `![${alt}](${assetRelativePath(block.assetId, block.assetExt)})`
    }
    case 'file': {
      if (!block.assetId || !block.assetExt) return content
      const label = block.assetName || content || 'berkas'
      return `[${label}](${assetRelativePath(block.assetId, block.assetExt)})`
    }
    default:
      return content
  }
}

function renderCanvas(page: Page): string {
  const nodes = page.canvasData?.nodes || []
  const edges = page.canvasData?.edges || []
  const lines: string[] = ['## Canvas', '']

  if (nodes.length === 0 && edges.length === 0) {
    lines.push('_Kanvas kosong._')
    return lines.join('\n')
  }

  const titleById = new Map(nodes.map((node) => [node.id, node.data?.title || node.id]))

  lines.push('### Nodes', '')
  if (nodes.length === 0) {
    lines.push('_Tidak ada node._')
  }
  for (const node of nodes) {
    const data = node.data
    const parts: string[] = [`**${data?.title || node.id}**`]
    if (data?.cardType) parts.push(`(${data.cardType})`)
    if (data?.content) parts.push(`— ${data.content}`)
    if (data?.code) parts.push(`· code: \`${data.code}\``)
    if (data?.metricValue) parts.push(`· nilai: ${data.metricValue}`)
    if (data?.metricDelta) parts.push(`· delta: ${data.metricDelta}`)
    lines.push(`- ${parts.join(' ')}`)
  }

  if (edges.length > 0) {
    lines.push('', '### Edges', '')
    for (const edge of edges) {
      const source = titleById.get(edge.source) || edge.source
      const target = titleById.get(edge.target) || edge.target
      const label = edge.label ? ` — ${edge.label}` : ''
      lines.push(`- ${source} → ${target}${label}`)
    }
  }

  return lines.join('\n')
}

export function pageToMarkdown(page: Page): string {
  const parts: string[] = [buildFrontmatter(page)]

  for (const block of page.blocks || []) {
    const rendered = renderBlock(block)
    if (rendered.trim().length > 0) parts.push(rendered)
  }

  if (page.mode === 'canvas') {
    parts.push(renderCanvas(page))
  }

  return parts.join('\n\n') + '\n'
}

export function workspaceToMarkdownFiles(
  snapshot: WorkspaceSnapshot
): { filename: string; content: string }[] {
  const usedNames = new Set<string>()

  return (snapshot.pages || []).map((page) => {
    const slug = slugifyTitle(page.title) || slugifyTitle(page.code) || 'untitled'
    const base = `${page.code}-${slug}`

    let filename = `${base}.md`
    let counter = 2
    while (usedNames.has(filename.toLowerCase())) {
      filename = `${base}-${counter}.md`
      counter += 1
    }
    usedNames.add(filename.toLowerCase())

    return { filename, content: pageToMarkdown(page) }
  })
}
