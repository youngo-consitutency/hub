#!/usr/bin/env node
// CI smoke: boot mcp-content/server.mjs and complete the MCP handshake. The
// Hub API is deliberately unreachable — tools/list must never need it.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = Number(process.env.MCP_SMOKE_PORT || 18080)
const base = `http://127.0.0.1:${PORT}`

const server = spawn('node', ['mcp-content/server.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    MCP_ALLOW_ANONYMOUS: '1',
    HUB_ORIGIN: 'http://127.0.0.1:9',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
})

function fail(message) {
  console.error(`mcp-smoke: ${message}`)
  server.kill('SIGTERM')
  process.exit(1)
}

process.on('exit', () => server.kill('SIGTERM'))

async function waitReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`${base}/healthz`)
      if (res.ok) return
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  fail('server did not become healthy within 30s')
}

function rpcBody(method, params, id) {
  return {
    jsonrpc: '2.0',
    ...(id == null ? {} : { id }),
    method,
    ...(params == null ? {} : { params }),
  }
}

async function rpc(message) {
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(message),
  })
  const type = res.headers.get('content-type') || ''
  // Notifications are accepted with 202 and carry no response body.
  if (res.status === 202) return null
  if (type.includes('text/event-stream')) {
    const text = await res.text()
    const data = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .pop()
    return data ? JSON.parse(data) : null
  }
  if (type.includes('application/json')) return res.json()
  fail(`unexpected content-type '${type}' (status ${res.status})`)
}

await waitReady()

const init = await rpc(
  rpcBody(
    'initialize',
    {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'ci-smoke', version: '1.0.0' },
    },
    1,
  ),
)
if (init?.result?.serverInfo?.name !== 'youngo-hub')
  fail(`unexpected initialize response: ${JSON.stringify(init)}`)

await rpc(rpcBody('notifications/initialized'))

const list = await rpc(rpcBody('tools/list', {}, 2))
const names = (list?.result?.tools ?? []).map((tool) => tool.name)
for (const required of ['list_opportunities', 'get_content', 'update_content']) {
  if (!names.includes(required))
    fail(`missing tool '${required}' in tools/list: ${names.join(', ')}`)
}

console.log(`mcp-smoke: handshake ok, ${names.length} tools exposed (${names.join(', ')})`)
server.kill('SIGTERM')
process.exit(0)
