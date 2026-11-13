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
 *   MCP_TOKEN            required shared secret, sent as `Authorization: Bearer`
 *                        (never in the url — urls end up in logs). The server
 *                        refuses to start without it.
 *   MCP_ALLOWED_ORIGINS  comma-separated browser origins that get CORS headers
 *   HUB_ORIGIN           default http://localhost:3000
 *   HUB_EMAIL / HUB_PASSWORD  or HUB_TOKEN
 */
import { pathToFileURL } from 'node:url'
import { createAdaptorServer } from '@hono/node-server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { bearerAuth } from 'hono/bearer-auth'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { loadMcpEnv } from './lib/env.mjs'
import { createHubMcpServer, SERVER_INFO } from './lib/mcpServer.mjs'

const MAX_BODY_BYTES = 256 * 1024

const fail = (c, status, code, message) => c.json({ error: { code, message } }, status)

/** @param {{ env?: Partial<NodeJS.ProcessEnv> }} [options] */
export function createMcpApp({ env = process.env } = {}) {
  const token = String(env.MCP_TOKEN || env.HUB_MCP_TOKEN || '').trim()
  if (!token) throw new Error('MCP_TOKEN is required: the content MCP has no anonymous mode.')
  const origins = String(env.MCP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const app = new Hono({ strict: false })

  app.use(async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
  })
  // never reflect arbitrary origins — a web page must not drive the hub account
  app.use(
    cors({
      origin: origins,
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'Accept', 'MCP-Protocol-Version'],
      maxAge: 600,
    }),
  )

  const health = (c) => c.json({ ok: true, server: SERVER_INFO.name })
  app.get('/healthz', health)
  app.get('/health', health)
  app.get('/', (c) =>
    c.json({
      ok: true,
      server: SERVER_INFO,
      mcp: '/mcp',
      healthz: '/healthz',
      auth: 'token',
    }),
  )

  // hono's bearerAuth compares in constant time; header only, no url tokens
  const unauthorized = {
    error: { code: 'unauthorized', message: 'Send Authorization: Bearer <MCP_TOKEN>.' },
  }
  const requireAuth = bearerAuth({
    token,
    noAuthenticationHeader: { message: unauthorized },
    invalidToken: { message: unauthorized },
  })

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

  const mcpPaths = '/mcp'
  app.on('POST', mcpPaths, requireAuth, limit, handleMcp)
  // get/delete are meaningless without sessions — clients POST only
  app.on(['GET', 'DELETE', 'PUT', 'PATCH'], mcpPaths, (c) =>
    fail(c, 405, 'method_not_allowed', 'POST only.'),
  )

  app.notFound((c) => fail(c, 404, 'not_found', 'Not found'))
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse()
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
