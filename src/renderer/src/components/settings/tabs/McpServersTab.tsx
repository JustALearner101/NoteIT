import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Edit3,
  Globe,
  Play,
  Plug,
  Plus,
  ShieldCheck,
  Terminal,
  Trash2
} from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmModal,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SegmentedControl
} from '@renderer/components/ui'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import type {
  McpConnectionTestResult,
  McpServerConfig,
  McpTransportType
} from '@shared/types/domain'

function serializeEnvText(envVars: Record<string, string>): string {
  return Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}

function parseEnvText(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (key) out[key] = val
    }
  }
  return out
}

export const McpServersTab: React.FC = () => {
  const { showToast } = useWorkspaceStore()

  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, McpConnectionTestResult>>({})
  const [deleteTarget, setDeleteTarget] = useState<McpServerConfig | null>(null)

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<McpTransportType>('stdio')
  const [command, setCommand] = useState('npx')
  const [argsText, setArgsText] = useState('')
  const [url, setUrl] = useState('http://localhost:8080/mcp')
  const [envText, setEnvText] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [requireApproval, setRequireApproval] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadServers = useCallback(async () => {
    if (!window.noteitAPI?.listMcpServers) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const list = await window.noteitAPI.listMcpServers()
      setServers(list)
    } catch (err) {
      console.error('Failed to list MCP servers:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadServers()
  }, [loadServers])

  const openAddModal = (): void => {
    setEditingId(undefined)
    setName('')
    setTransport('stdio')
    setCommand('npx')
    setArgsText('-y @modelcontextprotocol/server-filesystem .')
    setUrl('http://localhost:8080/mcp')
    setEnvText('')
    setEnabled(true)
    setRequireApproval(true)
    setIsModalOpen(true)
  }

  const openEditModal = (srv: McpServerConfig): void => {
    setEditingId(srv.id)
    setName(srv.name)
    setTransport(srv.transport)
    setCommand(srv.command)
    setArgsText(srv.args.join(' '))
    setUrl(srv.url)
    setEnvText(serializeEnvText(srv.envVars))
    setEnabled(srv.enabled)
    setRequireApproval(srv.requireApproval)
    setIsModalOpen(true)
  }

  const handleSaveServer = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) {
      showToast('Please enter a server name.', 'error')
      return
    }

    setIsSaving(true)
    try {
      const args = argsText
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      const envVars = parseEnvText(envText)
      await window.noteitAPI.upsertMcpServer({
        id: editingId,
        name: name.trim(),
        transport,
        command: command.trim(),
        args,
        url: url.trim(),
        envVars,
        enabled,
        requireApproval
      })
      showToast(editingId ? `Updated MCP server "${name}"` : `Added MCP server "${name}"`)
      setIsModalOpen(false)
      await loadServers()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save MCP server', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleEnabled = async (srv: McpServerConfig, nextEnabled: boolean): Promise<void> => {
    await window.noteitAPI.upsertMcpServer({
      ...srv,
      enabled: nextEnabled
    })
    await loadServers()
  }

  const handleToggleApproval = async (
    srv: McpServerConfig,
    nextApproval: boolean
  ): Promise<void> => {
    await window.noteitAPI.upsertMcpServer({
      ...srv,
      requireApproval: nextApproval
    })
    await loadServers()
  }

  const handleTestConnection = async (srv: McpServerConfig): Promise<void> => {
    setTestingId(srv.id)
    try {
      const res = await window.noteitAPI.testMcpConnection(srv.id)
      setTestResults((prev) => ({ ...prev, [srv.id]: res }))
      if (res.ok) {
        showToast(`Connected to ${srv.name}: ${res.tools.length} tool(s) discovered (${res.latencyMs}ms)`)
      } else {
        showToast(`Connection failed: ${res.error || 'Unknown error'}`, 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'MCP connection test failed', 'error')
    } finally {
      setTestingId(null)
    }
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    await window.noteitAPI.deleteMcpServer(deleteTarget.id)
    showToast(`Deleted MCP server "${deleteTarget.name}"`)
    setDeleteTarget(null)
    await loadServers()
  }

  return (
    <div className="space-y-6 animate-view-enter">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-primary">MCP servers</h1>
          <p className="text-xs text-ink-secondary mt-1">
            Connect Model Context Protocol servers (stdio, Streamable HTTP, or SSE) so the in-app AI
            agent can discover and invoke external tools.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={openAddModal}>
          <Plus size={13} aria-hidden="true" />
          <span>Add MCP Server</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-6 rounded-xl bg-surface-elevated border border-border-hairline text-xs font-mono text-ink-muted">
          Loading configured MCP servers...
        </div>
      ) : servers.length === 0 ? (
        <div className="p-6 rounded-xl bg-surface-elevated border border-dashed border-border-hairline flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-ink-secondary">
            <Plug size={16} className="text-accent-cobalt shrink-0" aria-hidden="true" />
            <span>
              No MCP servers configured yet. Add a local stdio command or remote Streamable HTTP /
              SSE endpoint to extend AI Chat tools.
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={openAddModal}>
            Configure Server
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((srv) => {
            const testRes = testResults[srv.id]
            const isTesting = testingId === srv.id

            return (
              <div
                key={srv.id}
                className="p-4 rounded-xl bg-surface-elevated border border-border-hairline space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-ink-primary">{srv.name}</span>
                      <Badge
                        tone={srv.transport === 'stdio' ? 'amber' : 'cobalt'}
                        size="sm"
                        className="font-mono uppercase"
                      >
                        {srv.transport === 'stdio' ? (
                          <Terminal size={10} aria-hidden="true" />
                        ) : (
                          <Globe size={10} aria-hidden="true" />
                        )}
                        <span>{srv.transport}</span>
                      </Badge>
                      {srv.requireApproval && (
                        <Badge tone="teal" size="sm">
                          <ShieldCheck size={10.5} aria-hidden="true" />
                          <span>Approval Gate</span>
                        </Badge>
                      )}
                      {testRes && (
                        <Badge tone={testRes.ok ? 'teal' : 'red'} size="sm" className="font-mono">
                          {testRes.ok ? (
                            <>
                              <Check size={10} aria-hidden="true" />
                              <span>
                                {testRes.tools.length} tools · {testRes.latencyMs}ms
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={10} aria-hidden="true" />
                              <span>Failed</span>
                            </>
                          )}
                        </Badge>
                      )}
                    </div>

                    <div className="font-mono text-[11px] text-ink-muted truncate max-w-xl">
                      {srv.transport === 'stdio'
                        ? `${srv.command} ${srv.args.join(' ')}`
                        : srv.url}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="xs"
                      loading={isTesting}
                      onClick={() => void handleTestConnection(srv)}
                    >
                      <Play size={11} aria-hidden="true" />
                      <span>Test Connection</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${srv.name}`}
                      title={`Edit ${srv.name}`}
                      onClick={() => openEditModal(srv)}
                    >
                      <Edit3 size={12.5} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${srv.name}`}
                      title={`Delete ${srv.name}`}
                      onClick={() => setDeleteTarget(srv)}
                      className="hover:text-[var(--pill-red-text)]"
                    >
                      <Trash2 size={12.5} aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={srv.enabled}
                        onChange={(e) => void handleToggleEnabled(srv, e.target.checked)}
                        aria-label={`Enable ${srv.name}`}
                        className="w-4 h-4 accent-[var(--accent-cobalt)] rounded cursor-pointer"
                      />
                      <span className="text-ink-secondary">Enabled for AI Chat</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={srv.requireApproval}
                        onChange={(e) => void handleToggleApproval(srv, e.target.checked)}
                        aria-label={`Require approval for ${srv.name}`}
                        className="w-4 h-4 accent-[var(--accent-cobalt)] rounded cursor-pointer"
                      />
                      <span className="text-ink-secondary">Require user approval</span>
                    </label>
                  </div>

                  {testRes?.error && (
                    <span className="font-mono text-[11px] text-[var(--pill-red-text)]">
                      {testRes.error}
                    </span>
                  )}
                </div>

                {testRes?.ok && testRes.tools.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {testRes.tools.map((t) => (
                      <span
                        key={t.name}
                        title={t.description || t.name}
                        className="px-2 py-0.5 rounded-[6px] bg-surface-chrome border border-border-hairline font-mono text-[10.5px] text-ink-secondary"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit MCP Server Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent size="lg">
          <form onSubmit={handleSaveServer}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit MCP server' : 'Add MCP server'}</DialogTitle>
              <DialogDescription>
                Configure a local stdio executable or remote Streamable HTTP / SSE endpoint.
              </DialogDescription>
            </DialogHeader>

            <div className="px-5 py-3 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Server name
                </label>
                <input
                  type="text"
                  required
                  aria-label="MCP server name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Filesystem or Docs Server"
                  className="w-full h-8 px-2.5 rounded-[7px] bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus:border-accent-cobalt"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Transport protocol
                </label>
                <SegmentedControl<McpTransportType>
                  size="sm"
                  ariaLabel="MCP transport protocol"
                  value={transport}
                  onChange={setTransport}
                  options={[
                    { value: 'stdio', label: 'Stdio (Local CLI)' },
                    { value: 'streamable-http', label: 'Streamable HTTP' },
                    { value: 'sse', label: 'SSE' }
                  ]}
                />
              </div>

              {transport === 'stdio' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">
                      Command executable
                    </label>
                    <input
                      type="text"
                      required
                      aria-label="Stdio command executable"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="npx, node, python, uvx..."
                      className="w-full h-8 px-2.5 rounded-[7px] bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary focus:border-accent-cobalt"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">
                      Arguments (space-separated)
                    </label>
                    <input
                      type="text"
                      aria-label="Stdio command arguments"
                      value={argsText}
                      onChange={(e) => setArgsText(e.target.value)}
                      placeholder="-y @modelcontextprotocol/server-filesystem ."
                      className="w-full h-8 px-2.5 rounded-[7px] bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary focus:border-accent-cobalt"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    required
                    aria-label="MCP endpoint URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://localhost:8080/mcp"
                    className="w-full h-8 px-2.5 rounded-[7px] bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary focus:border-accent-cobalt"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  {transport === 'stdio'
                    ? 'Environment variables (KEY=VALUE per line)'
                    : 'Custom HTTP headers (Header=Value per line)'}
                </label>
                <textarea
                  rows={3}
                  aria-label="Environment variables or HTTP headers"
                  value={envText}
                  onChange={(e) => setEnvText(e.target.value)}
                  placeholder={
                    transport === 'stdio'
                      ? 'GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...'
                      : 'Authorization=Bearer ...'
                  }
                  className="w-full p-2.5 rounded-[7px] bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary focus:border-accent-cobalt resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireApproval}
                    onChange={(e) => setRequireApproval(e.target.checked)}
                    aria-label="Require user approval before running tools"
                    className="w-4 h-4 accent-[var(--accent-cobalt)] rounded cursor-pointer"
                  />
                  <span className="text-xs text-ink-secondary">
                    Gate tool execution with user Approval Gate
                  </span>
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={isSaving}>
                {editingId ? 'Save Changes' : 'Add Server'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete MCP server?"
        description={
          deleteTarget
            ? `Are you sure you want to remove "${deleteTarget.name}"? Its tools will no longer be available in AI Chat.`
            : ''
        }
        confirmLabel="Delete server"
        variant="danger"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
