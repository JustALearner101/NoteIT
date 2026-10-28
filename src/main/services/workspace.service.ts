import { randomUUID } from 'node:crypto'
import {
  extractPlainTextFromPage,
  getDb,
  getDbPath,
  getJournalMode,
  rebuildAllPageLinks,
  withTransaction
} from '../db/client'
import { INITIAL_SEED_DBML } from '../db/seed'
import {
  getMaxNotebookSortOrder,
  insertNotebook,
  listNotebooks
} from '../db/repository/notebook.repository'
import {
  getMaxSectionSortOrder,
  getSectionCodeState,
  insertSection,
  listSections
} from '../db/repository/section.repository'
import type { SectionRow } from '../db/repository/section.repository'
import {
  deletePageById,
  findPageById,
  getMaxPageSortOrder,
  getPageCodeState,
  insertPage,
  listPages,
  updatePageRow,
  updatePageVersionCount
} from '../db/repository/page.repository'
import { listBacklinks } from '../db/repository/link.repository'
import { insertAlias } from '../db/repository/alias.repository'
import {
  findVersionById,
  insertVersion,
  listVersionsByPage
} from '../db/repository/version.repository'
import {
  countIndexedPages,
  listRecentPages,
  searchByFts,
  searchByLike
} from '../db/repository/search.repository'
import type { PageRow } from '../db/repository/page.repository'
import type { SearchRow } from '../db/repository/search.repository'
import type {
  BacklinkItem,
  MarkerColor,
  Notebook,
  Page,
  PageVersion,
  SearchResultItem,
  Section,
  WorkspaceSnapshot
} from '@shared/types/domain'
import type { CreatePageInput, UpdatePageInput } from '@shared/ipc-channels'

function mapRowToPage(row: PageRow): Page {
  return {
    id: row.id,
    code: row.code,
    sectionId: row.section_id,
    parentPageId: row.parent_page_id || null,
    title: row.title,
    icon: row.icon,
    mode: row.mode as Page['mode'],
    blocks: JSON.parse(row.blocks_json || '[]'),
    canvasData: JSON.parse(
      row.canvas_json || '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'
    ),
    tags: JSON.parse(row.tags_json || '[]'),
    isFavorite: Boolean(row.is_favorite),
    isPinned: Boolean(row.is_pinned),
    sortOrder: row.sort_order,
    versionCount: row.version_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapRowToSection(row: SectionRow): Section {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    name: row.name,
    code: row.code,
    color: row.color as MarkerColor,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function getWorkspaceSnapshot(): WorkspaceSnapshot {
  const notebookRows = listNotebooks()
  const sectionRows = listSections()
  const pageRows = listPages()

  const notebooks: Notebook[] = notebookRows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color as MarkerColor,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }))

  const sections: Section[] = sectionRows.map(mapRowToSection)

  const pages: Page[] = pageRows.map(mapRowToPage)

  const tagCounts = new Map<string, number>()
  for (const p of pages) {
    for (const t of p.tags) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
    }
  }

  const palette: MarkerColor[] = ['cobalt', 'amber', 'teal', 'violet', 'red', 'slate']
  const tags = Array.from(tagCounts.entries()).map(([name, count], idx) => ({
    name,
    color: palette[idx % palette.length],
    count
  }))

  const ftsIndexedPages = countIndexedPages()
  const journalMode = getJournalMode()

  return {
    notebooks,
    sections,
    pages,
    tags,
    stats: {
      sqliteWalActive: journalMode.toLowerCase() === 'wal',
      ftsIndexedPages,
      dbPath: getDbPath()
    }
  }
}

export function createNotebook(input: {
  name: string
  icon: string
  color: MarkerColor
}): Notebook {
  return withTransaction(() => {
    const now = Date.now()
    const id = `nb-${randomUUID()}`

    const notebook: Notebook = {
      id,
      name: input.name.trim() || 'Notebook Baru',
      icon: input.icon || '📘',
      color: input.color || 'cobalt',
      sortOrder: getMaxNotebookSortOrder() + 1,
      createdAt: now,
      updatedAt: now
    }

    insertNotebook(notebook)

    // Automatically create a default Section inside the new Notebook
    createSection({
      notebookId: notebook.id,
      name: 'General Specs',
      color: notebook.color
    })

    return notebook
  })
}

export function createSection(input: {
  notebookId: string
  name: string
  color: MarkerColor
}): Section {
  return withTransaction(() => {
    const now = Date.now()
    const id = `sec-${randomUUID()}`
    const codeState = getSectionCodeState()
    const nextSectionCode = (codeState.maxSuffix > 0 ? codeState.maxSuffix : codeState.total) + 1
    const code = `SEC-${String(nextSectionCode).padStart(2, '0')}`

    const section: Section = {
      id,
      notebookId: input.notebookId,
      name: input.name.trim() || 'Section Baru',
      code,
      color: input.color || 'cobalt',
      sortOrder: getMaxSectionSortOrder() + 1,
      createdAt: now,
      updatedAt: now
    }

    insertSection(section)

    return section
  })
}

const INBOX_SECTION_NAME = 'INBOX'

function findSectionByName(name: string): Section | null {
  const target = name.trim().toLowerCase()
  const row = listSections().find((section) => section.name.trim().toLowerCase() === target)
  return row ? mapRowToSection(row) : null
}

/** Notebook pertama (sortOrder terkecil); dibuat hanya kalau workspace benar-benar kosong. */
function ensureDefaultNotebookId(): string {
  const [firstNotebook] = listNotebooks()
  if (firstNotebook) return firstNotebook.id
  return createNotebook({ name: 'Catatan Pribadi', icon: '📔', color: 'cobalt' }).id
}

function ensureSectionByName(name: string, color: MarkerColor): Section {
  const existing = findSectionByName(name)
  if (existing) return existing
  return createSection({ notebookId: ensureDefaultNotebookId(), name, color })
}

/**
 * Section INBOX adalah rumah semua capture mentah. Quick capture memanggil ini tanpa
 * lewat UI, jadi fungsi harus idempoten: nama dicocokkan case-insensitive + trim.
 */
export function ensureInboxSection(): Section {
  return withTransaction(() => ensureSectionByName(INBOX_SECTION_NAME, 'slate'))
}

export function createPage(input: CreatePageInput): Page {
  return withTransaction(() => {
    const now = Date.now()
    const id = `pg-${randomUUID()}`
    const codeState = getPageCodeState()
    const nextPageCode = (codeState.maxSuffix > 0 ? codeState.maxSuffix : codeState.total) + 1
    const code = `PG-${nextPageCode}`

    const mode = input.mode || (input.template === 'canvas' ? 'canvas' : 'block')
    let blocks: Page['blocks'] = [
      {
        id: `blk-${now}-1`,
        type: 'paragraph',
        content: 'Ketik "/" untuk menyisipkan blok dokumen, skema DBML, diagram Mermaid, atau Gantt Chart...'
      }
    ]

    let canvasData: Page['canvasData'] = {
      nodes: [
        {
          id: `cn-${now}-1`,
          type: 'workCard',
          position: { x: 100, y: 100 },
          data: {
            title: input.title || 'Kartu Spesifikasi Baru',
            content: 'Klik kartu ini untuk mengedit catatan atau tarik garis konektor dari titik sisi kartu.',
            color: 'cobalt',
            cardType: 'note',
            code: 'NODE-01'
          }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    let tags: string[] = ['draft']
    let icon = input.icon || (mode === 'canvas' ? '⊞' : '📄')

    if (input.template === 'dbml') {
      icon = '🗄️'
      tags = ['dbml', 'schema']
      blocks = [
        {
          id: `blk-${now}-1`,
          type: 'callout',
          calloutColor: 'cobalt',
          calloutTitle: 'SPESIFIKASI SKEMA DATABASE (DBML)',
          content: 'Tulis definisi tabel DBML di panel kiri untuk merender diagram relasi secara langsung.'
        },
        {
          id: `blk-${now}-2`,
          type: 'dbml',
          wide: true,
          dbmlViewMode: 'split',
          content: INITIAL_SEED_DBML
        }
      ]
    } else if (input.template === 'roadmap') {
      icon = '📊'
      tags = ['gantt', 'roadmap']
      blocks = [
        {
          id: `blk-${now}-1`,
          type: 'database',
          wide: true,
          content: '',
          databaseTitle: 'JADWAL & MILESTONE PROYEK',
          databaseActiveView: 'gantt',
          databaseChartType: 'bar',
          databaseItems: [
            {
              id: `tsk-${now}-1`,
              code: 'TSK-01',
              title: 'Inisialisasi Spesifikasi & Skema',
              category: 'Architecture',
              color: 'cobalt',
              status: 'in_progress',
              startDate: '2026-10-25',
              endDate: '2026-10-30',
              progress: 50,
              isMilestone: false,
              dependsOn: [],
              assignee: 'Lead Engineer',
              estimateHours: 16
            },
            {
              id: `tsk-${now}-2`,
              code: 'M1',
              title: 'Review Desain & Sign-off',
              category: 'Milestone',
              color: 'amber',
              status: 'backlog',
              startDate: '2026-10-31',
              endDate: '2026-11-01',
              progress: 0,
              isMilestone: true,
              dependsOn: [`tsk-${now}-1`],
              assignee: 'Team',
              estimateHours: 4
            }
          ]
        }
      ]
    } else if (input.template === 'canvas') {
      icon = '⊞'
      tags = ['canvas', 'blueprint']
    }

    const page: Page = {
      id,
      code,
      sectionId: input.sectionId,
      parentPageId: input.parentPageId || null,
      title: input.title.trim() || 'Halaman Tanpa Judul',
      icon,
      mode,
      blocks,
      canvasData,
      tags,
      isFavorite: false,
      isPinned: false,
      sortOrder: getMaxPageSortOrder() + 1,
      versionCount: 1,
      createdAt: now,
      updatedAt: now
    }

    const plainText = extractPlainTextFromPage(page)

    insertPage(page, plainText)
    insertVersion({
      id: `ver-${page.id}-1`,
      pageId: page.id,
      versionNumber: 1,
      title: page.title,
      label: 'Inisialisasi Halaman',
      blocksJson: JSON.stringify(page.blocks),
      canvasJson: JSON.stringify(page.canvasData),
      createdAt: now
    })

    rebuildAllPageLinks(getDb())
    return page
  })
}

// Judul kosong / fallback bukan identitas yang layak dipertahankan sebagai alias.
function isAliasWorthyTitle(title: string): boolean {
  const clean = title.trim()
  return clean.length > 0 && clean !== 'Halaman Tanpa Judul'
}

export function updatePage(input: UpdatePageInput): Page {
  return withTransaction(() => {
    const existingRow = findPageById(input.id)
    if (!existingRow) {
      throw new Error(`Halaman dengan ID '${input.id}' tidak ditemukan di SQLite.`)
    }

    const current = mapRowToPage(existingRow)
    const nextTitle =
      input.title !== undefined ? input.title.trim() || 'Halaman Tanpa Judul' : current.title
    const updated: Page = {
      ...current,
      title: nextTitle,
      icon: input.icon !== undefined ? input.icon : current.icon,
      mode: input.mode !== undefined ? input.mode : current.mode,
      blocks: input.blocks !== undefined ? input.blocks : current.blocks,
      canvasData: input.canvasData !== undefined ? input.canvasData : current.canvasData,
      tags: input.tags !== undefined ? input.tags : current.tags,
      isFavorite: input.isFavorite !== undefined ? input.isFavorite : current.isFavorite,
      isPinned: input.isPinned !== undefined ? input.isPinned : current.isPinned,
      updatedAt: Date.now()
    }

    const plainText = extractPlainTextFromPage(updated)

    updatePageRow(updated, plainText)

    // Rename: judul lama disimpan sebagai alias supaya [[judul lama]] tetap menunjuk page ini.
    if (
      nextTitle !== current.title &&
      isAliasWorthyTitle(current.title) &&
      isAliasWorthyTitle(nextTitle)
    ) {
      insertAlias(current.title, updated.id, updated.updatedAt)
    }

    rebuildAllPageLinks(getDb())
    return updated
  })
}

export function deletePage(pageId: string): { ok: boolean } {
  return withTransaction(() => {
    deletePageById(pageId)
    rebuildAllPageLinks(getDb())
    return { ok: true }
  })
}

export function getBacklinks(pageId: string): BacklinkItem[] {
  const rows = listBacklinks(pageId)

  return rows.map((r) => ({
    sourcePageId: r.source_page_id,
    sourcePageCode: r.source_page_code,
    sourcePageTitle: r.source_page_title,
    sourcePageIcon: r.source_page_icon,
    sectionName: r.section_name,
    sectionColor: r.section_color as MarkerColor,
    contextSnippet: r.context_snippet
  }))
}

export function getPageVersions(pageId: string): PageVersion[] {
  const rows = listVersionsByPage(pageId)

  return rows.map((r) => ({
    id: r.id,
    pageId: r.page_id,
    versionNumber: r.version_number,
    title: r.title,
    label: r.label,
    blocks: JSON.parse(r.blocks_json || '[]'),
    canvasData: JSON.parse(r.canvas_json || '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'),
    createdAt: r.created_at
  }))
}

export function createPageSnapshot(pageId: string, label?: string): PageVersion {
  return withTransaction(() => {
    const pageRow = findPageById(pageId)
    if (!pageRow) {
      throw new Error(`Halaman '${pageId}' tidak ditemukan.`)
    }

    const nextVer = (pageRow.version_count || 1) + 1
    const now = Date.now()
    const id = `ver-${randomUUID()}`
    const snapLabel = label?.trim() || `Snapshot v${nextVer}`

    insertVersion({
      id,
      pageId,
      versionNumber: nextVer,
      title: pageRow.title,
      label: snapLabel,
      blocksJson: pageRow.blocks_json,
      canvasJson: pageRow.canvas_json,
      // Tags halaman saat snapshot diambil; NULL hanya untuk snapshot legacy.
      tagsJson: pageRow.tags_json,
      createdAt: now
    })

    updatePageVersionCount(pageId, nextVer)

    return {
      id,
      pageId,
      versionNumber: nextVer,
      title: pageRow.title,
      label: snapLabel,
      blocks: JSON.parse(pageRow.blocks_json || '[]'),
      canvasData: JSON.parse(pageRow.canvas_json || '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'),
      createdAt: now
    }
  })
}

export function restorePageSnapshot(pageId: string, versionId: string): Page {
  return withTransaction(() => {
    const verRow = findVersionById(versionId, pageId)
    if (!verRow) {
      throw new Error('Snapshot versi tidak ditemukan di SQLite.')
    }

    // Snapshot legacy (tags_json NULL) tidak menyentuh tags halaman: perilaku lama dipertahankan.
    const tags = verRow.tags_json === null ? undefined : JSON.parse(verRow.tags_json)

    return updatePage({
      id: pageId,
      title: verRow.title,
      blocks: JSON.parse(verRow.blocks_json || '[]'),
      canvasData: JSON.parse(verRow.canvas_json || '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'),
      ...(tags !== undefined ? { tags } : {})
    })
  })
}

/**
 * Snippet pencarian di sekitar match.
 *
 * FTS5 mencocokkan prefix ("zettel" cocok dengan "zettelkasten"), sedangkan
 * indexOf(query) tidak: tanpa helper ini snippet jatuh ke 150 karakter awal dan
 * kata yang cocok tidak terlihat. Urutan pencarian posisi: query utuh, lalu token
 * pertama yang ketemu. Kalau sama sekali tidak ada match (mis. hanya cocok lewat
 * stemming), pakai perilaku lama: 150 karakter awal.
 */
function findMatchIndex(text: string, query: string): { index: number; length: number } | null {
  const haystack = text.toLowerCase()
  const whole = query.toLowerCase()
  const wholeIndex = haystack.indexOf(whole)
  if (wholeIndex !== -1) return { index: wholeIndex, length: whole.length }

  for (const token of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const tokenIndex = haystack.indexOf(token)
    if (tokenIndex !== -1) return { index: tokenIndex, length: token.length }
  }

  return null
}

function buildSearchSnippet(text: string, query: string, radius = 70): string {
  const match = findMatchIndex(text, query)
  if (!match) return text.slice(0, 150).replace(/\n+/g, ' ')

  const start = Math.max(0, match.index - radius)
  const end = Math.min(text.length, match.index + match.length + radius)
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim()

  return `${start > 0 ? '...' : ''}${body}${end < text.length ? '...' : ''}`
}

export function searchWorkspace(query: string): SearchResultItem[] {
  const clean = query.trim()

  if (!clean) {
    const recentRows = listRecentPages()

    return recentRows.map((r) => ({
      pageId: r.id,
      pageCode: r.code,
      title: r.title,
      icon: r.icon,
      mode: r.mode as Page['mode'],
      sectionId: r.section_id,
      sectionName: r.section_name,
      sectionColor: r.section_color as MarkerColor,
      notebookName: r.notebook_name,
      snippet: (r.plain_text || '').slice(0, 140),
      tags: JSON.parse(r.tags_json || '[]'),
      updatedAt: r.updated_at
    }))
  }

  // Sanitize FTS5 query tokens and fallback to LIKE if special syntax
  const tokens = clean
    .replace(/["'*(){}[\]^~\\:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t}"*`)
    .join(' AND ')

  let matchedRows: SearchRow[] = []
  if (tokens) {
    try {
      matchedRows = searchByFts(tokens)
    } catch {
      matchedRows = []
    }
  }

  if (matchedRows.length === 0) {
    matchedRows = searchByLike(`%${clean}%`)
  }

  return matchedRows.map((r) => {
    const text: string = r.plain_text || ''
    const snippet = buildSearchSnippet(text, clean)

    return {
      pageId: r.id,
      pageCode: r.code,
      title: r.title,
      icon: r.icon,
      mode: r.mode as Page['mode'],
      sectionId: r.section_id,
      sectionName: r.section_name,
      sectionColor: r.section_color as MarkerColor,
      notebookName: r.notebook_name,
      snippet,
      tags: JSON.parse(r.tags_json || '[]'),
      updatedAt: r.updated_at
    }
  })
}
