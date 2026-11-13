#!/usr/bin/env node
/**
 * Streamable HTTP MCP for YOUNGO Hub content, on the official
 * @modelcontextprotocol/sdk (stateless transport — no session state).
 *
 * Run as a hosted HTTP service so remote clients (e.g. phone connectors) can reach it.
 * Signs in as a Hub account and calls the live member API. Never uses
 * DATABASE_URL, and never attaches the session-memory tools.
 *
 * Env:
 *   PORT                 default 8080
 *   MCP_ALLOW_ANONYMOUS  1/true — Grok Connectors can use the URL with no
 *                        OAuth and no bearer token. Hub login stays server-side.
 *   MCP_TOKEN            optional shared secret (Bearer, ?token=, or /t/<token>/mcp)
 *   MCP_ALLOWED_ORIGINS  comma-separated browser origins that get CORS headers
 *   HUB_ORIGIN           default http://localhost:3000
 *   HUB_EMAIL / HUB_PASSWORD  or HUB_TOKEN
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createAdaptorServer } from '@hono/node-server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { loadMcpEnv } from './lib/env.mjs'
import { createHubMcpServer, SERVER_INFO } from './lib/mcpServer.mjs'

const MAX_BODY_BYTES = 256 * 1024

// hash first so length differences don't leak through the compare
const digest = (value) => createHash('sha256').update(value).digest()
const tokensMatch = (got, expected) =>
  Boolean(got && expected) && timingSafeEqual(digest(got), digest(expected))

const fail = (c, status, code, message) => c.json({ error: { code, message } }, status)

/** @param {{ env?: Partial<NodeJS.ProcessEnv> }} [options] */
export function createMcpApp({ env = process.env } = {}) {
  const token = String(env.MCP_TOKEN || env.HUB_MCP_TOKEN || '').trim()
  const anonymous = /^(1|true|yes)$/i.test(String(env.MCP_ALLOW_ANONYMOUS || '').trim())
  const origins = String(env.MCP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const app = new Hono({ strict: false })

  app.use(async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })
  // never reflect arbitrary origins — anonymous mode would hand the hub
  // account to any web page
  app.use(
    cors({
      origin: origins,
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'Accept', 'MCP-Protocol-Version'],
      maxAge: 600,
    }),
  )

  const health = (c) => c.json({ ok: true, server: SERVER_INFO.name, anonymous })
  app.get('/healthz', health)
  app.get('/health', health)
  app.get('/', (c) =>
    c.json({
      ok: true,
      server: SERVER_INFO,
      mcp: '/mcp',
      healthz: '/healthz',
      auth: anonymous ? 'none' : 'token',
    }),
  )

  const requireAuth = async (c, next) => {
    if (anonymous) return next()
    if (!token) return fail(c, 500, 'mcp_token_missing', 'Set MCP_ALLOW_ANONYMOUS=1 or MCP_TOKEN.')
    const bearer = c.req.header('authorization')?.match(/^Bearer (.*)$/)?.[1]
    const got =
      bearer ?? c.req.query('token') ?? c.req.query('access_token') ?? c.req.param('token')
    // bare 401, no oauth metadata — some clients still prompt oauth on it
    if (!tokensMatch(String(got || '').trim(), token))
      return fail(
        c,
        401,
        'unauthorized',
        'Pass ?token= on the MCP URL, or set MCP_ALLOW_ANONYMOUS=1. No OAuth.',
      )
    return next()
  }

  const limit = bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => fail(c, 413, 'bad_request', 'payload too large'),
  })

  const handleMcp = async (c) => {
    let body
    try {
      body = await c.req.json()
    } catch {
      return fail(c, 400, 'invalid_json', 'Body must be JSON.')
    }
    // stateless: one server+transport per request; json responses mean the
    // reply is complete once handleRequest resolves, so closing is safe
    const server = createHubMcpServer(env)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    try {
      await server.connect(transport)
      return await transport.handleRequest(c.req.raw, { parsedBody: body })
    } finally {
      await server.close()
    }
  }

  const mcpPaths = ['/mcp', '/t/:token/mcp']
  app.on('POST', mcpPaths, requireAuth, limit, handleMcp)
  // get/delete are meaningless without sessions — clients POST only
  app.on(['GET', 'DELETE', 'PUT', 'PATCH'], mcpPaths, (c) =>
    fail(c, 405, 'method_not_allowed', 'POST only.'),
  )

  app.notFound((c) => fail(c, 404, 'not_found', 'Not found'))
  app.onError((error, c) => {
    console.error('mcp: request handling failed', error)
    return fail(c, 500, 'server_error', 'Internal server error')
  })
  return app
}

/** @param {{ env?: Partial<NodeJS.ProcessEnv> }} [options] */
export const createMcpHttpServer = (options) =>
  createAdaptorServer({ fetch: createMcpApp(options).fetch })

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  loadMcpEnv()
  const port = Number(process.env.PORT || 8080)
  createMcpHttpServer().listen(port, () => {
    console.log(`[mcp] listening on :${port} (mcp at /mcp)`)
  })
}
