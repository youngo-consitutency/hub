#!/usr/bin/env node
/**
 * Streamable HTTP MCP for YOUNGO Hub content, on the official
 * @modelcontextprotocol/sdk (stateless transport — no session state).
 *
 * Run as a hosted HTTP service so remote clients (e.g. phone connectors) can reach it.
 * Signs in as a Hub account and calls the live member API. Never uses
 * DATABASE_URL.
 *
 * Env:
 *   PORT                 default 8080
 *   MCP_ALLOW_ANONYMOUS  1/true — Grok Connectors can use the URL with no
 *                        OAuth and no bearer token. Hub login stays server-side.
 *   MCP_TOKEN            optional shared secret (Bearer, ?token=, or /t/<token>/mcp)
 *   HUB_ORIGIN           default http://localhost:3000
 *   HUB_EMAIL / HUB_PASSWORD  or HUB_TOKEN
 */
import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createHubMcpServer, SERVER_INFO } from './lib/mcpServer.mjs'

// Load .env.local/.env when running from the repo checkout (dotenv is a root
// dependency). Hosted deployments inject real env vars, which always win —
// dotenv never overrides existing values.
try {
  const { config: loadEnv } = await import('dotenv')
  loadEnv({ path: ['.env.local', '.env'] })
} catch {
  /* standalone deployment without the repo's node_modules */
}

const MAX_BODY_BYTES = 256 * 1024

/** @param {Partial<NodeJS.ProcessEnv>} [env] */
function mcpToken(env = process.env) {
  return String(env.MCP_TOKEN || env.HUB_MCP_TOKEN || '').trim()
}

/** @param {Partial<NodeJS.ProcessEnv>} [env] */
function allowAnonymous(env = process.env) {
  const raw = String(env.MCP_ALLOW_ANONYMOUS || '')
    .trim()
    .toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function parseMcpPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/mcp') return { isMcp: true, pathToken: '' }
  const match = path.match(/^\/t\/([^/]+)\/mcp$/)
  if (match) {
    return { isMcp: true, pathToken: decodeURIComponent(match[1]) }
  }
  return { isMcp: false, pathToken: '' }
}

function providedToken(req, url, pathToken) {
  const header = String(req.headers.authorization || '')
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim()
  const query =
    url.searchParams.get('token') || url.searchParams.get('access_token')
  if (query) return query.trim()
  return String(pathToken || '').trim()
}

function bearerMatches(header, token) {
  if (!token || !header) return false
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) return false
  const got = Buffer.from(header.slice(prefix.length))
  const expected = Buffer.from(token)
  if (got.length !== expected.length) {
    timingSafeEqual(expected, expected)
    return false
  }
  return timingSafeEqual(got, expected)
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  res.end(payload)
}

function corsHeaders(req) {
  const origin = req.headers.origin
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, Accept, mcp-session-id, Mcp-Session-Id, MCP-Protocol-Version',
    'Access-Control-Expose-Headers': 'mcp-session-id, Mcp-Session-Id',
    'Access-Control-Max-Age': '600',
  }
  if (origin) headers['Access-Control-Allow-Origin'] = origin
  return headers
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

/** @param {{ env?: Partial<NodeJS.ProcessEnv> }} [options] */
export function createMcpHttpServer({ env = process.env } = {}) {
  const token = mcpToken(env)
  const anonymous = allowAnonymous(env)

  function requireAuth(req, res, url, pathToken) {
    if (anonymous) return true
    if (!token) {
      sendJson(
        res,
        500,
        {
          error: {
            code: 'mcp_token_missing',
            message: 'Set MCP_ALLOW_ANONYMOUS=1 or MCP_TOKEN.',
          },
        },
        corsHeaders(req),
      )
      return false
    }
    const got = providedToken(req, url, pathToken)
    if (!bearerMatches(`Bearer ${got}`, token)) {
      // 401 with no WWW-Authenticate / OAuth metadata. Grok Connectors treat
      // OAuth discovery as required when a protected-resource challenge is
      // advertised; a bare 401 still may prompt OAuth, so prefer anonymous
      // mode or a ?token= URL for phone clients.
      sendJson(
        res,
        401,
        {
          error: {
            code: 'unauthorized',
            message:
              'Pass ?token= on the MCP URL, or set MCP_ALLOW_ANONYMOUS=1. No OAuth.',
          },
        },
        corsHeaders(req),
      )
      return false
    }
    return true
  }

  async function handleMcpPost(req, res, url, pathToken) {
    if (!requireAuth(req, res, url, pathToken)) return

    let raw
    try {
      raw = await readBody(req)
    } catch (error) {
      sendJson(
        res,
        error.status || 400,
        { error: { code: 'bad_request', message: error.message } },
        corsHeaders(req),
      )
      return
    }

    let body
    try {
      body = raw ? JSON.parse(raw) : undefined
    } catch {
      sendJson(
        res,
        400,
        { error: { code: 'invalid_json', message: 'Body must be JSON.' } },
        corsHeaders(req),
      )
      return
    }

    // Stateless transport: one Server+transport pair per request, per the
    // SDK's recommended pattern for servers without session state.
    const server = createHubMcpServer(env)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })
    res.on('close', () => {
      transport.close()
      server.close()
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(req, res, body)
    } catch (error) {
      if (!res.headersSent) {
        sendJson(
          res,
          500,
          {
            error: {
              code: 'server_error',
              message: String(error.message || error),
            },
          },
          corsHeaders(req),
        )
      }
    }
  }

  return http.createServer(async (req, res) => {
    let url, mcp
    try {
      url = new URL(req.url || '/', 'http://localhost')
      mcp = parseMcpPath(url.pathname)
    } catch {
      sendJson(res, 400, {
        error: { code: 'invalid_path', message: 'Invalid request path.' },
      })
      return
    }
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req))
      res.end()
      return
    }

    if (req.method === 'GET' && (path === '/healthz' || path === '/health')) {
      sendJson(res, 200, {
        ok: true,
        server: SERVER_INFO.name,
        anonymous: anonymous,
      })
      return
    }

    if (req.method === 'GET' && path === '/') {
      sendJson(res, 200, {
        ok: true,
        server: SERVER_INFO,
        mcp: '/mcp',
        healthz: '/healthz',
        auth: anonymous ? 'none' : 'token',
      })
      return
    }

    if (!mcp.isMcp) {
      sendJson(res, 404, { error: { code: 'not_found', message: 'Not found' } })
      return
    }

    if (req.method === 'POST') {
      await handleMcpPost(req, res, url, mcp.pathToken)
      return
    }

    // Stateless transport: GET streams and DELETE session teardown are
    // meaningless without sessions — MCP clients POST only.
    sendJson(
      res,
      405,
      { error: { code: 'method_not_allowed', message: 'POST only.' } },
      corsHeaders(req),
    )
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8080)
  const server = createMcpHttpServer()
  server.listen(port, () => {
    console.log(`[mcp] listening on :${port} (mcp at /mcp)`)
  })
}
