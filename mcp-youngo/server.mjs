#!/usr/bin/env node
/**
 * Streamable HTTP MCP for the YOUNGO connector.
 * Forwards each call to the Hub agent gateway. No database and no shared login.
 *
 * Env: PORT, HUB_ORIGIN, HUB_AGENT_GATEWAY_TOKEN, optional YOUNGO_MCP_ORIGINS.
 */
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const PROTOCOL_VERSIONS = new Set(['2024-11-05', '2025-03-26'])
const SERVER_INFO = { name: 'youngo', version: '1.0.0' }
const MAX_BODY_BYTES = 32 * 1024
const TOOL_SCHEMAS = {
  whoami: {
    description:
      'Return this connector account, the groups it manages, and the tools this key can call. Does not return email or private profile fields.',
    inputSchema: { type: 'object', properties: {} },
  },
  list_my_groups: {
    description: 'List working groups this key can manage.',
    inputSchema: { type: 'object', properties: {} },
  },
  list_wg_activity: {
    description: 'List recent activity for one working group this key manages.',
    inputSchema: {
      type: 'object',
      properties: { wgSlug: { type: 'string' } },
      required: ['wgSlug'],
    },
  },
  add_wg_activity: {
    description:
      'Add an activity to a working group this key manages. Requires an idempotency key.',
    inputSchema: {
      type: 'object',
      properties: {
        wgSlug: { type: 'string' },
        kind: {
          type: 'string',
          enum: ['call', 'submission', 'campaign', 'action_point'],
        },
        title: { type: 'string' },
        body: { type: 'string' },
        startsAt: { type: 'string' },
        endsAt: { type: 'string' },
        url: { type: 'string' },
        taskForceSlug: { type: 'string' },
        idempotencyKey: { type: 'string' },
      },
      required: ['wgSlug', 'kind', 'title', 'idempotencyKey'],
    },
  },
  list_wg_joiners: {
    description:
      'List display names, roles, and status for people who joined a working group this key manages. Does not return email addresses or account ids.',
    inputSchema: {
      type: 'object',
      properties: { wgSlug: { type: 'string' } },
      required: ['wgSlug'],
    },
  },
  constituency_status: {
    description:
      'Counts of active contact points and active members for each working group. No names or emails.',
    inputSchema: { type: 'object', properties: {} },
  },
  mandate_gaps: {
    description:
      'Operator list of active mandates whose holder cannot exercise them, with the gate that is closed. Refers to authority records, never to names or email addresses.',
    inputSchema: { type: 'object', properties: {} },
  },
}

function hubOrigin(env = process.env) {
  return String(env.HUB_ORIGIN || 'https://youngohub.org').replace(/\/+$/, '')
}

function allowedOrigins(env = process.env) {
  return new Set(
    String(env.YOUNGO_MCP_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function userKey(req) {
  const header = String(req.headers.authorization || '')
  if (!header.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length).trim()
}

function corsHeaders(req, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, Accept, mcp-session-id, Mcp-Session-Id, MCP-Protocol-Version',
    'Access-Control-Expose-Headers': 'mcp-session-id, Mcp-Session-Id',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
  }
  const origin = req.headers.origin
  if (!origin) return { ok: true, headers }
  if (!allowedOrigins(env).has(origin)) return { ok: false, headers }
  headers['Access-Control-Allow-Origin'] = origin
  return { ok: true, headers }
}

function sendJson(res, status, body, extra = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extra,
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function gateway(env, key, tool, args) {
  const token = String(env.HUB_AGENT_GATEWAY_TOKEN || '')
  if (!token || !key) {
    const error = new Error('The Hub connector is unavailable.')
    error.expose = true
    throw error
  }
  let response
  try {
    response = await fetch(`${hubOrigin(env)}/api/agent/v1/call`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Youngo-Key': key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ tool, arguments: args || {} }),
    })
  } catch {
    const error = new Error('The Hub connector is unavailable.')
    error.expose = true
    throw error
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'The Hub connector is unavailable.')
    error.expose = true
    error.status = response.status
    error.code = data?.error?.code
    throw error
  }
  return data
}

function toolResult(data, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  }
}

function createRunner(env) {
  return {
    async dispatch(message, key) {
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        return {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid Request' },
        }
      }
      const { id, method, params } = message
      if (method === 'initialize') {
        const requested = String(params?.protocolVersion || '')
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: PROTOCOL_VERSIONS.has(requested) ? requested : '2024-11-05',
            serverInfo: SERVER_INFO,
            capabilities: { tools: {} },
          },
        }
      }
      if (method === 'notifications/initialized' || method === 'initialized') {
        return null
      }
      if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }
      if (method === 'tools/list' || method === 'tools/call') {
        try {
          if (method === 'tools/list') {
            const described = await gateway(env, key, 'describe_tools', {})
            const tools = (described.tools || []).map((name) => ({
              name,
              description: TOOL_SCHEMAS[name]?.description || 'YOUNGO Hub connector tool.',
              inputSchema: TOOL_SCHEMAS[name]?.inputSchema || {
                type: 'object',
                properties: {},
              },
            }))
            return { jsonrpc: '2.0', id, result: { tools } }
          }
          const data = await gateway(env, key, params?.name, params?.arguments || {})
          return { jsonrpc: '2.0', id, result: toolResult(data) }
        } catch (error) {
          return {
            jsonrpc: '2.0',
            id,
            result: toolResult(
              {
                error: {
                  code: error.code || 'hub_unavailable',
                  message: error.expose ? error.message : 'The Hub connector is unavailable.',
                },
              },
              true,
            ),
          }
        }
      }
      if (id != null) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        }
      }
      return null
    },
  }
}

export function createYoungoMcpServer({ env = process.env } = {}) {
  const runner = createRunner(env)
  return http.createServer(async (req, res) => {
    const cors = corsHeaders(req, env)
    if (!cors.ok) {
      sendJson(res, 403, {
        error: { code: 'forbidden', message: 'Origin is not allowed.' },
      })
      return
    }
    const url = new URL(req.url || '/', 'http://localhost')
    const path = url.pathname.replace(/\/+$/, '') || '/'
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors.headers)
      res.end()
      return
    }
    if (req.method === 'GET' && (path === '/healthz' || path === '/health')) {
      sendJson(res, 200, { ok: true, server: SERVER_INFO.name }, cors.headers)
      return
    }
    if (path !== '/mcp') {
      sendJson(res, 404, { error: { code: 'not_found', message: 'Not found.' } }, cors.headers)
      return
    }
    if (req.method !== 'POST') {
      sendJson(
        res,
        405,
        { error: { code: 'method_not_allowed', message: 'Use POST /mcp' } },
        cors.headers,
      )
      return
    }
    let raw
    try {
      raw = await readBody(req)
    } catch (error) {
      sendJson(
        res,
        error.status || 400,
        {
          error: { code: 'bad_request', message: 'Request body is too large.' },
        },
        cors.headers,
      )
      return
    }
    let message
    try {
      message = raw ? JSON.parse(raw) : {}
    } catch {
      sendJson(
        res,
        400,
        { error: { code: 'invalid_json', message: 'Body must be JSON.' } },
        cors.headers,
      )
      return
    }
    const sessionId = randomUUID()
    const headers = { ...cors.headers, 'mcp-session-id': sessionId }
    const out = await runner.dispatch(message, userKey(req))
    if (out == null) {
      res.writeHead(202, headers)
      res.end()
      return
    }
    sendJson(res, 200, out, headers)
  })
}

function isMain() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(entry).href
}

if (isMain()) {
  const port = Number(process.env.PORT || 8080)
  const server = createYoungoMcpServer()
  server.listen(port, '0.0.0.0', () => {
    console.log(`youngo MCP listening on :${port}/mcp`)
  })
}
