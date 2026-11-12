#!/usr/bin/env node
/**
 * Streamable HTTP MCP for the YOUNGO connector.
 * Forwards each call to the Hub agent gateway with the caller's own key.
 * No database and no shared login.
 *
 * Env: PORT, HUB_ORIGIN, HUB_AGENT_GATEWAY_TOKEN, optional YOUNGO_MCP_ORIGINS.
 */
import { pathToFileURL } from 'node:url'
import { createAdaptorServer } from '@hono/node-server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { z } from 'zod'

const SERVER_INFO = { name: 'youngo', version: '1.1.0' }
const MAX_BODY_BYTES = 32 * 1024
const UNAVAILABLE = 'The Hub connector is unavailable.'

const wgSlug = z.string()
const TOOLS = {
  whoami: {
    description:
      'Return this connector account, the groups it manages, and the tools this key can call. Does not return email or private profile fields.',
    input: {},
  },
  list_my_groups: { description: 'List working groups this key can manage.', input: {} },
  list_wg_activity: {
    description: 'List recent activity for one working group this key manages.',
    input: { wgSlug },
  },
  add_wg_activity: {
    description:
      'Add an activity to a working group this key manages. Requires an idempotency key.',
    input: {
      wgSlug,
      kind: z.enum(['call', 'submission', 'campaign', 'action_point']),
      title: z.string(),
      body: z.string().optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
      url: z.string().optional(),
      taskForceSlug: z.string().optional(),
      idempotencyKey: z.string(),
    },
  },
  list_wg_joiners: {
    description:
      'List display names, roles, and status for people who joined a working group this key manages. Does not return email addresses or account ids.',
    input: { wgSlug },
  },
  constituency_status: {
    description:
      'Counts of active contact points and active members for each working group. No names or emails.',
    input: {},
  },
  mandate_gaps: {
    description:
      'Operator list of active mandates whose holder cannot exercise them, with the gate that is closed. Refers to authority records, never to names or email addresses.',
    input: {},
  },
}

const UNKNOWN_TOOL = { description: 'YOUNGO Hub connector tool.', input: {} }
// sdk's tool-name rules; its registry is a plain object, so prototype keys
// (constructor, __proto__) throw "already registered". skip both and let the
// sdk answer not-found
const TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/
const registrable = (name) => TOOL_NAME.test(name) && !(name in Object.prototype)

const fail = (c, status, code, message) => c.json({ error: { code, message } }, status)
const list = (raw) =>
  String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

async function gateway(env, key, tool, args = {}) {
  const token = String(env.HUB_AGENT_GATEWAY_TOKEN || '')
  if (!token || !key) throw new Error(UNAVAILABLE)
  const origin = String(env.HUB_ORIGIN || 'https://youngohub.org').replace(/\/+$/, '')
  const response = await fetch(`${origin}/api/agent/v1/call`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Youngo-Key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ tool, arguments: args }),
  }).catch(() => {
    throw new Error(UNAVAILABLE)
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw Object.assign(new Error(data?.error?.message || UNAVAILABLE), {
      code: data?.error?.code,
    })
  }
  return data
}

const textResult = (data, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  ...(isError ? { isError } : {}),
})

// per request and per key: tools/list carries only what this key may call
function createYoungoServer(env, key, names) {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } })
  for (const name of names.filter(registrable)) {
    // new gateway tools still show up before this file learns about them
    const { description, input } = Object.hasOwn(TOOLS, name) ? TOOLS[name] : UNKNOWN_TOOL
    // loose: shapes are for the listing, the gateway owns validation
    const inputSchema = z.looseObject(input)
    server.registerTool(name, { description, inputSchema }, async (args) => {
      try {
        return textResult(await gateway(env, key, name, args))
      } catch (error) {
        const code = error.code || 'hub_unavailable'
        return textResult({ error: { code, message: error.message } }, true)
      }
    })
  }
  return server
}

export function createYoungoMcpApp({ env = process.env } = {}) {
  const origins = list(env.YOUNGO_MCP_ORIGINS)
  const app = new Hono({ strict: false })

  app.use(async (c, next) => {
    const origin = c.req.header('origin')
    if (origin && !origins.includes(origin))
      return fail(c, 403, 'forbidden', 'Origin is not allowed.')
    await next()
    c.header('Cache-Control', 'no-store')
  })
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

  app.post(
    '/mcp',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => fail(c, 413, 'bad_request', 'Request body is too large.'),
    }),
    async (c) => {
      let body
      try {
        body = await c.req.json()
      } catch {
        return fail(c, 400, 'invalid_json', 'Body must be JSON.')
      }
      const key =
        c.req
          .header('authorization')
          ?.match(/^Bearer (.*)$/)?.[1]
          ?.trim() || ''
      const messages = [body].flat()
      const listing = messages.some((message) => message?.method === 'tools/list')
      // calls register whatever they name; the gateway decides if the key may use it
      const called = messages
        .filter((message) => message?.method === 'tools/call')
        .map((message) => String(message.params?.name || ''))
        .filter(registrable)
      let names = [...new Set([...Object.keys(TOOLS), ...called])]
      if (listing) {
        try {
          names = (await gateway(env, key, 'describe_tools')).tools || []
        } catch (error) {
          const id = Array.isArray(body) ? null : (body?.id ?? null)
          return c.json({ jsonrpc: '2.0', id, error: { code: -32000, message: error.message } })
        }
      }
      // older connectors post bare json with no accept header; the sdk
      // insists on both types, so fill them in rather than 406 them
      const headers = new Headers(c.req.raw.headers)
      const accept = headers.get('accept') || ''
      if (!accept.includes('application/json') || !accept.includes('text/event-stream'))
        headers.set('accept', 'application/json, text/event-stream')
      if (!headers.get('content-type')) headers.set('content-type', 'application/json')

      const server = createYoungoServer(env, key, names)
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })
      try {
        await server.connect(transport)
        return await transport.handleRequest(new Request(c.req.url, { method: 'POST', headers }), {
          parsedBody: body,
        })
      } finally {
        await server.close()
      }
    },
  )
  app.all('/mcp', (c) => fail(c, 405, 'method_not_allowed', 'Use POST /mcp'))
  app.notFound((c) => fail(c, 404, 'not_found', 'Not found.'))
  app.onError((error, c) => {
    console.error('youngo mcp: request failed', error)
    return fail(c, 500, 'server_error', 'Internal server error')
  })
  return app
}

export const createYoungoMcpServer = (options) =>
  createAdaptorServer({ fetch: createYoungoMcpApp(options).fetch })

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  // holds no db — make sure an inherited one can't leak into this process
  delete process.env.DATABASE_URL
  delete process.env.PAYLOAD_SECRET
  const port = Number(process.env.PORT || 8080)
  createYoungoMcpServer().listen(port, '0.0.0.0', () => {
    console.log(`youngo MCP listening on :${port}/mcp`)
  })
}
