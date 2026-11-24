import fs from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import { getSeedData } from './seed'
import { parseCodeWikiLink } from '@shared/code-wikilink'
import type { Page } from '@shared/types/domain'

let dbInstance: DatabaseSync | null = null
let currentDbPath = ''

export function extractPlainTextFromPage(page: Pick<Page, 'title' | 'blocks' | 'canvasData' | 'tags'>): string {
  const parts: string[] = [page.title]

  for (const b of page.blocks || []) {
    // Header grup kolom dan divider tidak punya teks konten.
    if (b.type === 'columns' || b.type === 'divider') continue
    if (b.content) parts.push(b.content)
    if (b.calloutTitle) parts.push(b.calloutTitle)
    if (b.toggleTitle) parts.push(b.toggleTitle)
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
      if (targetTitle && parseCodeWikiLink(targetTitle) === null) {
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

    CREATE TABLE IF NOT EXISTS page_aliases (
      alias TEXT NOT NULL,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (alias, page_id)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      ext TEXT NOT NULL,
      mime TEXT NOT NULL,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets (created_at);

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

  // Migrasi aditif & idempoten: page_versions.tags_json. Kolom sengaja NULLABLE tanpa
  // DEFAULT supaya snapshot legacy (NULL) tetap bisa dibedakan dari snapshot tanpa tag ('[]').
  const versionColumns = db.prepare('PRAGMA table_info(page_versions)').all() as Array<{
    name: string
  }>
  if (!versionColumns.some((column) => column.name === 'tags_json')) {
    db.exec('ALTER TABLE page_versions ADD COLUMN tags_json TEXT')
  }

  // Migrasi aditif ADE Pilar 1: repo_path & default_branch di notebooks
  const notebookColumns = db.prepare('PRAGMA table_info(notebooks)').all() as Array<{ name: string }>
  if (!notebookColumns.some((col) => col.name === 'repo_path')) {
    db.exec('ALTER TABLE notebooks ADD COLUMN repo_path TEXT DEFAULT NULL')
  }
  if (!notebookColumns.some((col) => col.name === 'default_branch')) {
    db.exec("ALTER TABLE notebooks ADD COLUMN default_branch TEXT DEFAULT 'main'")
  }

  // Migrasi aditif ADE Pilar 1: repo_path_override di sections
  const sectionColumns = db.prepare('PRAGMA table_info(sections)').all() as Array<{ name: string }>
  if (!sectionColumns.some((col) => col.name === 'repo_path_override')) {
    db.exec('ALTER TABLE sections ADD COLUMN repo_path_override TEXT DEFAULT NULL')
  }

  // Tabel Sesi Agen & Worktree (Agent Mission Control Persistence)
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      section_id TEXT REFERENCES sections(id) ON DELETE SET NULL,
      page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
      task_code TEXT DEFAULT NULL,
      title TEXT NOT NULL,
      agent_preset TEXT NOT NULL,
      command TEXT NOT NULL,
      approval_mode TEXT NOT NULL,
      isolation_mode TEXT NOT NULL,
      repo_path TEXT NOT NULL,
      worktree_path TEXT DEFAULT NULL,
      branch_name TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      files_changed INTEGER NOT NULL DEFAULT 0,
      lines_added INTEGER NOT NULL DEFAULT 0,
      lines_removed INTEGER NOT NULL DEFAULT 0,
      last_output_tail TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport TEXT NOT NULL DEFAULT 'stdio',
      command TEXT NOT NULL DEFAULT '',
      args_json TEXT NOT NULL DEFAULT '[]',
      url TEXT NOT NULL DEFAULT '',
      env_keys_json TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      require_approval INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS secrets (
      key TEXT PRIMARY KEY,
      ciphertext_base64 TEXT NOT NULL,
      encryption_scheme TEXT NOT NULL DEFAULT 'dpapi',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_provider_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      base_url TEXT NOT NULL DEFAULT '',
      default_model TEXT NOT NULL DEFAULT '',
      extra_headers_json TEXT NOT NULL DEFAULT '{}',
      cli_command TEXT NOT NULL DEFAULT '',
      cli_args_json TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS browser_bookmarks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      notebook_id TEXT DEFAULT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learn_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'teach',
      phase TEXT NOT NULL DEFAULT 'probe',
      source_page_ids_json TEXT NOT NULL DEFAULT '[]',
      source_url TEXT NOT NULL DEFAULT '',
      source_excerpt TEXT NOT NULL DEFAULT '',
      plan_mermaid TEXT NOT NULL DEFAULT '',
      active_node_id TEXT NOT NULL DEFAULT '',
      visited_nodes_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learn_turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES learn_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      phase TEXT NOT NULL,
      card_kind TEXT NOT NULL DEFAULT 'message',
      content TEXT NOT NULL,
      thinking_text TEXT NOT NULL DEFAULT '',
      confidence INTEGER DEFAULT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learn_side_threads (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES learn_sessions(id) ON DELETE CASCADE,
      anchor_turn_id TEXT NOT NULL DEFAULT '',
      selected_quote TEXT NOT NULL DEFAULT '',
      messages_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kg_propositions (
      id TEXT PRIMARY KEY,
      statement TEXT NOT NULL,
      domain_tag TEXT NOT NULL DEFAULT 'General',
      source_session_id TEXT DEFAULT NULL,
      source_page_id TEXT DEFAULT NULL,
      pos_x REAL NOT NULL DEFAULT 0,
      pos_y REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kg_chains (
      id TEXT PRIMARY KEY,
      premise_ids_json TEXT NOT NULL DEFAULT '[]',
      conclusion_id TEXT NOT NULL REFERENCES kg_propositions(id) ON DELETE CASCADE,
      relation_label TEXT NOT NULL DEFAULT 'entails',
      source_session_id TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      studio_mode TEXT NOT NULL DEFAULT 'chat',
      chat_mode TEXT NOT NULL DEFAULT 'Free chat',
      ui_mode TEXT NOT NULL DEFAULT 'auto',
      provider_id TEXT NOT NULL DEFAULT '',
      model_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning_text TEXT NOT NULL DEFAULT '',
      ui_payload_json TEXT NOT NULL DEFAULT '',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      tool_calls_json TEXT NOT NULL DEFAULT '[]',
      proposals_json TEXT NOT NULL DEFAULT '[]',
      telemetry_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_embeddings (
      page_id TEXT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
      content_hash TEXT NOT NULL,
      model_id TEXT NOT NULL,
      vector_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)

  dbInstance = db
  return db
}

export function seedInitialWorkspace(db: DatabaseSync): void {
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
    INSERT INTO page_versions (id, page_id, version_number, title, label, blocks_json, canvas_json, tags_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      tagsJson,
      pg.updatedAt
    )
  }

  rebuildAllPageLinks(db)
}

export function rebuildAllPageLinks(db: DatabaseSync): void {
  db.exec('DELETE FROM page_links;')

  // Tiebreak rowid = urutan insert SQLite: created_at bisa kembar dalam milidetik yang sama,
  // sedangkan id sekarang UUID acak sehingga tidak deterministik sebagai penentu pemenang tie.
  const rows = db
    .prepare(
      'SELECT id, title, blocks_json, canvas_json FROM pages ORDER BY created_at ASC, rowid ASC'
    )
    .all() as Array<{
    id: string
    title: string
    blocks_json: string
    canvas_json: string
  }>

  // Judul aktif selalu menang: alias hanya dipakai kalau judul itu tidak dipakai page mana pun.
  const titleToId = new Map<string, string>()
  for (const r of rows) {
    const key = r.title.toLowerCase().trim()
    // Judul ganda: halaman yang lebih dulu ada memegang judul itu.
    if (key && !titleToId.has(key)) titleToId.set(key, r.id)
  }

  const aliasRows = db
    .prepare('SELECT alias, page_id FROM page_aliases ORDER BY created_at ASC, alias ASC')
    .all() as Array<{ alias: string; page_id: string }>

  const aliasToId = new Map<string, string>()
  for (const a of aliasRows) {
    const key = a.alias.toLowerCase().trim()
    if (!key || titleToId.has(key) || aliasToId.has(key)) continue
    aliasToId.set(key, a.page_id)
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
      const key = ref.targetTitle.toLowerCase().trim()
      const targetId = titleToId.get(key) ?? aliasToId.get(key)
      if (targetId && targetId !== r.id) {
        insertLink.run(r.id, targetId, ref.snippet)
      }
    }
  }
}

/**
 * Incremental outgoing WikiLink rebuild for a single page (avoids O(N) full-table JSON
 * parsing on every debounced editor save when page titles/aliases have not changed).
 */
export function rebuildPageLinksForPage(db: DatabaseSync, pageId: string): void {
  db.prepare('DELETE FROM page_links WHERE source_page_id = ?').run(pageId)

  const pageRow = db
    .prepare('SELECT id, blocks_json, canvas_json FROM pages WHERE id = ?')
    .get(pageId) as { id: string; blocks_json: string; canvas_json: string } | undefined
  if (!pageRow) return

  const blocks = JSON.parse(pageRow.blocks_json || '[]')
  const canvasData = JSON.parse(pageRow.canvas_json || '{"nodes":[],"edges":[]}')
  const refs = extractWikiLinkTitles({ blocks, canvasData })
  if (refs.length === 0) return

  const titleRows = db
    .prepare('SELECT id, title FROM pages ORDER BY created_at ASC, rowid ASC')
    .all() as Array<{ id: string; title: string }>
  const titleToId = new Map<string, string>()
  for (const r of titleRows) {
    const key = r.title.toLowerCase().trim()
    if (key && !titleToId.has(key)) titleToId.set(key, r.id)
  }

  const aliasRows = db
    .prepare('SELECT alias, page_id FROM page_aliases ORDER BY created_at ASC, alias ASC')
    .all() as Array<{ alias: string; page_id: string }>
  const aliasToId = new Map<string, string>()
  for (const a of aliasRows) {
    const key = a.alias.toLowerCase().trim()
    if (!key || titleToId.has(key) || aliasToId.has(key)) continue
    aliasToId.set(key, a.page_id)
  }

  const insertLink = db.prepare(`
    INSERT OR REPLACE INTO page_links (source_page_id, target_page_id, context_snippet)
    VALUES (?, ?, ?)
  `)

  for (const ref of refs) {
    const key = ref.targetTitle.toLowerCase().trim()
    const targetId = titleToId.get(key) ?? aliasToId.get(key)
    if (targetId && targetId !== pageId) {
      insertLink.run(pageId, targetId, ref.snippet)
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
