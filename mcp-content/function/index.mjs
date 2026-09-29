/**
 * Neon Function entry for the Hub content MCP.
 *
 * Neon Functions expose a web-standard `fetch` handler, so this wraps the
 * shared MCP server with @hono/mcp's StreamableHTTPTransport instead of the
 * node:http server used by mcp-content/server.mjs. Same contract: stateless
 * POSTs to /mcp, bearer/?token=//t/<token>/mcp transport auth, Hub account
 * credentials stay server-side. Never uses DATABASE_URL.
 *
 * Env:
 *   MCP_TOKEN            shared secret (or MCP_ALLOW_ANONYMOUS=1)
 *   HUB_ORIGIN           Hub base URL, e.g. https://youngohub.org
 *   HUB_EMAIL / HUB_PASSWORD  or HUB_TOKEN
 */
import { Hono } from 'hono'
import { timingSafeEqual } from 'node:crypto'
import { StreamableHTTPTransport } from '@hono/mcp'
import { createHubMcpServer, SERVER_INFO } from '../lib/mcpServer.mjs'

const transport = new StreamableHTTPTransport()
const server = createHubMcpServer(process.env)
let connected = false

const expected = String(process.env.MCP_TOKEN || process.env.HUB_MCP_TOKEN || '').trim()
const anonymous = /^(1|true)$/i.test(process.env.MCP_ALLOW_ANONYMOUS || '')

const safeEq = (a, b) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const authorised = (c) => {
  if (anonymous) return true
  if (!expected) return false
  const url = new URL(c.req.url)
  const bearer = c.req.header('authorization') || ''
  return [
    bearer.replace(/^Bearer\s+/i, ''),
    url.searchParams.get('token') || '',
    (url.pathname.match(/^\/t\/([^/]+)\/mcp$/) || [])[1] || '',
  ].some((t) => t && safeEq(t, expected))
}

const app = new Hono()

const handle = async (c) => {
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers':
          'authorization, content-type, accept, mcp-session-id, mcp-protocol-version',
        'access-control-max-age': '86400',
      },
    })
  }
  if (!authorised(c)) {
    if (!expected && !anonymous) {
      return c.json(
        {
          jsonrpc: '2.0',
          error: { code: -32000, message: 'mcp_token_missing' },
          id: null,
        },
        500,
      )
    }
    return new Response(null, { status: 401 })
  }
  if (c.req.method !== 'POST') {
    return new Response(null, { status: 405 })
  }
  if (!connected) {
    await server.connect(transport)
    connected = true
  }
  return transport.handleRequest(c)
}

app.get('/healthz', (c) => c.json({ ok: true, server: SERVER_INFO }))
app.get('/health', (c) => c.json({ ok: true, server: SERVER_INFO }))
app.all('/mcp', handle)
app.all('/t/:token/mcp', handle)

export default app
