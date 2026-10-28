import {
  extractPlainTextFromPage,
  getDb,
  getDbPath,
  getJournalMode,
  rebuildAllPageLinks,
  withTransaction
} from '../db/client'
import { INITIAL_SEED_DBML, INITIAL_SEED_MERMAID } from '../db/seed'
import {
  getMaxNotebookSortOrder,
  insertNotebook,
  listNotebooks
} from '../db/repository/notebook.repository'
import { countSections, insertSection, listSections } from '../db/repository/section.repository'
import {
  countPages,
  deletePageById,
  findPageById,
  insertPage,
  listPages,
  updatePageRow,
  updatePageVersionCount
} from '../db/repository/page.repository'
import { listBacklinks } from '../db/repository/link.repository'
import {
  findVersionById,
  insertVersion,
  listVersionsByPage
} from '../db/repository/version.repository'
import {
  countIndexedPages,
  indexPage,
  listRecentPages,
  removeFromIndex,
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

  const sections: Section[] = sectionRows.map((r) => ({
    id: r.id,
    notebookId: r.notebook_id,
    name: r.name,
    code: r.code,
    color: r.color as MarkerColor,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }))

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
    const id = `nb-${now}`

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
    const id = `sec-${now}`
    const sectionCount = countSections()
    const code = `SEC-${String(sectionCount + 1).padStart(2, '0')}`

    const section: Section = {
      id,
      notebookId: input.notebookId,
      name: input.name.trim() || 'Section Baru',
      code,
      color: input.color || 'cobalt',
      sortOrder: sectionCount + 1,
      createdAt: now,
      updatedAt: now
    }

    insertSection(section)

    return section
  })
}

export function createPage(input: CreatePageInput): Page {
  return withTransaction(() => {
    const now = Date.now()
    const id = `pg-${now}`
    const pageCount = countPages()
    const code = `PG-${101 + pageCount}`

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
      sortOrder: pageCount + 1,
      versionCount: 1,
      createdAt: now,
      updatedAt: now
    }

    const plainText = extractPlainTextFromPage(page)

    insertPage(page, plainText)
    indexPage(page.id, page.title, plainText, page.tags.join(' '))
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

export function updatePage(input: UpdatePageInput): Page {
  return withTransaction(() => {
    const existingRow = findPageById(input.id)
    if (!existingRow) {
      throw new Error(`Halaman dengan ID '${input.id}' tidak ditemukan di SQLite.`)
    }

    const current = mapRowToPage(existingRow)
    const updated: Page = {
      ...current,
      title: input.title !== undefined ? input.title : current.title,
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
    removeFromIndex(updated.id)
    indexPage(updated.id, updated.title, plainText, updated.tags.join(' '))

    rebuildAllPageLinks(getDb())
    return updated
  })
}

export function deletePage(pageId: string): { ok: boolean } {
  return withTransaction(() => {
    removeFromIndex(pageId)
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
    const id = `ver-${pageId}-${now}`
    const snapLabel = label?.trim() || `Snapshot v${nextVer}`

    insertVersion({
      id,
      pageId,
      versionNumber: nextVer,
      title: pageRow.title,
      label: snapLabel,
      blocksJson: pageRow.blocks_json,
      canvasJson: pageRow.canvas_json,
      createdAt: now
    })

    updatePageVersionCount(pageId, nextVer, now)

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

    return updatePage({
      id: pageId,
      title: verRow.title,
      blocks: JSON.parse(verRow.blocks_json || '[]'),
      canvasData: JSON.parse(verRow.canvas_json || '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}')
    })
  })
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
    const idx = text.toLowerCase().indexOf(clean.toLowerCase())
    const start = idx > 30 ? idx - 30 : 0
    const snippet = text.slice(start, start + 150).replace(/\n+/g, ' ')

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
