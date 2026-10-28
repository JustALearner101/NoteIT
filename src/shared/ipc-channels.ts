import type {
  BacklinkItem,
  MarkerColor,
  Notebook,
  Page,
  PageMode,
  PageVersion,
  SearchResultItem,
  Section,
  WorkspaceSnapshot
} from './types/domain'

export interface CreatePageInput {
  sectionId: string
  parentPageId?: string | null
  title: string
  icon?: string
  mode?: PageMode
  template?: 'blank' | 'dbml' | 'roadmap' | 'canvas'
}

export interface UpdatePageInput {
  id: string
  title?: string
  icon?: string
  mode?: PageMode
  blocks?: Page['blocks']
  canvasData?: Page['canvasData']
  tags?: string[]
  isFavorite?: boolean
  isPinned?: boolean
}

export interface ExportMarkdownInput {
  scope: 'page' | 'workspace'
  pageId?: string
}

export interface ExportMarkdownResult {
  saved: boolean
  filePath?: string
  fileCount?: number
}

export interface NoteItAPI {
  // Workspace & Hierarchy
  getWorkspace(): Promise<WorkspaceSnapshot>
  createNotebook(input: { name: string; icon: string; color: MarkerColor }): Promise<Notebook>
  createSection(input: { notebookId: string; name: string; color: MarkerColor }): Promise<Section>
  createPage(input: CreatePageInput): Promise<Page>
  updatePage(input: UpdatePageInput): Promise<Page>
  deletePage(pageId: string): Promise<{ ok: boolean }>

  // Backlinks & Version History (Snapshots)
  getBacklinks(pageId: string): Promise<BacklinkItem[]>
  getPageVersions(pageId: string): Promise<PageVersion[]>
  createPageSnapshot(pageId: string, label?: string): Promise<PageVersion>
  restorePageSnapshot(pageId: string, versionId: string): Promise<Page>

  // Full-Text Search (SQLite FTS5)
  searchWorkspace(query: string): Promise<SearchResultItem[]>

  // Export
  exportContent(input: {
    filename: string
    content: string
    extension: 'md' | 'sql' | 'json' | 'svg'
  }): Promise<{ saved: boolean; filePath?: string }>
  exportMarkdown(input: ExportMarkdownInput): Promise<ExportMarkdownResult>

  // Quick Capture
  createQuickNote(text: string): Promise<Page>

  // Desktop Window Controls
  windowMinimize(): Promise<void>
  windowMaximizeToggle(): Promise<boolean>
  windowClose(): Promise<void>
}
