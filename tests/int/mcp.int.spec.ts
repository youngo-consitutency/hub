/**
 * Content-MCP integration tests. Transport-level cases run a real HTTP
 * server with no Hub dependency; the end-to-end case provisions an account
 * in the test database and drives a tools/call through the MCP protocol
 * into the live member API.
 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest'

import { createMcpHttpServer } from '../../mcp-content/server.mjs'
import {
  createHubClient,
  resolveHubOrigin,
  callHubContentTool,
} from '../../mcp-content/lib/client.mjs'
import { toolErrorText } from '../../mcp-content/lib/mcpServer.mjs'

import { provisionAccount } from './provision'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
const MCP_TOKEN = `it-mcp-${Math.random().toString(36).slice(2, 12)}`

type McpServer = ReturnType<typeof createMcpHttpServer>

async function startMcp(env: Record<string, string>) {
  const server: McpServer = createMcpHttpServer({ env })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

// Stateless transport responds with SSE frames; peel the JSON-RPC message
// out of the data: lines. Plain JSON responses (error paths) parse directly.
function parseRpcBody(text: string, contentType: string) {
  if (contentType.includes('text/event-stream')) {
    const messages = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => JSON.parse(line.slice(5).trim()))
    return messages.at(-1)
  }
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

async function rpc(
  port: number,
  body: unknown,
  opts: { token?: string; path?: string; accept?: string } = {},
) {
  const res = await fetch(`http://127.0.0.1:${port}${opts.path ?? '/mcp'}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: opts.accept ?? 'application/json, text/event-stream',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const text = await res.text()
  return {
    status: res.status,
    body: parseRpcBody(text, res.headers.get('content-type') || ''),
  }
}

const listTools = (port: number, opts: Parameters<typeof rpc>[2] = {}) =>
  rpc(port, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, opts)

describe('mcp http transport', () => {
  let mcp: Awaited<ReturnType<typeof startMcp>>

  beforeAll(async () => {
    mcp = await startMcp({ MCP_TOKEN })
  })

  afterAll(() => mcp.close())

  it('serves healthz and the root descriptor without auth', async () => {
    const health = await fetch(`http://127.0.0.1:${mcp.port}/healthz`)
    expect(health.status).toBe(200)
    const healthBody = await health.json()
    expect(healthBody).toMatchObject({ ok: true, anonymous: false })

    const root = await fetch(`http://127.0.0.1:${mcp.port}/`)
    expect(root.status).toBe(200)
    const rootBody = await root.json()
    expect(rootBody).toMatchObject({
      ok: true,
      mcp: '/mcp',
      auth: 'token',
    })
    expect(rootBody.server?.name).toBe('youngo-hub-content')
  })

  it('rejects non-MCP paths and non-POST methods', async () => {
    const missing = await fetch(`http://127.0.0.1:${mcp.port}/other`)
    expect(missing.status).toBe(404)

    const get = await fetch(`http://127.0.0.1:${mcp.port}/mcp`)
    expect(get.status).toBe(405)
    const body = await get.json()
    expect(body.error?.code).toBe('method_not_allowed')
  })

  it('fails closed when neither MCP_TOKEN nor anonymous mode is set', async () => {
    const open = await startMcp({})
    try {
      const res = await listTools(open.port)
      expect(res.status).toBe(500)
      expect(res.body?.error?.code).toBe('mcp_token_missing')
    } finally {
      await open.close()
    }
  })

  it('rejects missing and wrong tokens with a bare 401', async () => {
    const none = await listTools(mcp.port)
    expect(none.status).toBe(401)
    expect(none.body?.error?.code).toBe('unauthorized')
    // No WWW-Authenticate: OAuth discovery must not be advertised.
    expect(none.body?.error?.message).toMatch(/token/i)

    const wrong = await listTools(mcp.port, { token: 'wrong-token' })
    expect(wrong.status).toBe(401)
  })

  it('accepts the token via bearer, query, and path forms', async () => {
    for (const opts of [
      { token: MCP_TOKEN },
      { path: `/mcp?token=${MCP_TOKEN}` },
      { path: `/t/${MCP_TOKEN}/mcp` },
    ]) {
      const res = await listTools(mcp.port, opts)
      expect(res.status).toBe(200)
      const names = res.body?.result?.tools?.map(
        (tool: { name: string }) => tool.name,
      )
      expect(names).toContain('whoami')
      expect(names).toContain('create_content_draft')
    }
  })

  it('rejects malformed JSON and missing Accept types', async () => {
    const badJson = await rpc(mcp.port, '{not json', { token: MCP_TOKEN })
    expect(badJson.status).toBe(400)
    expect(badJson.body?.error?.code).toBe('invalid_json')

    const badAccept = await listTools(mcp.port, {
      token: MCP_TOKEN,
      accept: 'application/json',
    })
    expect(badAccept.status).toBe(406)
  })

  it('anonymous mode lists tools but still requires Hub credentials to call', async () => {
    const open = await startMcp({ MCP_ALLOW_ANONYMOUS: '1' })
    try {
      const res = await listTools(open.port)
      expect(res.status).toBe(200)
      expect(res.body?.result?.tools?.length).toBeGreaterThan(0)

      const call = await rpc(
        open.port,
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'whoami', arguments: {} },
        },
      )
      expect(call.status).toBe(200)
      expect(call.body?.result?.isError).toBe(true)
      expect(call.body?.result?.content?.[0]?.text).toMatch(/HUB_EMAIL/)
    } finally {
      await open.close()
    }
  })
})

describe('hub api client', () => {
  it('validates HUB_ORIGIN', () => {
    expect(resolveHubOrigin({})).toBe('http://localhost:3000')
    expect(resolveHubOrigin({ HUB_ORIGIN: 'https://hub.example/' })).toBe(
      'https://hub.example',
    )
    expect(() => resolveHubOrigin({ HUB_ORIGIN: 'hub.example' })).toThrow(/http/)
  })

  it('signs in once and reuses the session token', async () => {
    const calls: { url: string; auth?: string }[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url =
        typeof input === 'string' || input instanceof URL
          ? String(input)
          : input.url
      calls.push({
        url,
        auth: new Headers(init?.headers).get('Authorization') ?? undefined,
      })
      const path = new URL(url).pathname
      if (path === '/api/auth/login') {
        return new Response(
          JSON.stringify({ token: 'sess-1', account: { id: 'a1' } }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ account: { id: 'a1' } }), {
        status: 200,
      })
    }

    const client = createHubClient({
      origin: 'https://hub.example',
      email: 'member@example.invalid',
      password: 'pw',
      fetchImpl,
    })
    await client.memberGet('/api/member/opportunities')
    await client.memberGet('/api/member/opportunities')

    const logins = calls.filter((c) => c.url.endsWith('/api/auth/login'))
    expect(logins).toHaveLength(1)
    const memberCalls = calls.filter((c) =>
      c.url.includes('/api/member/opportunities'),
    )
    expect(memberCalls).toHaveLength(2)
    expect(memberCalls.every((c) => c.auth === 'Bearer sess-1')).toBe(true)
  })

  it('propagates the Hub error contract', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'forbidden',
            message: 'No access',
            fields: { orgId: 'not yours' },
          },
        }),
        { status: 403 },
      )
    const client = createHubClient({
      origin: 'https://hub.example',
      token: 'sess-1',
      fetchImpl,
    })
    const error = await client
      .memberGet('/api/member/opportunities')
      .catch((e: unknown) => e)
    expect(error).toMatchObject({
      status: 403,
      code: 'forbidden',
      fields: { orgId: 'not yours' },
    })
  })

  it('normalises tool errors and rejects unknown tools', async () => {
    const withCode = toolErrorText(
      Object.assign(new Error('No access'), {
        code: 'forbidden',
        status: 403,
        fields: { orgId: 'x' },
      }),
    )
    const parsed = JSON.parse(withCode)
    expect(parsed.error).toMatchObject({
      code: 'forbidden',
      status: 403,
      fields: { orgId: 'x' },
    })
    expect(toolErrorText(new Error('plain'))).toBe('plain')

    const client = createHubClient({
      origin: 'https://hub.example',
      token: 'sess-1',
      fetchImpl: async () => new Response('{}', { status: 200 }),
    })
    await expect(callHubContentTool('nope', {}, client)).rejects.toThrow(
      /Unknown tool/,
    )
  })
})

describe('end-to-end', () => {
  it('answers tools/call whoami for a provisioned Hub account', async () => {
    const { email, password } = await provisionAccount({})
    const mcp = await startMcp({
      MCP_TOKEN,
      HUB_ORIGIN: BASE,
      HUB_EMAIL: email,
      HUB_PASSWORD: password,
    })
    try {
      const res = await rpc(
        mcp.port,
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'whoami', arguments: {} },
        },
        { token: MCP_TOKEN },
      )
      expect(res.status).toBe(200)
      expect(res.body?.result?.isError).toBeFalsy()
      const payload = JSON.parse(res.body?.result?.content?.[0]?.text)
      expect(JSON.stringify(payload)).toContain(email)
    } finally {
      await mcp.close()
    }
  })
})
