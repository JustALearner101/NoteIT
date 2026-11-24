import React, { useState } from 'react'
import { AlertTriangle, FolderOpen, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'

const secondaryBtn =
  'px-3 py-2 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5'

export const StorageBackupTab: React.FC = () => {
  const { stats, showToast, openHelpCenter, loadWorkspace, setActiveMainView } = useWorkspaceStore()
  const [confirmMode, setConfirmMode] = useState<'none' | 'content' | 'factory'>('none')
  const [isResetting, setIsResetting] = useState(false)

  const runBackup = async (): Promise<void> => {
    const res = await window.noteitAPI.runBackupNow()
    showToast(res.ok ? `Backup created: ${res.filePath}` : `Backup failed: ${res.error || 'Unknown error'}`)
  }

  const gcAssets = async (): Promise<void> => {
    const res = await window.noteitAPI.gcOrphanAssetsNow()
    showToast(`Cleanup finished: ${res.deletedCount} orphan assets removed`)
  }

  const executeReset = async (includeSecretsAndProviders: boolean): Promise<void> => {
    setIsResetting(true)
    try {
      await window.noteitAPI.resetWorkspace({ includeSecretsAndProviders })
      await loadWorkspace()
      setConfirmMode('none')
      showToast(
        includeSecretsAndProviders
          ? 'Factory reset complete. Workspace, providers, and encrypted API keys cleared.'
          : 'Workspace content cleared. Your encrypted API keys and provider profiles were preserved.'
      )
      setActiveMainView('workbench')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reset workspace', 'error')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="space-y-6 animate-view-enter">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-primary">Storage &amp; backup</h1>
        <p className="text-xs text-ink-secondary mt-1">
          Manage the local SQLite database, the FTS5 search index, automatic backup rotation
          (secrets are automatically scrubbed from backup files), and workspace resets.
        </p>
      </div>

      <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase text-ink-muted">Active database</div>
            <div className="font-mono text-xs text-ink-primary mt-1 break-all">
              {stats.dbPath || 'Local user data workspace (SQLite WAL)'}
            </div>
          </div>
          <span
            role="status"
            className="px-2.5 py-1 rounded-full bg-[var(--pill-teal-bg)] text-[var(--pill-teal-text)] font-mono text-[11px] shrink-0"
          >
            WAL online · {stats.ftsIndexedPages} pages indexed
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => void runBackup()}
            className="px-3.5 py-2 rounded-md bg-accent-cobalt text-white text-xs font-medium flex items-center gap-2"
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Run backup now (VACUUM INTO)</span>
          </button>
          <button type="button" onClick={() => window.noteitAPI.openStorageFolder('workspace')} className={secondaryBtn}>
            <FolderOpen size={13} aria-hidden="true" />
            <span>Open workspace folder</span>
          </button>
          <button type="button" onClick={() => window.noteitAPI.openStorageFolder('backups')} className={secondaryBtn}>
            <FolderOpen size={13} aria-hidden="true" />
            <span>Open backups folder</span>
          </button>
          <button type="button" onClick={() => window.noteitAPI.openStorageFolder('logs')} className={secondaryBtn}>
            <FolderOpen size={13} aria-hidden="true" />
            <span>Open logs folder</span>
          </button>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-ink-primary">Orphan asset cleanup</div>
          <div className="text-[11px] text-ink-secondary">
            Remove attachments that no page references anymore.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void gcAssets()} className={secondaryBtn}>
            <Trash2 size={13} aria-hidden="true" />
            <span>Clean orphan assets</span>
          </button>
          <button type="button" onClick={() => void openHelpCenter()} className={secondaryBtn}>
            <span>Open help</span>
          </button>
        </div>
      </div>

      {/* Danger Zone: Content Reset vs Factory Reset */}
      <div className="p-5 rounded-xl bg-surface-elevated border border-accent-rose/30 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-accent-rose" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink-primary">Reset Workspace</h2>
        </div>
        <p className="text-xs text-ink-secondary">
          Clear existing notebooks, pages, bookmarks, AI threads, learning sessions, and knowledge
          graph to start from a 100% clean slate.
        </p>

        {confirmMode === 'none' ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmMode('content')}
              className="px-3.5 py-2 rounded-md bg-surface-chrome hover:bg-surface-hover border border-accent-amber/40 text-xs font-medium text-accent-amber flex items-center gap-1.5"
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>Clear Content Only (Keep API Keys)</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmMode('factory')}
              className="px-3.5 py-2 rounded-md bg-accent-rose/10 hover:bg-accent-rose/20 border border-accent-rose/40 text-xs font-medium text-accent-rose flex items-center gap-1.5"
            >
              <ShieldAlert size={13} aria-hidden="true" />
              <span>Factory Reset (Clear All + API Keys)</span>
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg bg-surface-chrome border border-accent-rose/40 space-y-3">
            <div className="text-xs font-medium text-ink-primary">
              {confirmMode === 'factory'
                ? 'Confirm Factory Reset: this permanently deletes ALL notebooks, pages, bookmarks, AI history, custom endpoints, MCP servers, and encrypted API keys.'
                : 'Confirm Content Reset: this permanently deletes ALL notebooks, pages, bookmarks, AI threads, learning sessions, and knowledge graph. Your API keys and AI providers will be kept.'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => void executeReset(confirmMode === 'factory')}
                className="px-3.5 py-1.5 rounded-md bg-accent-rose text-white text-xs font-medium disabled:opacity-50"
              >
                {isResetting
                  ? 'Resetting...'
                  : confirmMode === 'factory'
                    ? 'Yes, Factory Reset Everything'
                    : 'Yes, Clear All Content'}
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setConfirmMode('none')}
                className={secondaryBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
