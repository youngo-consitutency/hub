#!/usr/bin/env node
/**
 * Streamable HTTP MCP for YOUNGO Hub content.
 *
 * Hosted on Railway so Grok Build on a phone (Connectors) can reach it.
 * Signs in as a Hub account and calls the live member API. Never uses
 * DATABASE_URL.
 *
 * Env:
 *   PORT                 default 8080
 *   MCP_ALLOW_ANONYMOUS  1/true — Grok Connectors can use the URL with no
 *                        OAuth and no bearer token. Hub login stays server-side.
 *   MCP_TOKEN            optional shared secret (Bearer, ?token=, or /t/<token>/mcp)
 *   HUB_ORIGIN           default https://youngohub.org
 *   HUB_EMAIL / HUB_PASSWORD  or HUB_TOKEN
 */
import http from 'node:http'
import { timingSafeEqual, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createToolRunner, SERVER_INFO } from './lib/protocol.mjs'

const MAX_BODY_BYTES = 256 * 1024

function mcpToken(env = process.env) {
  return String(env.MCP_TOKEN || env.HUB_MCP_TOKEN || '').trim()
}

function allowAnonymous(env = process.env) {
  const raw = String(env.MCP_ALLOW_ANONYMOUS || '').trim().toLowerCase()
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
  const query = url.searchParams.get('token') || url.searchParams.get('access_token')
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

function sendSse(res, status, body, extraHeaders = {}) {
  const data = `event: message\ndata: ${JSON.stringify(body)}\n\n`
  res.writeHead(status, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...extraHeaders,
  })
  res.end(data)
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

function wantsSse(req) {
  const accept = String(req.headers.accept || '')
  return (
    accept.includes('text/event-stream') && !accept.includes('application/json')
  )
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

function sessionHeaders(sessionId) {
  return sessionId ? { 'mcp-session-id': sessionId } : {}
}

export function createMcpHttpServer({
  env = process.env,
  runner = createToolRunner(env),
} = {}) {
  const sessions = new Map()
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

    let message
    try {
      message = raw ? JSON.parse(raw) : {}
    } catch {
      sendJson(
        res,
        400,
        { error: { code: 'invalid_json', message: 'Body must be JSON.' } },
        corsHeaders(req),
      )
      return
    }

    let sessionId = String(req.headers['mcp-session-id'] || '').trim()
    if (message?.method === 'initialize') {
      sessionId = randomUUID()
      sessions.set(sessionId, { createdAt: Date.now() })
    } else if (sessionId && !sessions.has(sessionId)) {
      sessions.set(sessionId, { createdAt: Date.now() })
    }

    const headers = { ...corsHeaders(req), ...sessionHeaders(sessionId) }

    if (Array.isArray(message)) {
      const results = []
      for (const item of message) {
        const out = await runner.dispatch(item)
        if (out) results.push(out)
      }
      if (results.length === 0) {
        res.writeHead(202, headers)
        res.end()
        return
      }
      if (wantsSse(req)) sendSse(res, 200, results, headers)
      else sendJson(res, 200, results, headers)
      return
    }

    const out = await runner.dispatch(message)
    if (out == null) {
      res.writeHead(202, headers)
      res.end()
      return
    }
    if (wantsSse(req)) sendSse(res, 200, out, headers)
    else sendJson(res, 200, out, headers)
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const mcp = parseMcpPath(url.pathname)

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
      try {
        await handleMcpPost(req, res, url, mcp.pathToken)
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
      return
    }

    if (req.method === 'GET') {
      if (!requireAuth(req, res, url, mcp.pathToken)) return
      const sessionId =
        String(req.headers['mcp-session-id'] || '').trim() || randomUUID()
      sessions.set(sessionId, { createdAt: Date.now() })
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...corsHeaders(req),
        ...sessionHeaders(sessionId),
      })
      res.write(': connected\n\n')
      const timer = setInterval(() => {
        if (res.writableEnded) {
          clearInterval(timer)
          return
        }
        res.write(': keepalive\n\n')
      }, 25000)
      req.on('close', () => clearInterval(timer))
      return
    }

    if (req.method === 'DELETE') {
      if (!requireAuth(req, res, url, mcp.pathToken)) return
      const sessionId = String(req.headers['mcp-session-id'] || '').trim()
      if (sessionId) sessions.delete(sessionId)
      res.writeHead(204, corsHeaders(req))
      res.end()
      return
    }

    sendJson(res, 405, {
      error: { code: 'method_not_allowed', message: 'Use POST /mcp' },
    })
  })

  return server
}

function isMain() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(entry).href
}

if (isMain()) {
  const env = process.env
  const token = mcpToken(env)
  const anonymous = allowAnonymous(env)
  if (!token && !anonymous) {
    console.error('Set MCP_ALLOW_ANONYMOUS=1 or MCP_TOKEN to start.')
    process.exit(1)
  }
  const port = Number(env.PORT || 8080)
  const server = createMcpHttpServer({ env })
  server.listen(port, '0.0.0.0', () => {
    const mode = anonymous ? 'anonymous (no OAuth)' : 'token (no OAuth)'
    console.log(`youngo-hub-content MCP listening on :${port}/mcp (${mode})`)
  })
}
