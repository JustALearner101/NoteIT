import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  StdioClientTransport,
  getDefaultEnvironment
} from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { z, type ZodTypeAny } from 'zod'
import { getDb } from '../db/client'
import { deleteSecret, getSecret, setSecret } from './secret.service'
import type {
  McpConnectionTestResult,
  McpDiscoveredTool,
  McpServerConfig,
  McpTransportType
} from '@shared/types/domain'

export const MASKED_MCP_ENV_VALUE = '••••••••'

function getMcpEnvSecretKey(serverId: string): string {
  return `mcp.server.${serverId}.env`
}

interface McpServerRow {
  id: string
  name: string
  transport: string
  command: string
  args_json: string
  url: string
  env_keys_json: string
  enabled: number
  require_approval: number
  created_at: number
  updated_at: number
}

interface ActiveMcpConnection {
  serverId: string
  client: Client
  transport: Transport
  tools: McpDiscoveredTool[]
}

const activeConnections = new Map<string, ActiveMcpConnection>()

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function loadDecryptedEnvVars(row: McpServerRow): Record<string, string> {
  const secretRaw = getSecret(getMcpEnvSecretKey(row.id))
  if (secretRaw) {
    const parsed = parseJsonSafe<unknown>(secretRaw, null)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  }

  // Legacy plaintext fallback for rows saved before secret.service encryption
  const legacyParsed = parseJsonSafe<unknown>(row.env_keys_json, null)
  if (legacyParsed && typeof legacyParsed === 'object' && !Array.isArray(legacyParsed)) {
    return legacyParsed as Record<string, string>
  }
  return {}
}

function buildMaskedEnvVars(row: McpServerRow): Record<string, string> {
  const keysParsed = parseJsonSafe<unknown>(row.env_keys_json, [])
  const keys: string[] = Array.isArray(keysParsed)
    ? keysParsed.filter((k): k is string => typeof k === 'string' && k.length > 0)
    : keysParsed && typeof keysParsed === 'object'
      ? Object.keys(keysParsed as Record<string, unknown>)
      : []

  const masked: Record<string, string> = {}
  for (const key of keys) {
    masked[key] = MASKED_MCP_ENV_VALUE
  }
  return masked
}

function rowToMcpServerConfig(row: McpServerRow, maskSecrets = true): McpServerConfig {
  const transport: McpTransportType =
    row.transport === 'streamable-http' || row.transport === 'sse' ? row.transport : 'stdio'
  return {
    id: row.id,
    name: row.name,
    transport,
    command: row.command || '',
    args: parseJsonSafe<string[]>(row.args_json, []),
    url: row.url || '',
    envVars: maskSecrets ? buildMaskedEnvVars(row) : loadDecryptedEnvVars(row),
    enabled: Boolean(row.enabled),
    requireApproval: Boolean(row.require_approval),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listMcpServers(): McpServerConfig[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM mcp_servers ORDER BY created_at ASC')
    .all() as unknown as McpServerRow[]
  return rows.map((row) => rowToMcpServerConfig(row, true))
}

export function getMcpServerById(id: string): McpServerConfig | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM mcp_servers WHERE id = ?')
    .get(id) as unknown as McpServerRow | undefined
  return row ? rowToMcpServerConfig(row, true) : null
}

/**
 * Main-process-only helper that returns decrypted MCP envVars for spawning transports.
 * NEVER expose directly over IPC.
 */
export function getMcpServerWithSecrets(id: string): McpServerConfig | null {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM mcp_servers WHERE id = ?')
    .get(id) as unknown as McpServerRow | undefined
  return row ? rowToMcpServerConfig(row, false) : null
}

export interface UpsertMcpServerInput {
  id?: string
  name: string
  transport: McpTransportType
  command?: string
  args?: string[]
  url?: string
  envVars?: Record<string, string>
  enabled?: boolean
  requireApproval?: boolean
}

export async function upsertMcpServer(input: UpsertMcpServerInput): Promise<McpServerConfig> {
  const db = getDb()
  const now = Date.now()
  const id = input.id?.trim() || `mcp-${now}-${Math.random().toString(36).slice(2, 7)}`
  const existing = getMcpServerWithSecrets(id)

  const name = input.name.trim() || 'MCP Server'
  const transport: McpTransportType = input.transport || 'stdio'
  const command = (input.command ?? existing?.command ?? '').trim()
  const args = input.args ?? existing?.args ?? []
  const url = (input.url ?? existing?.url ?? '').trim()
  const existingEnv = existing?.envVars ?? {}
  let envVars: Record<string, string>
  if (input.envVars !== undefined) {
    envVars = {}
    for (const [key, value] of Object.entries(input.envVars)) {
      if (value === MASKED_MCP_ENV_VALUE && key in existingEnv) {
        envVars[key] = existingEnv[key]
      } else {
        envVars[key] = value
      }
    }
  } else {
    envVars = existingEnv
  }
  const envKeysJson = JSON.stringify(Object.keys(envVars))
  const enabled = input.enabled ?? existing?.enabled ?? true
  const requireApproval = input.requireApproval ?? existing?.requireApproval ?? true

  // Persist raw envVars values encrypted in safeStorage/secrets table
  if (Object.keys(envVars).length > 0) {
    setSecret(getMcpEnvSecretKey(id), JSON.stringify(envVars))
  } else {
    deleteSecret(getMcpEnvSecretKey(id))
  }

  // Disconnect existing active session if configuration changed
  await disconnectMcpServer(id)

  if (existing) {
    db.prepare(
      `UPDATE mcp_servers
       SET name = ?, transport = ?, command = ?, args_json = ?, url = ?, env_keys_json = ?,
           enabled = ?, require_approval = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name,
      transport,
      command,
      JSON.stringify(args),
      url,
      envKeysJson,
      enabled ? 1 : 0,
      requireApproval ? 1 : 0,
      now,
      id
    )
  } else {
    db.prepare(
      `INSERT INTO mcp_servers (
        id, name, transport, command, args_json, url, env_keys_json,
        enabled, require_approval, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name,
      transport,
      command,
      JSON.stringify(args),
      url,
      envKeysJson,
      enabled ? 1 : 0,
      requireApproval ? 1 : 0,
      now,
      now
    )
  }

  return getMcpServerById(id)!
}

export async function deleteMcpServer(id: string): Promise<{ ok: boolean }> {
  await disconnectMcpServer(id)
  deleteSecret(getMcpEnvSecretKey(id))
  const db = getDb()
  db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id)
  return { ok: true }
}

export async function disconnectMcpServer(id: string): Promise<void> {
  const conn = activeConnections.get(id)
  if (!conn) return
  activeConnections.delete(id)
  try {
    await conn.client.close()
  } catch {
    // Best-effort close
  }
  try {
    await conn.transport.close()
  } catch {
    // Best-effort close
  }
}

export async function disconnectAllMcpServers(): Promise<void> {
  const ids = Array.from(activeConnections.keys())
  for (const id of ids) {
    await disconnectMcpServer(id)
  }
}

function createTransportForConfig(
  config: Pick<McpServerConfig, 'transport' | 'command' | 'args' | 'url' | 'envVars'>
): Transport {
  if (config.transport === 'stdio') {
    if (!config.command.trim()) {
      throw new Error('Stdio MCP server requires a command.')
    }
    return new StdioClientTransport({
      command: config.command.trim(),
      args: config.args,
      env: {
        ...getDefaultEnvironment(),
        ...config.envVars
      },
      stderr: 'ignore'
    })
  }

  if (!config.url.trim()) {
    throw new Error(`${config.transport.toUpperCase()} MCP server requires a URL.`)
  }
  const parsedUrl = new URL(config.url.trim())
  const headers: Record<string, string> = { ...config.envVars }

  if (config.transport === 'streamable-http') {
    return new StreamableHTTPClientTransport(parsedUrl, {
      requestInit: Object.keys(headers).length > 0 ? { headers } : undefined
    })
  }

  return new SSEClientTransport(parsedUrl, {
    requestInit: Object.keys(headers).length > 0 ? { headers } : undefined
  })
}

/**
 * Tests connection to an MCP server (by ID or ad-hoc config), lists discovered tools,
 * and caches the connection if the server is enabled and persisted.
 */
export async function testMcpConnection(
  serverOrId: string | Pick<McpServerConfig, 'id' | 'name' | 'transport' | 'command' | 'args' | 'url' | 'envVars'>,
  customTransportFactory?: (
    cfg: Pick<McpServerConfig, 'transport' | 'command' | 'args' | 'url' | 'envVars'>
  ) => Transport
): Promise<McpConnectionTestResult> {
  const startedAt = Date.now()
  const config =
    typeof serverOrId === 'string' ? getMcpServerWithSecrets(serverOrId) : serverOrId

  if (!config) {
    return {
      ok: false,
      latencyMs: 0,
      tools: [],
      error: 'MCP server configuration not found.'
    }
  }

  let transport: Transport | null = null
  let client: Client | null = null

  try {
    transport = customTransportFactory
      ? customTransportFactory(config)
      : createTransportForConfig(config)
    client = new Client(
      { name: 'noteit-workbench', version: '2.0.0' },
      { capabilities: {} }
    )

    await client.connect(transport)
    const toolsRes = await client.listTools()
    const tools: McpDiscoveredTool[] = (toolsRes.tools || []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined
    }))
    const serverInfo = client.getServerVersion()
    const serverVersion = serverInfo
      ? `${serverInfo.name}${serverInfo.version ? ` v${serverInfo.version}` : ''}`
      : undefined

    // Always close one-off test connections so no orphan child process remains
    await client.close()
    await transport.close()

    return {
      ok: true,
      latencyMs: Math.max(1, Date.now() - startedAt),
      serverVersion,
      tools
    }
  } catch (error) {
    try {
      await client?.close()
    } catch {
      // ignore
    }
    try {
      await transport?.close()
    } catch {
      // ignore
    }
    return {
      ok: false,
      latencyMs: Math.max(1, Date.now() - startedAt),
      tools: [],
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function ensureConnectedMcpServer(
  config: McpServerConfig,
  customTransportFactory?: (
    cfg: Pick<McpServerConfig, 'transport' | 'command' | 'args' | 'url' | 'envVars'>
  ) => Transport
): Promise<ActiveMcpConnection> {
  const existing = activeConnections.get(config.id)
  if (existing) return existing

  const transport = customTransportFactory
    ? customTransportFactory(config)
    : createTransportForConfig(config)
  const client = new Client(
    { name: 'noteit-workbench', version: '2.0.0' },
    { capabilities: {} }
  )
  await client.connect(transport)
  const toolsRes = await client.listTools()
  const tools: McpDiscoveredTool[] = (toolsRes.tools || []).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Record<string, unknown> | undefined
  }))

  const conn: ActiveMcpConnection = {
    serverId: config.id,
    client,
    transport,
    tools
  }
  activeConnections.set(config.id, conn)
  return conn
}

export async function callMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
  customTransportFactory?: (
    cfg: Pick<McpServerConfig, 'transport' | 'command' | 'args' | 'url' | 'envVars'>
  ) => Transport
): Promise<{ ok: boolean; content: unknown; isError?: boolean }> {
  const config = getMcpServerWithSecrets(serverId)
  if (!config) {
    throw new Error(`MCP server not found: ${serverId}`)
  }

  const conn = await ensureConnectedMcpServer(config, customTransportFactory)
  const res = await conn.client.callTool({
    name: toolName,
    arguments: args
  })

  return {
    ok: !res.isError,
    content: res.content,
    isError: Boolean(res.isError)
  }
}

export async function discoverEnabledMcpServerTools(): Promise<
  Array<{
    server: McpServerConfig
    tool: McpDiscoveredTool
  }>
> {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM mcp_servers WHERE enabled = 1 ORDER BY created_at ASC')
    .all() as unknown as McpServerRow[]
  const servers = rows.map((row) => rowToMcpServerConfig(row, false))
  const discovered: Array<{ server: McpServerConfig; tool: McpDiscoveredTool }> = []

  for (const server of servers) {
    try {
      const conn = await ensureConnectedMcpServer(server)
      for (const tool of conn.tools) {
        discovered.push({ server, tool })
      }
    } catch (err) {
      console.warn(`[mcp.service] Failed to connect enabled MCP server "${server.name}":`, err)
    }
  }

  return discovered
}

/**
 * Converts an MCP JSON Schema object into a Zod schema compatible with Vercel AI SDK `tool()`.
 */
export function jsonSchemaToZod(schema?: Record<string, unknown>): z.ZodObject<any> {
  if (!schema || typeof schema !== 'object') {
    return z.object({})
  }

  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>
  const requiredList = Array.isArray(schema.required) ? (schema.required as string[]) : []
  const requiredSet = new Set(requiredList)

  const shape: Record<string, ZodTypeAny> = {}

  for (const [key, prop] of Object.entries(properties)) {
    shape[key] = convertJsonPropertyToZod(prop, requiredSet.has(key))
  }

  return z.object(shape)
}

function convertJsonPropertyToZod(
  prop: Record<string, unknown> | undefined,
  isRequired: boolean
): ZodTypeAny {
  if (!prop || typeof prop !== 'object') {
    return isRequired ? z.any() : z.any().optional()
  }

  const description = typeof prop.description === 'string' ? prop.description : undefined
  const enumValues = Array.isArray(prop.enum) ? prop.enum.filter((v) => typeof v === 'string') : null

  let base: ZodTypeAny
  if (enumValues && enumValues.length > 0) {
    base = z.enum(enumValues as [string, ...string[]])
  } else {
    switch (prop.type) {
      case 'string':
        base = z.string()
        break
      case 'number':
      case 'integer':
        base = z.number()
        break
      case 'boolean':
        base = z.boolean()
        break
      case 'array': {
        const itemsSchema = prop.items as Record<string, unknown> | undefined
        base = z.array(convertJsonPropertyToZod(itemsSchema, true))
        break
      }
      case 'object': {
        base = jsonSchemaToZod(prop)
        break
      }
      default:
        base = z.any()
        break
    }
  }

  if (description) {
    base = base.describe(description)
  }

  return isRequired ? base : base.optional()
}
