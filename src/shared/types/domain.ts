export type MarkerColor = 'cobalt' | 'amber' | 'teal' | 'red' | 'violet' | 'slate'
export type PageMode = 'block' | 'canvas'
export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done'

export interface Notebook {
  id: string
  name: string
  icon: string
  color: MarkerColor
  repoPath?: string
  defaultBranch?: string
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
  repoPathOverride?: string
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
  | 'image'
  | 'file'
  | 'columns'

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
  // For 'columns' group: header bertipe 'columns' (content selalu ''), anak-anaknya
  // menunjuk balik lewat columnGroupId + columnIndex; columnWidths hanya di header.
  columnGroupId?: string
  columnIndex?: number
  columnWidths?: number[]
  // For 'image' | 'file' blocks (aset content-addressed di workspace/assets)
  assetId?: string
  assetExt?: string
  assetMime?: string
  assetName?: string
  assetSize?: number
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

export type GitFileStatus = 'modified' | 'added' | 'untracked' | 'deleted' | 'renamed'

export interface RepoEntry {
  name: string
  relPath: string
  isDirectory: boolean
  size?: number
  gitStatus?: GitFileStatus
}

export interface RepoGitStatusSummary {
  branch: string
  isClean: boolean
  changedFiles: {
    relPath: string
    status: GitFileStatus
  }[]
  linesAdded: number
  linesRemoved: number
}

export interface DetectedCliPreset {
  id: 'claude' | 'codex' | 'gemini' | 'aider' | 'pwsh' | 'cmd' | 'bash'
  name: string
  command: string
  available: boolean
  path?: string
  description?: string
}

export interface TerminalSessionInfo {
  id: string
  title: string
  cwd: string
  cliPresetId?: string
  shellType: 'conpty' | 'subprocess'
  isActive: boolean
  detectedState?: 'idle' | 'thinking' | 'waiting_approval' | 'running_tests' | 'completed' | 'failed'
}

// ADE Pilar 1 & 2: Spec-to-Agent Compiler & Dispatcher
export interface SpecBundleFile {
  filename: string
  relPath: string
  size: number
  description: string
}

export interface SpecBundleSummary {
  pageId: string
  pageCode: string
  pageTitle: string
  targetDir: string
  files: SpecBundleFile[]
  taskCount: number
  dbmlTableCount: number
  diagramCount: number
}

export interface DispatchMissionInput {
  pageId: string
  presetId: 'claude' | 'codex' | 'gemini' | 'aider' | 'in-app' | 'pwsh' | 'cmd' | 'bash'
  isolationMode: 'direct' | 'worktree'
  approvalMode: 'plan-only' | 'ask-edit' | 'auto-edit'
  customDirective?: string
  worktreeBranch?: string
}

export interface DispatchMissionResult {
  ok: boolean
  sessionId: string
  cwd: string
  branchName?: string
  commandExecuted: string
  error?: string
}

export type AgentSessionStatus =
  | 'idle'
  | 'thinking'
  | 'waiting_approval'
  | 'running_tests'
  | 'completed'
  | 'failed'
  | 'merged'

export interface AgentSessionRecord {
  id: string
  notebookId: string
  sectionId?: string | null
  pageId?: string | null
  taskCode?: string | null
  title: string
  agentPreset: string
  command: string
  approvalMode: 'plan-only' | 'ask-edit' | 'auto-edit'
  isolationMode: 'direct' | 'worktree'
  repoPath: string
  worktreePath?: string | null
  branchName?: string | null
  status: AgentSessionStatus
  filesChanged: number
  linesAdded: number
  linesRemoved: number
  lastOutputTail: string
  createdAt: number
  updatedAt: number
}
