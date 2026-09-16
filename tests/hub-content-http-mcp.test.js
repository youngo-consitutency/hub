import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { EVENT_TYPES } from '../shared/contentValidation.js'
import { WORKING_GROUPS } from '../shared/workingGroups.js'
import {
  RESOURCE_LANGUAGES,
  RESOURCE_PATHWAYS,
  RESOURCE_REGIONS,
  RESOURCE_TOPICS,
  RESOURCE_TYPES,
} from '../shared/resourceHub.js'
import {
  OPPORTUNITY_FORMATS,
  OPPORTUNITY_KINDS,
} from '../server/lib/opportunities.js'
import {
  EVENT_TYPES as mcpEventTypes,
  WORKING_GROUPS as mcpWorkingGroups,
  OPPORTUNITY_FORMATS as mcpFormats,
  OPPORTUNITY_KINDS as mcpKinds,
  RESOURCE_LANGUAGES as mcpLanguages,
  RESOURCE_PATHWAYS as mcpPathways,
  RESOURCE_REGIONS as mcpRegions,
  RESOURCE_TOPICS as mcpTopics,
  RESOURCE_TYPES as mcpTypes,
} from '../mcp-content/lib/catalog.mjs'
import { createMcpHttpServer } from '../mcp-content/server.mjs'

const TOKEN = 'test-mcp-token-please-rotate'

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

test('HTTP MCP catalog lists stay aligned with Hub closed lists', () => {
  assert.deepEqual([...mcpEventTypes], [...EVENT_TYPES])
  assert.deepEqual([...mcpWorkingGroups], WORKING_GROUPS)
  assert.deepEqual(mcpKinds, OPPORTUNITY_KINDS)
  assert.deepEqual(mcpFormats, OPPORTUNITY_FORMATS)
  assert.deepEqual([...mcpPathways], [...RESOURCE_PATHWAYS])
  assert.deepEqual([...mcpTypes], [...RESOURCE_TYPES])
  assert.deepEqual([...mcpTopics], [...RESOURCE_TOPICS])
  assert.deepEqual([...mcpRegions], [...RESOURCE_REGIONS])
  assert.deepEqual([...mcpLanguages], [...RESOURCE_LANGUAGES])
})

test('HTTP MCP source never opens the database', async () => {
  const files = await Promise.all([
    readFile(new URL('../mcp-content/server.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../mcp-content/lib/client.mjs', import.meta.url), 'utf8'),
    readFile(
      new URL('../mcp-content/lib/protocol.mjs', import.meta.url),
      'utf8',
    ),
  ])
  for (const source of files) {
    assert.doesNotMatch(source, /from ['"]pg['"]/)
    assert.doesNotMatch(source, /getPool/)
    assert.doesNotMatch(source, /process\.env\.DATABASE_URL/)
  }
})

test('HTTP MCP requires a bearer token and answers initialize', async () => {
  const server = createMcpHttpServer({
    env: { MCP_TOKEN: TOKEN, HUB_ORIGIN: 'https://youngohub.org' },
  })
  const origin = await listen(server)
  try {
    const health = await fetch(`${origin}/healthz`)
    assert.equal(health.status, 200)
    const healthBody = await health.json()
    assert.equal(healthBody.ok, true)

    const anon = await fetch(`${origin}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {} },
      }),
    })
    assert.equal(anon.status, 401)

    const init = await fetch(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    })
    assert.equal(init.status, 200)
    const sessionId = init.headers.get('mcp-session-id')
    assert.ok(sessionId)
    const initBody = await init.json()
    assert.equal(initBody.result.protocolVersion, '2025-03-26')
    assert.equal(initBody.result.serverInfo.name, 'youngo-hub-content')

    const listed = await fetch(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }),
    })
    assert.equal(listed.status, 200)
    const tools = await listed.json()
    const names = tools.result.tools.map((tool) => tool.name)
    assert.ok(names.includes('whoami'))
    assert.ok(names.includes('create_opportunity'))
    assert.ok(names.includes('get_content'))
    assert.ok(names.includes('update_content'))
    assert.ok(names.includes('unpublish_content'))

    const viaQuery = await fetch(`${origin}/mcp?token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {} },
      }),
    })
    assert.equal(viaQuery.status, 200)

    const viaPath = await fetch(`${origin}/t/${TOKEN}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {} },
      }),
    })
    assert.equal(viaPath.status, 200)
  } finally {
    await close(server)
  }
})

test('HTTP MCP anonymous mode skips OAuth and bearer', async () => {
  const server = createMcpHttpServer({
    env: {
      MCP_ALLOW_ANONYMOUS: '1',
      HUB_ORIGIN: 'https://youngohub.org',
    },
  })
  const origin = await listen(server)
  try {
    const init = await fetch(`${origin}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {} },
      }),
    })
    assert.equal(init.status, 200)
    const body = await init.json()
    assert.equal(body.result.serverInfo.name, 'youngo-hub-content')
    assert.ok(init.headers.get('mcp-session-id'))
  } finally {
    await close(server)
  }
})

test('malformed MCP paths return 400 for every method and leave the server healthy', async () => {
  const server = createMcpHttpServer({ env: { MCP_TOKEN: TOKEN } })
  const origin = await listen(server)
  try {
    for (const method of ['GET', 'POST', 'DELETE', 'OPTIONS']) {
      for (const token of ['%', '%ZZ', '%E0%A4']) {
        const result = await fetch(`${origin}/t/${token}/mcp`, { method })
        assert.equal(result.status, 400)
        await result.text()
      }
    }
    const init = await fetch(
      `${origin}/t/${encodeURIComponent(TOKEN)}/mcp/?unused=1`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {},
        }),
      },
    )
    assert.equal(init.status, 200)
    assert.equal((await fetch(`${origin}/healthz`)).status, 200)
  } finally {
    await close(server)
  }
})
