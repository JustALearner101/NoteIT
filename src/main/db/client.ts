import fs from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import { getSeedData } from './seed'
import type { Page } from '@shared/types/domain'

let dbInstance: DatabaseSync | null = null
let currentDbPath = ''

export function extractPlainTextFromPage(page: Pick<Page, 'title' | 'blocks' | 'canvasData' | 'tags'>): string {
  const parts: string[] = [page.title]

  for (const b of page.blocks || []) {
    if (b.content) parts.push(b.content)
    if (b.calloutTitle) parts.push(b.calloutTitle)
    if (b.databaseTitle) parts.push(b.databaseTitle)
    if (b.databaseItems) {
      for (const item of b.databaseItems) {
        parts.push(`${item.code} ${item.title} ${item.category} ${item.assignee}`)
      }
    }
  }

  for (const node of page.canvasData?.nodes || []) {
    if (node.data?.title) parts.push(node.data.title)
    if (node.data?.content) parts.push(node.data.content)
    if (node.data?.code) parts.push(node.data.code)
  }

  if (page.tags?.length) {
    parts.push(page.tags.join(' '))
  }

  return parts.join('\n')
}

export function extractWikiLinkTitles(page: Pick<Page, 'blocks' | 'canvasData'>): {
  targetTitle: string
  snippet: string
}[] {
  const found: { targetTitle: string; snippet: string }[] = []
  const regex = /\[\[([^\]]+)\]\]/g

  const scanText = (text: string): void => {
    if (!text) return
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const targetTitle = match[1].trim()
      if (targetTitle) {
        found.push({
          targetTitle,
          snippet: text.length > 140 ? text.slice(0, 140) + '...' : text
        })
      }
    }
  }

  for (const block of page.blocks || []) {
    scanText(block.content)
  }
  for (const node of page.canvasData?.nodes || []) {
    scanText(node.data?.content || '')
  }

  return found
}

export function initDatabase(workspaceDir: string): DatabaseSync {
  if (dbInstance) return dbInstance

  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true })
  }

  currentDbPath = path.join(workspaceDir, 'noteit-v2.db')
  const db = new DatabaseSync(currentDbPath)

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      parent_page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      icon TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'block',
      blocks_json TEXT NOT NULL,
      canvas_json TEXT NOT NULL,
      plain_text TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      version_count INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_versions (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      label TEXT NOT NULL,
      blocks_json TEXT NOT NULL,
      canvas_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_links (
      source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      context_snippet TEXT NOT NULL,
      PRIMARY KEY (source_page_id, target_page_id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
      page_id UNINDEXED,
      title,
      plain_text,
      tags
    );

    CREATE TRIGGER IF NOT EXISTS pages_fts_ai AFTER INSERT ON pages BEGIN
      INSERT INTO pages_fts (page_id, title, plain_text, tags)
      VALUES (new.id, new.title, new.plain_text, new.tags_json);
    END;

    CREATE TRIGGER IF NOT EXISTS pages_fts_au
    AFTER UPDATE OF title, plain_text, tags_json ON pages BEGIN
      DELETE FROM pages_fts WHERE page_id = old.id;
      INSERT INTO pages_fts (page_id, title, plain_text, tags)
      VALUES (new.id, new.title, new.plain_text, new.tags_json);
    END;

    CREATE TRIGGER IF NOT EXISTS pages_fts_ad AFTER DELETE ON pages BEGIN
      DELETE FROM pages_fts WHERE page_id = old.id;
    END;
  `)

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM notebooks').get() as { cnt: number }
  if (!countRow || countRow.cnt === 0) {
    seedInitialWorkspace(db)
  }

  dbInstance = db
  return db
}

function seedInitialWorkspace(db: DatabaseSync): void {
  const { notebooks, sections, pages } = getSeedData()

  const insertNotebook = db.prepare(`
    INSERT INTO notebooks (id, name, icon, color, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  for (const nb of notebooks) {
    insertNotebook.run(
      nb.id,
      nb.name,
      nb.icon,
      nb.color,
      nb.sortOrder,
      nb.createdAt,
      nb.updatedAt
    )
  }

  const insertSection = db.prepare(`
    INSERT INTO sections (id, notebook_id, name, code, color, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const sec of sections) {
    insertSection.run(
      sec.id,
      sec.notebookId,
      sec.name,
      sec.code,
      sec.color,
      sec.sortOrder,
      sec.createdAt,
      sec.updatedAt
    )
  }

  const insertPage = db.prepare(`
    INSERT INTO pages (
      id, code, section_id, parent_page_id, title, icon, mode,
      blocks_json, canvas_json, plain_text, tags_json,
      is_favorite, is_pinned, sort_order, version_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertVersion = db.prepare(`
    INSERT INTO page_versions (id, page_id, version_number, title, label, blocks_json, canvas_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const pg of pages) {
    const plainText = extractPlainTextFromPage(pg)
    const blocksJson = JSON.stringify(pg.blocks)
    const canvasJson = JSON.stringify(pg.canvasData)
    const tagsJson = JSON.stringify(pg.tags)

    insertPage.run(
      pg.id,
      pg.code,
      pg.sectionId,
      pg.parentPageId,
      pg.title,
      pg.icon,
      pg.mode,
      blocksJson,
      canvasJson,
      plainText,
      tagsJson,
      pg.isFavorite ? 1 : 0,
      pg.isPinned ? 1 : 0,
      pg.sortOrder,
      pg.versionCount,
      pg.createdAt,
      pg.updatedAt
    )

    insertVersion.run(
      `ver-${pg.id}-1`,
      pg.id,
      pg.versionCount,
      pg.title,
      'Baseline Arsitektur Awal',
      blocksJson,
      canvasJson,
      pg.updatedAt
    )
  }

  rebuildAllPageLinks(db)
}

export function rebuildAllPageLinks(db: DatabaseSync): void {
  db.exec('DELETE FROM page_links;')

  const rows = db
    .prepare('SELECT id, title, blocks_json, canvas_json FROM pages')
    .all() as Array<{
    id: string
    title: string
    blocks_json: string
    canvas_json: string
  }>

  const titleToId = new Map<string, string>()
  for (const r of rows) {
    titleToId.set(r.title.toLowerCase().trim(), r.id)
  }

  const insertLink = db.prepare(`
    INSERT OR REPLACE INTO page_links (source_page_id, target_page_id, context_snippet)
    VALUES (?, ?, ?)
  `)

  for (const r of rows) {
    const blocks = JSON.parse(r.blocks_json || '[]')
    const canvasData = JSON.parse(r.canvas_json || '{"nodes":[],"edges":[]}')
    const refs = extractWikiLinkTitles({ blocks, canvasData })
    for (const ref of refs) {
      const targetId = titleToId.get(ref.targetTitle.toLowerCase().trim())
      if (targetId && targetId !== r.id) {
        insertLink.run(r.id, targetId, ref.snippet)
      }
    }
  }
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    throw new Error('SQLite Database has not been initialized yet.')
  }
  return dbInstance
}

export function getDbPath(): string {
  return currentDbPath
}

export function getJournalMode(): string {
  const row = getDb().prepare('PRAGMA journal_mode').get() as { journal_mode: string } | undefined
  return row?.journal_mode || ''
}

let transactionDepth = 0

export function withTransaction<T>(fn: () => T): T {
  // DatabaseSync is synchronous, so nested calls simply join the outer transaction.
  if (transactionDepth > 0) {
    return fn()
  }

  const db = getDb()
  db.exec('BEGIN')
  transactionDepth = 1

  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // Keep the original failure: a rollback error must not mask it.
    }
    throw error
  } finally {
    transactionDepth = 0
  }
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
  currentDbPath = ''
  transactionDepth = 0
}
