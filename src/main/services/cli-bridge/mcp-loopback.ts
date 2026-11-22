import crypto from 'node:crypto'
import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http'

export interface LoopbackMcpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown
}

export interface LoopbackMcpBridge {
  url: string
  token: string
  serverName: string
  /** Writes a strict MCP config object compatible with Claude Code `--mcp-config`. */
  toClaudeMcpConfig(): Record<string, unknown>
  close(): Promise<void>
}

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

const MAX_BODY_BYTES = 2 * 1024 * 1024

function readJsonBody(req: IncomingMessage): Promise<JsonRpcRequest> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('MCP request body exceeds limit'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8')
        resolve(raw ? (JSON.parse(raw) as JsonRpcRequest) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

/**
 * Starts a token-protected loopback HTTP JSON-RPC MCP server on 127.0.0.1:0.
 * Allows external headless CLIs (like Claude Code) to invoke NoteIT's tools while
 * NoteIT retains full authority over credentials, approvals, and workspace state.
 */
export async function startLoopbackMcpBridge(
  tools: LoopbackMcpToolDefinition[],
  serverName = 'noteit_bridge'
): Promise<LoopbackMcpBridge> {
  const token = crypto.randomBytes(24).toString('hex')
  const toolMap = new Map<string, LoopbackMcpToolDefinition>()
  for (const t of tools) {
    toolMap.set(t.name, t)
  }

  const server: Server = http.createServer(async (req, res) => {
    const authHeader = req.headers.authorization || ''
    const expected = `Bearer ${token}`
    const aBuf = Buffer.from(authHeader)
    const bBuf = Buffer.from(expected)
    if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
      sendJson(res, 401, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32001, message: 'Unauthorized loopback MCP request' }
      })
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Only POST is supported' }
      })
      return
    }

    let rpc: JsonRpcRequest
    try {
      rpc = await readJsonBody(req)
    } catch {
      sendJson(res, 400, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      })
      return
    }

    const id = rpc.id ?? null
    const method = rpc.method || ''

    if (method === 'initialize') {
      sendJson(res, 200, {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: serverName, version: '2.3.0' }
        }
      })
      return
    }

    if (method === 'notifications/initialized') {
      res.writeHead(204)
      res.end()
      return
    }

    if (method === 'tools/list') {
      sendJson(res, 200, {
        jsonrpc: '2.0',
        id,
        result: {
          tools: Array.from(toolMap.values()).map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
          }))
        }
      })
      return
    }

    if (method === 'tools/call') {
      const toolName = typeof rpc.params?.name === 'string' ? rpc.params.name : ''
      const args =
        rpc.params?.arguments && typeof rpc.params.arguments === 'object'
          ? (rpc.params.arguments as Record<string, unknown>)
          : {}
      const def = toolMap.get(toolName)
      if (!def) {
        sendJson(res, 200, {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Unknown tool: ${toolName}` }
        })
        return
      }

      try {
        const output = await def.execute(args)
        const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
        sendJson(res, 200, {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text }]
          }
        })
      } catch (err) {
        sendJson(res, 200, {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: err instanceof Error ? err.message : String(err)
              }
            ]
          }
        })
      }
      return
    }

    sendJson(res, 200, {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const addr = server.address()
  if (!addr || typeof addr === 'string') {
    server.close()
    throw new Error('Failed to bind loopback MCP bridge port')
  }

  const url = `http://127.0.0.1:${addr.port}/mcp`

  return {
    url,
    token,
    serverName,
    toClaudeMcpConfig() {
      return {
        mcpServers: {
          [serverName]: {
            type: 'http',
            url,
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      }
    },
    close() {
      return new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
  }
}
