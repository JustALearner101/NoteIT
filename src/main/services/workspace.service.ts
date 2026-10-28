import {
  extractPlainTextFromPage,
  getDb,
  getDbPath,
  rebuildAllPageLinks
} from '../db/client'
import { INITIAL_SEED_DBML, INITIAL_SEED_MERMAID } from '../db/seed'
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

function mapRowToPage(row: any): Page {
  return {
    id: row.id,
    code: row.code,
    sectionId: row.section_id,
    parentPageId: row.parent_page_id || null,
    title: row.title,
    icon: row.icon,
    mode: row.mode,
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
  const db = getDb()

  const notebookRows = db
    .prepare('SELECT * FROM notebooks ORDER BY sort_order ASC, created_at ASC')
    .all() as any[]
  const sectionRows = db
    .prepare('SELECT * FROM sections ORDER BY sort_order ASC, created_at ASC')
    .all() as any[]
  const pageRows = db
    .prepare('SELECT * FROM pages ORDER BY sort_order ASC, created_at ASC')
    .all() as any[]

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

  const ftsCountRow = db.prepare('SELECT COUNT(*) as cnt FROM pages_fts').get() as { cnt: number }
  const journalRow = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }

  return {
    notebooks,
    sections,
    pages,
    tags,
    stats: {
      sqliteWalActive: journalRow?.journal_mode?.toLowerCase() === 'wal',
      ftsIndexedPages: ftsCountRow?.cnt ?? pages.length,
      dbPath: getDbPath()
    }
  }
}

export function createNotebook(input: {
  name: string
  icon: string
  color: MarkerColor
}): Notebook {
  const db = getDb()
  const now = Date.now()
  const id = `nb-${now}`
  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM notebooks')
    .get() as { maxOrder: number }

  const notebook: Notebook = {
    id,
    name: input.name.trim() || 'Notebook Baru',
    icon: input.icon || '📘',
    color: input.color || 'cobalt',
    sortOrder: (maxOrderRow?.maxOrder || 0) + 1,
    createdAt: now,
    updatedAt: now
  }

  db.prepare(
    `INSERT INTO notebooks (id, name, icon, color, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    notebook.id,
    notebook.name,
    notebook.icon,
    notebook.color,
    notebook.sortOrder,
    notebook.createdAt,
    notebook.updatedAt
  )

  // Automatically create a default Section inside the new Notebook
  createSection({
    notebookId: notebook.id,
    name: 'General Specs',
    color: notebook.color
  })

  return notebook
}

export function createSection(input: {
  notebookId: string
  name: string
  color: MarkerColor
}): Section {
  const db = getDb()
  const now = Date.now()
  const id = `sec-${now}`
  const countRow = db
    .prepare('SELECT COUNT(*) as cnt FROM sections')
    .get() as { cnt: number }
  const code = `SEC-${String((countRow?.cnt || 0) + 1).padStart(2, '0')}`

  const section: Section = {
    id,
    notebookId: input.notebookId,
    name: input.name.trim() || 'Section Baru',
    code,
    color: input.color || 'cobalt',
    sortOrder: (countRow?.cnt || 0) + 1,
    createdAt: now,
    updatedAt: now
  }

  db.prepare(
    `INSERT INTO sections (id, notebook_id, name, code, color, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    section.id,
    section.notebookId,
    section.name,
    section.code,
    section.color,
    section.sortOrder,
    section.createdAt,
    section.updatedAt
  )

  return section
}

export function createPage(input: CreatePageInput): Page {
  const db = getDb()
  const now = Date.now()
  const id = `pg-${now}`

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM pages').get() as { cnt: number }
  const code = `PG-${101 + (countRow?.cnt || 0)}`

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
    sortOrder: (countRow?.cnt || 0) + 1,
    versionCount: 1,
    createdAt: now,
    updatedAt: now
  }

  const plainText = extractPlainTextFromPage(page)

  db.prepare(
    `INSERT INTO pages (
      id, code, section_id, parent_page_id, title, icon, mode,
      blocks_json, canvas_json, plain_text, tags_json,
      is_favorite, is_pinned, sort_order, version_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    page.id,
    page.code,
    page.sectionId,
    page.parentPageId,
    page.title,
    page.icon,
    page.mode,
    JSON.stringify(page.blocks),
    JSON.stringify(page.canvasData),
    plainText,
    JSON.stringify(page.tags),
    0,
    0,
    page.sortOrder,
    1,
    page.createdAt,
    page.updatedAt
  )

  db.prepare('INSERT INTO pages_fts (page_id, title, plain_text, tags) VALUES (?, ?, ?, ?)').run(
    page.id,
    page.title,
    plainText,
    page.tags.join(' ')
  )

  db.prepare(
    `INSERT INTO page_versions (id, page_id, version_number, title, label, blocks_json, canvas_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `ver-${page.id}-1`,
    page.id,
    1,
    page.title,
    'Inisialisasi Halaman',
    JSON.stringify(page.blocks),
    JSON.stringify(page.canvasData),
    now
  )

  rebuildAllPageLinks(db)
  return page
}

export function updatePage(input: UpdatePageInput): Page {
  const db = getDb()
  const existingRow = db.prepare('SELECT * FROM pages WHERE id = ?').get(input.id) as any
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

  db.prepare(
    `UPDATE pages SET
      title = ?,
      icon = ?,
      mode = ?,
      blocks_json = ?,
      canvas_json = ?,
      plain_text = ?,
      tags_json = ?,
      is_favorite = ?,
      is_pinned = ?,
      updated_at = ?
     WHERE id = ?`
  ).run(
    updated.title,
    updated.icon,
    updated.mode,
    JSON.stringify(updated.blocks),
    JSON.stringify(updated.canvasData),
    plainText,
    JSON.stringify(updated.tags),
    updated.isFavorite ? 1 : 0,
    updated.isPinned ? 1 : 0,
    updated.updatedAt,
    updated.id
  )

  db.prepare('DELETE FROM pages_fts WHERE page_id = ?').run(updated.id)
  db.prepare('INSERT INTO pages_fts (page_id, title, plain_text, tags) VALUES (?, ?, ?, ?)').run(
    updated.id,
    updated.title,
    plainText,
    updated.tags.join(' ')
  )

  rebuildAllPageLinks(db)
  return updated
}

export function deletePage(pageId: string): { ok: boolean } {
  const db = getDb()
  db.prepare('DELETE FROM pages_fts WHERE page_id = ?').run(pageId)
  db.prepare('DELETE FROM pages WHERE id = ?').run(pageId)
  rebuildAllPageLinks(db)
  return { ok: true }
}

export function getBacklinks(pageId: string): BacklinkItem[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT
        pl.source_page_id,
        pl.context_snippet,
        p.code as source_page_code,
        p.title as source_page_title,
        p.icon as source_page_icon,
        s.name as section_name,
        s.color as section_color
       FROM page_links pl
       JOIN pages p ON p.id = pl.source_page_id
       JOIN sections s ON s.id = p.section_id
       WHERE pl.target_page_id = ?
       ORDER BY p.updated_at DESC`
    )
    .all(pageId) as any[]

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
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM page_versions WHERE page_id = ? ORDER BY version_number DESC')
    .all(pageId) as any[]

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
  const db = getDb()
  const pageRow = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId) as any
  if (!pageRow) {
    throw new Error(`Halaman '${pageId}' tidak ditemukan.`)
  }

  const nextVer = (pageRow.version_count || 1) + 1
  const now = Date.now()
  const id = `ver-${pageId}-${now}`
  const snapLabel = label?.trim() || `Snapshot v${nextVer}`

  db.prepare(
    `INSERT INTO page_versions (id, page_id, version_number, title, label, blocks_json, canvas_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    pageId,
    nextVer,
    pageRow.title,
    snapLabel,
    pageRow.blocks_json,
    pageRow.canvas_json,
    now
  )

  db.prepare('UPDATE pages SET version_count = ?, updated_at = ? WHERE id = ?').run(
    nextVer,
    now,
    pageId
  )

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
}

export function restorePageSnapshot(pageId: string, versionId: string): Page {
  const db = getDb()
  const verRow = db
    .prepare('SELECT * FROM page_versions WHERE id = ? AND page_id = ?')
    .get(versionId, pageId) as any
  if (!verRow) {
    throw new Error('Snapshot versi tidak ditemukan di SQLite.')
  }

  return updatePage({
    id: pageId,
    title: verRow.title,
    blocks: JSON.parse(verRow.blocks_json || '[]'),
    canvasData: JSON.parse(verRow.canvas_json || '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}')
  })
}

export function searchWorkspace(query: string): SearchResultItem[] {
  const db = getDb()
  const clean = query.trim()

  if (!clean) {
    const recentRows = db
      .prepare(
        `SELECT p.*, s.name as section_name, s.color as section_color, n.name as notebook_name
         FROM pages p
         JOIN sections s ON s.id = p.section_id
         JOIN notebooks n ON n.id = s.notebook_id
         ORDER BY p.updated_at DESC
         LIMIT 12`
      )
      .all() as any[]

    return recentRows.map((r) => ({
      pageId: r.id,
      pageCode: r.code,
      title: r.title,
      icon: r.icon,
      mode: r.mode,
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

  let matchedRows: any[] = []
  if (tokens) {
    try {
      matchedRows = db
        .prepare(
          `SELECT
            p.*,
            s.name as section_name,
            s.color as section_color,
            n.name as notebook_name
           FROM pages_fts f
           JOIN pages p ON p.id = f.page_id
           JOIN sections s ON s.id = p.section_id
           JOIN notebooks n ON n.id = s.notebook_id
           WHERE pages_fts MATCH ?
           ORDER BY rank
           LIMIT 20`
        )
        .all(tokens) as any[]
    } catch {
      matchedRows = []
    }
  }

  if (matchedRows.length === 0) {
    const likePattern = `%${clean}%`
    matchedRows = db
      .prepare(
        `SELECT
          p.*,
          s.name as section_name,
          s.color as section_color,
          n.name as notebook_name
         FROM pages p
         JOIN sections s ON s.id = p.section_id
         JOIN notebooks n ON n.id = s.notebook_id
         WHERE p.title LIKE ? OR p.plain_text LIKE ? OR p.code LIKE ?
         ORDER BY p.updated_at DESC
         LIMIT 20`
      )
      .all(likePattern, likePattern, likePattern) as any[]
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
      mode: r.mode,
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
