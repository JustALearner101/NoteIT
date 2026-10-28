export type MarkerColor = 'cobalt' | 'amber' | 'teal' | 'red' | 'violet' | 'slate'
export type PageMode = 'block' | 'canvas'
export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done'

export interface Notebook {
  id: string
  name: string
  icon: string
  color: MarkerColor
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface Section {
  id: string
  notebookId: string
  name: string
  code: string // e.g. "SEC-01"
  color: MarkerColor
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface ProjectTaskItem {
  id: string
  code: string // e.g. "TSK-01"
  title: string
  category: string
  color: MarkerColor
  status: TaskStatus
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  progress: number // 0 - 100
  isMilestone: boolean
  dependsOn: string[] // array of ProjectTaskItem.id
  assignee: string
  estimateHours: number
}

export type BlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'paragraph'
  | 'checklist'
  | 'callout'
  | 'code'
  | 'dbml'
  | 'mermaid'
  | 'graphviz'
  | 'database'

export interface DBMLTableLayout {
  [tableName: string]: { x: number; y: number; color?: MarkerColor }
}

export interface DocumentBlock {
  id: string
  type: BlockType
  content: string
  checked?: boolean
  language?: string
  calloutColor?: MarkerColor
  calloutTitle?: string
  wide?: boolean
  // For 'dbml' block
  dbmlViewMode?: 'code' | 'split' | 'diagram'
  dbmlLayout?: DBMLTableLayout
  // For 'mermaid' block
  mermaidViewMode?: 'code' | 'split' | 'diagram'
  // For 'graphviz' block (DOT language)
  graphvizViewMode?: 'code' | 'split' | 'diagram'
  graphvizEngine?: 'dot' | 'neato' | 'fdp' | 'circo' | 'twopi'
  // For 'database' block (Gantt / Kanban / Table / Chart / Calendar)
  databaseTitle?: string
  databaseActiveView?: 'gantt' | 'kanban' | 'table' | 'chart' | 'calendar'
  databaseChartType?: 'bar' | 'line' | 'area' | 'donut' | 'radar' | 'scatter'
  databaseItems?: ProjectTaskItem[]
}

export interface SpatialCanvasNodeData {
  title: string
  content: string
  color: MarkerColor
  cardType: 'note' | 'sticky' | 'dbml' | 'mermaid' | 'metric'
  code?: string
  metricValue?: string
  metricDelta?: string
}

export interface SpatialCanvasNode {
  id: string
  type: 'workCard'
  position: { x: number; y: number }
  data: SpatialCanvasNodeData
}

export interface SpatialCanvasEdge {
  id: string
  source: string
  target: string
  label?: string
  animated?: boolean
  color?: MarkerColor
}

export interface CanvasState {
  nodes: SpatialCanvasNode[]
  edges: SpatialCanvasEdge[]
  viewport: { x: number; y: number; zoom: number }
}

export interface Page {
  id: string
  code: string // e.g. "PG-101"
  sectionId: string
  parentPageId: string | null
  title: string
  icon: string
  mode: PageMode
  blocks: DocumentBlock[]
  canvasData: CanvasState
  tags: string[]
  isFavorite: boolean
  isPinned: boolean
  sortOrder: number
  versionCount: number
  createdAt: number
  updatedAt: number
}

/** Baris tabel assets: satu baris per isi berkas unik (id = sha256 isi berkas). */
export interface AssetRecord {
  id: string
  ext: string
  mime: string
  name: string
  size: number
  createdAt: number
}

export interface PageVersion {
  id: string
  pageId: string
  versionNumber: number
  title: string
  label: string
  blocks: DocumentBlock[]
  canvasData: CanvasState
  /** null = snapshot legacy (dibuat sebelum kolom tags_json ada), bukan "tanpa tag". */
  tags: string[] | null
  createdAt: number
}

/** Baris daftar riwayat: metadata saja, tanpa blocks/canvas. */
export interface PageVersionSummary {
  id: string
  pageId: string
  versionNumber: number
  title: string
  label: string
  /** null = snapshot legacy (dibuat sebelum kolom tags_json ada). */
  tags: string[] | null
  blockCount: number
  createdAt: number
}

export interface BacklinkItem {
  sourcePageId: string
  sourcePageCode: string
  sourcePageTitle: string
  sourcePageIcon: string
  sectionName: string
  sectionColor: MarkerColor
  contextSnippet: string
}

export interface SearchResultItem {
  pageId: string
  pageCode: string
  title: string
  icon: string
  mode: PageMode
  sectionId: string
  sectionName: string
  sectionColor: MarkerColor
  notebookName: string
  snippet: string
  tags: string[]
  updatedAt: number
}

export interface WorkspaceSnapshot {
  notebooks: Notebook[]
  sections: Section[]
  pages: Page[]
  tags: { name: string; color: MarkerColor; count: number }[]
  stats: {
    sqliteWalActive: boolean
    ftsIndexedPages: number
    dbPath: string
  }
}
