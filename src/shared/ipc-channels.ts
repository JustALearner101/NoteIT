import type {
  AgentSessionRecord,
  AIAttachment,
  AIMessageRecord,
  AIMessageTelemetry,
  AIModelSlots,
  AIProviderKind,
  AIProviderPreset,
  AIProviderProfile,
  AIProviderProfileInput,
  AIProviderTestResult,
  AIThreadRecord,
  AIUiArtifact,
  AIUiMode,
  AssetRecord,
  BacklinkItem,
  BlockType,
  BrowserBookmark,
  CliBridgeStatus,
  DetectedCliPreset,
  DispatchMissionInput,
  DispatchMissionResult,
  KgSnapshot,
  LearnPhase,
  LearnSession,
  LearnSideThread,
  LearnTurn,
  MarkerColor,
  McpConnectionTestResult,
  McpServerConfig,
  McpTransportType,
  Notebook,
  Page,
  PageMode,
  PageVersion,
  PageVersionSummary,
  PersistedBrowserTab,
  RepoEntry,
  RepoFileDiffResult,
  RepoGitStatusSummary,
  SearchResultItem,
  Section,
  SemanticSearchHit,
  SpecBundleSummary,
  TaskStatus,
  TerminalSessionInfo,
  WorkspaceSnapshot
} from './types/domain'

export interface ProposedSpecBlock {
  type: BlockType
  content: string
}

export type AIProposalKind =
  | 'spec-blocks'
  | 'repo-file-edit'
  | 'repo-command'
  | 'spec-task-status'
  | 'spawn-agent'
  | 'mcp-tool'

export interface AIApprovalProposal {
  proposalId: string
  kind?: AIProposalKind
  targetPageId: string
  targetPageCode: string
  targetPageTitle: string
  summary: string
  blocks: ProposedSpecBlock[]
  status: 'pending' | 'approved' | 'rejected'
  repoFileEdit?: {
    repoPath: string
    relPath: string
    originalContent: string
    newContent: string
    language: string
  }
  repoCommand?: {
    cwd: string
    command: string
    args: string[]
    timeoutMs?: number
  }
  specTaskUpdate?: {
    pageId: string
    taskCodeOrText: string
    status?: TaskStatus
    checked?: boolean
    progress?: number
  }
  spawnAgent?: {
    pageId: string
    presetId: DispatchMissionInput['presetId']
    isolationMode: DispatchMissionInput['isolationMode']
    approvalMode: DispatchMissionInput['approvalMode']
    customDirective?: string
  }
  mcpToolCall?: {
    serverId: string
    serverName: string
    toolName: string
    args: Record<string, unknown>
  }
  executionResult?: string
}

export interface BlockContextForAI {
  pageId: string
  pageCode: string
  pageTitle: string
  blockId: string
  blockType: BlockType
  content: string
  selectedText?: string
}

export interface AIChatStreamRequest {
  requestId: string
  threadId?: string
  provider: AIProviderKind
  profileId?: string
  modelId: string
  approvalMode: 'ask' | 'auto-edit' | 'plan-only'
  chatMode: string
  uiMode?: AIUiMode
  messages: { role: 'user' | 'assistant'; content: string }[]
  attachments?: AIAttachment[]
  mentionedPageIds: string[]
  activePageId?: string
  browserContext?: {
    url: string
    title: string
    excerpt: string
  } | null
  blockContext?: BlockContextForAI | null
}

export type AIChatStreamEvent =
  | { requestId: string; type: 'text-delta'; textDelta: string }
  | { requestId: string; type: 'reasoning-delta'; reasoningDelta: string }
  | { requestId: string; type: 'ui-artifact'; artifact: AIUiArtifact }
  | { requestId: string; type: 'telemetry'; telemetry: AIMessageTelemetry }
  | { requestId: string; type: 'fallback-notice'; message: string }
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
  getPageVersions(pageId: string): Promise<PageVersionSummary[]>
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
  importAssets(): Promise<AssetImportResult>
  importAssetBytes(input: ImportAssetBytesInput): Promise<AssetRecord>
  saveAssetAs(input: SaveAssetAsInput): Promise<{ saved: boolean; filePath?: string }>
  openAssetExternal(assetId: string): Promise<{ ok: boolean; error?: string }>

  // Quick Capture & Daily Note
  createQuickNote(text: string): Promise<Page>
  openDailyNote(): Promise<Page>
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
  executeApprovedProposal(
    proposal: AIApprovalProposal
  ): Promise<{ ok: boolean; output?: string; error?: string }>

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
    startLine?: number
    endLine?: number
  }): Promise<{ content: string; language: string; size: number; totalLines?: number }>
  getRepoGitStatus(repoPath: string): Promise<RepoGitStatusSummary>
  getRepoFileDiff(input: { repoPath: string; relPath: string }): Promise<RepoFileDiffResult>
  writeRepoFile(input: {
    repoPath: string
    relPath: string
    content: string
  }): Promise<{ ok: boolean; relPath: string; size: number }>
  discardRepoFileChanges(input: {
    repoPath: string
    relPath: string
  }): Promise<{ ok: boolean; relPath: string }>

  // Universal MCP Client
  listMcpServers(): Promise<McpServerConfig[]>
  upsertMcpServer(input: {
    id?: string
    name: string
    transport: McpTransportType
    command?: string
    args?: string[]
    url?: string
    envVars?: Record<string, string>
    enabled?: boolean
    requireApproval?: boolean
  }): Promise<McpServerConfig>
  deleteMcpServer(id: string): Promise<{ ok: boolean }>
  testMcpConnection(
    serverIdOrConfig:
      | string
      | {
          id: string
          name: string
          transport: McpTransportType
          command: string
          args: string[]
          url: string
          envVars: Record<string, string>
        }
  ): Promise<McpConnectionTestResult>

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

  // ADE Pilar 3: Worktree & Agent Mission Control
  listAgentSessions(notebookId?: string): Promise<AgentSessionRecord[]>
  mergeWorktreeSession(
    sessionId: string,
    commitMessage?: string
  ): Promise<{ ok: boolean; error?: string }>
  discardWorktreeSession(sessionId: string): Promise<{ ok: boolean; error?: string }>
  quickApproveSession(sessionId: string): Promise<{ ok: boolean }>
  onAgentSessionUpdated(callback: (session: AgentSessionRecord) => void): () => void

  // Encrypted Secrets (Electron safeStorage) & Durable UI State
  setSecret(input: { key: string; value: string }): Promise<{ ok: boolean }>
  hasSecret(key: string): Promise<boolean>
  deleteSecret(key: string): Promise<{ ok: boolean }>
  getEncryptionStatus(): Promise<{ available: boolean; scheme: string }>
  resetWorkspace(options?: { includeSecretsAndProviders?: boolean }): Promise<{ ok: boolean }>

  // v2.3 Wave 1: Unified AI Provider Registry & Headless CLI Bridges
  listProviderPresets(): Promise<AIProviderPreset[]>
  listProviderProfiles(): Promise<AIProviderProfile[]>
  upsertProviderProfile(input: AIProviderProfileInput): Promise<AIProviderProfile>
  deleteProviderProfile(id: string): Promise<{ ok: boolean }>
  testProviderProfile(idOrConfig: string | AIProviderProfileInput): Promise<AIProviderTestResult>
  testBuiltinProvider(input: {
    provider: 'gemini' | 'openai' | 'anthropic' | 'ollama'
    modelId?: string
  }): Promise<AIProviderTestResult>
  fetchProviderModels(input: {
    profileId?: string
    builtinProvider?: 'gemini' | 'openai' | 'anthropic' | 'ollama'
  }): Promise<{ ok: boolean; models: string[]; error?: string }>
  getModelSlots(): Promise<AIModelSlots>
  saveModelSlots(slots: Partial<AIModelSlots>): Promise<AIModelSlots>
  detectCliBridges(): Promise<CliBridgeStatus[]>
  getUiState(): Promise<{
    openTabIds: string[]
    activePageId: string
    splitPageId: string | null
    splitRatio: number
    closedTabIds: string[]
    isSidebarCollapsed: boolean
    activeNotebookId?: string
    browserTabs?: PersistedBrowserTab[]
    activeBrowserTabId?: string
  } | null>
  saveUiState(input: {
    openTabIds?: string[]
    activePageId?: string
    splitPageId?: string | null
    splitRatio?: number
    closedTabIds?: string[]
    isSidebarCollapsed?: boolean
    activeNotebookId?: string
    browserTabs?: PersistedBrowserTab[]
    activeBrowserTabId?: string
  }): Promise<{ ok: boolean }>

  // v2.3 Wave 2: Web Workbench (Bookmarks & Popup-to-Tab)
  listBrowserBookmarks(notebookId?: string): Promise<BrowserBookmark[]>
  addBrowserBookmark(input: {
    title: string
    url: string
    notebookId?: string | null
  }): Promise<BrowserBookmark>
  deleteBrowserBookmark(id: string): Promise<{ ok: boolean }>
  onBrowserOpenInNewTab(callback: (url: string) => void): () => void

  // v2.3 Wave 3: Native Learning Workbench & Propositional Knowledge Graph
  listLearnSessions(): Promise<LearnSession[]>
  getLearnSession(
    sessionId: string
  ): Promise<{ session: LearnSession; turns: LearnTurn[]; sideThreads: LearnSideThread[] } | null>
  createLearnSession(input: {
    title: string
    goal: string
    kind?: 'teach' | 'practice'
    sourcePageIds?: string[]
    sourceUrl?: string
    sourceExcerpt?: string
    providerOverride?: AIProviderKind
    profileIdOverride?: string
    modelIdOverride?: string
  }): Promise<{
    session: LearnSession
    turns: LearnTurn[]
    providerLabel: string
    usedLiveProvider: boolean
  }>
  submitLearnResponse(input: {
    sessionId: string
    answer: string
    thinkingText?: string
    confidence?: number
    requestedPhase?: LearnPhase
    providerOverride?: AIProviderKind
    profileIdOverride?: string
    modelIdOverride?: string
  }): Promise<{
    session: LearnSession
    turns: LearnTurn[]
    providerLabel: string
    usedLiveProvider: boolean
  }>
  askLearnSideQuestion(input: {
    sessionId: string
    anchorTurnId?: string
    selectedQuote?: string
    question: string
    threadId?: string
    providerOverride?: AIProviderKind
    profileIdOverride?: string
    modelIdOverride?: string
  }): Promise<LearnSideThread>
  deleteLearnSession(sessionId: string): Promise<{ ok: boolean }>
  crystallizeLearnSessionToPage(input: { sessionId: string; sectionId?: string }): Promise<Page>
  getKnowledgeGraph(): Promise<KgSnapshot>
  extractKnowledgeGraph(input: {
    sessionId?: string
    pageId?: string
  }): Promise<{ addedPropositions: number; addedChains: number; snapshot: KgSnapshot }>
  updateKgNodePosition(input: { id: string; x: number; y: number }): Promise<{ ok: boolean }>
  deleteKgProposition(id: string): Promise<{ ok: boolean }>

  // v2.4: Unified AI Studio Persistence & Hybrid Vector Semantic Search
  listAiThreads(): Promise<AIThreadRecord[]>
  getAiThread(threadId: string): Promise<{ thread: AIThreadRecord; messages: AIMessageRecord[] } | null>
  createAiThread(input?: {
    title?: string
    studioMode?: 'chat' | 'learn'
    chatMode?: string
    uiMode?: AIUiMode
    providerId?: string
    modelId?: string
  }): Promise<AIThreadRecord>
  updateAiThread(input: {
    threadId: string
    title?: string
    chatMode?: string
    uiMode?: AIUiMode
    providerId?: string
    modelId?: string
  }): Promise<AIThreadRecord | null>
  deleteAiThread(threadId: string): Promise<{ ok: boolean }>
  saveAiMessage(input: {
    id?: string
    threadId: string
    role: 'user' | 'assistant'
    content: string
    reasoningText?: string
    uiArtifact?: AIUiArtifact | null
    attachments?: AIAttachment[]
    toolCalls?: { toolName: string; argsSummary: string }[]
    proposals?: unknown[]
    telemetry?: AIMessageTelemetry
  }): Promise<AIMessageRecord>
  semanticSearchWorkspace(query: string, limit?: number): Promise<SemanticSearchHit[]>
}
