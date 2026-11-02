import type {
  AssetRecord,
  BacklinkItem,
  BlockType,
  DetectedCliPreset,
  DispatchMissionInput,
  DispatchMissionResult,
  MarkerColor,
  Notebook,
  Page,
  PageMode,
  PageVersion,
  PageVersionSummary,
  RepoEntry,
  RepoGitStatusSummary,
  SearchResultItem,
  Section,
  SpecBundleSummary,
  TerminalSessionInfo,
  WorkspaceSnapshot
} from './types/domain'

export interface ProposedSpecBlock {
  type: BlockType
  content: string
}

export interface AIApprovalProposal {
  proposalId: string
  targetPageId: string
  targetPageCode: string
  targetPageTitle: string
  summary: string
  blocks: ProposedSpecBlock[]
  status: 'pending' | 'approved' | 'rejected'
}

export interface AIChatStreamRequest {
  requestId: string
  provider: 'gemini' | 'openai' | 'anthropic' | 'ollama'
  modelId: string
  apiKey?: string
  approvalMode: 'ask' | 'auto-edit' | 'plan-only'
  chatMode: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  mentionedPageIds: string[]
  activePageId?: string
  browserContext?: {
    url: string
    title: string
    excerpt: string
  } | null
}

export type AIChatStreamEvent =
  | { requestId: string; type: 'text-delta'; textDelta: string }
  | {
      requestId: string
      type: 'tool-call'
      toolName: string
      argsSummary: string
    }
  | {
      requestId: string
      type: 'approval-request'
      proposal: AIApprovalProposal
    }
  | {
      requestId: string
      type: 'auto-applied'
      proposal: AIApprovalProposal
    }
  | {
      requestId: string
      type: 'done'
      usedLiveSdk: boolean
      providerLabel: string
    }
  | {
      requestId: string
      type: 'error'
      error: string
    }

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

export interface AssetImportResult {
  assets: AssetRecord[]
  rejected: { name: string; reason: string }[]
}

export interface ImportAssetBytesInput {
  name: string
  data: Uint8Array
}

export interface SaveAssetAsInput {
  assetId: string
  name: string
  ext: string
}

export interface ExportMarkdownInput {
  scope: 'page' | 'workspace'
  pageId?: string
}

export interface ExportMarkdownResult {
  saved: boolean
  filePath?: string
  fileCount?: number
  /** Jumlah berkas aset yang ikut disalin ke folder assets/ hasil ekspor. */
  assetCount?: number
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
  /** Metadata-only: tidak memuat blocks/canvas tiap versi. */
  getPageVersions(pageId: string): Promise<PageVersionSummary[]>
  /** Versi penuh (blocks + canvas) untuk preview/diff. */
  getPageVersion(pageId: string, versionId: string): Promise<PageVersion>
  createPageSnapshot(pageId: string, label?: string): Promise<PageVersion>
  restorePageSnapshot(pageId: string, versionId: string): Promise<Page>
  deletePageSnapshot(pageId: string, versionId: string): Promise<{ ok: boolean }>
  renamePageSnapshot(
    pageId: string,
    versionId: string,
    label: string
  ): Promise<PageVersionSummary>

  // Full-Text Search (SQLite FTS5)
  searchWorkspace(query: string): Promise<SearchResultItem[]>

  // Export
  exportContent(input: {
    filename: string
    content: string
    extension: 'md' | 'sql' | 'json' | 'svg'
  }): Promise<{ saved: boolean; filePath?: string }>
  exportMarkdown(input: ExportMarkdownInput): Promise<ExportMarkdownResult>

  // Assets (attachment/PDF, content-addressed)
  /** Dialog pemilih berkas; aset identik otomatis didedupe. */
  importAssets(): Promise<AssetImportResult>
  /** Impor byte langsung (paste screenshot / drag-drop tanpa path). */
  importAssetBytes(input: ImportAssetBytesInput): Promise<AssetRecord>
  saveAssetAs(input: SaveAssetAsInput): Promise<{ saved: boolean; filePath?: string }>
  openAssetExternal(assetId: string): Promise<{ ok: boolean; error?: string }>

  // Quick Capture & Daily Note
  createQuickNote(text: string): Promise<Page>
  openDailyNote(): Promise<Page>
  /** Event dari main process (global hotkey daily note); return fungsi unsubscribe. */
  onNavigateToPage(callback: (pageId: string) => void): () => void

  // Desktop Window Controls
  windowMinimize(): Promise<void>
  windowMaximizeToggle(): Promise<boolean>
  windowClose(): Promise<void>

  // Help Center & Maintenance Actions
  openHelpExternal(): Promise<{ ok: boolean; url?: string; error?: string }>
  runBackupNow(): Promise<{ ok: boolean; filePath?: string; assetFileCount?: number; error?: string }>
  gcOrphanAssetsNow(): Promise<{ deletedCount: number }>
  openStorageFolder(target: 'workspace' | 'backups' | 'logs'): Promise<{ ok: boolean; path?: string }>

  // Vercel AI SDK Streaming & Agentic Tools
  startAIChatStream(input: AIChatStreamRequest): Promise<{ started: boolean }>
  onAIChatStreamEvent(callback: (event: AIChatStreamEvent) => void): () => void

  // ADE Pilar 1: Repo Binding & Local File Explorer
  updateNotebookRepo(input: {
    notebookId: string
    repoPath: string | null
    defaultBranch?: string
  }): Promise<Notebook>
  updateSectionRepo(input: {
    sectionId: string
    repoPathOverride: string | null
  }): Promise<Section>
  pickRepoFolder(defaultPath?: string): Promise<{
    canceled: boolean
    path?: string
    isGitRepo: boolean
    branch?: string
  }>
  readRepoDir(input: { repoPath: string; relPath?: string }): Promise<RepoEntry[]>
  readRepoFile(input: {
    repoPath: string
    relPath: string
  }): Promise<{ content: string; language: string; size: number }>
  getRepoGitStatus(repoPath: string): Promise<RepoGitStatusSummary>

  // ADE Pilar 1: Embedded PTY Terminal Multiplexer
  detectCliPresets(): Promise<DetectedCliPreset[]>
  createTerminalSession(input: {
    cwd: string
    command?: string
    args?: string[]
    title?: string
    cliPresetId?: string
  }): Promise<{ sessionId: string; shellType: 'conpty' | 'subprocess' }>
  writeTerminal(input: { sessionId: string; data: string }): Promise<void>
  resizeTerminal(input: { sessionId: string; cols: number; rows: number }): Promise<void>
  killTerminal(sessionId: string): Promise<{ ok: boolean }>
  listTerminalSessions(): Promise<TerminalSessionInfo[]>
  onTerminalData(callback: (event: { sessionId: string; data: string }) => void): () => void
  onTerminalExit(callback: (event: { sessionId: string; exitCode: number }) => void): () => void
  onTerminalStateChange(
    callback: (event: { sessionId: string; state: TerminalSessionInfo['detectedState'] }) => void
  ): () => void

  // ADE Pilar 2: Spec-to-Agent Compiler & Dispatcher
  compileSpec(input: { pageId: string; targetCwd?: string }): Promise<SpecBundleSummary>
  dispatchMission(input: DispatchMissionInput): Promise<DispatchMissionResult>
  previewMissionPrompt(input: {
    pageId: string
    presetId: string
    approvalMode: string
    customDirective?: string
  }): Promise<{ command: string; args: string[]; promptText: string }>
}
