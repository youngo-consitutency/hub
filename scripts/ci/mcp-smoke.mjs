#!/usr/bin/env node
// CI smoke: boot mcp-content/server.mjs and complete the MCP handshake. The
// Hub API is deliberately unreachable — tools/list must never need it. Also
// proves the isolation contract: db secrets never reach the process, the
// .env loader is allow-listed, and memory tools stay off the http surface.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = Number(process.env.MCP_SMOKE_PORT || 18080)
const base = `http://127.0.0.1:${PORT}`
const SECRETS = ['DATABASE_URL', 'PAYLOAD_SECRET']

// a .env with db secrets beside one allow-listed key: only the latter may load
const cwd = mkdtempSync(path.join(tmpdir(), 'mcp-smoke-'))
writeFileSync(
  path.join(cwd, '.env'),
  'DATABASE_URL=postgres://smoke@127.0.0.1:9/smoke\nPAYLOAD_SECRET=smoke\nMCP_TOKEN=smoke-token\n',
)

// preload reports which secret names survived (names only, never values)
const probe = `process.on('SIGTERM', () => {
  console.log('mcp-smoke-env ' + JSON.stringify(${JSON.stringify(SECRETS)}.filter((k) => k in process.env)))
  process.exit(0)
})`

// the token must come from the .env file, not the runner
const inherited = { ...process.env }
for (const key of ['MCP_TOKEN', 'HUB_MCP_TOKEN']) delete inherited[key]
const server = spawn(
  'node',
  [
    '--import',
    `data:text/javascript,${encodeURIComponent(probe)}`,
    path.join(root, 'mcp-content/server.mjs'),
  ],
  {
    cwd,
    env: {
      ...inherited,
      PORT: String(PORT),
      HUB_ORIGIN: 'http://127.0.0.1:9',
      // real env too: the server must drop these at startup
      DATABASE_URL: 'postgres://smoke@127.0.0.1:9/smoke',
      PAYLOAD_SECRET: 'smoke',
      // set so a regression that attaches memory over http would show up
      HINDSIGHT_API_KEY: 'smoke-not-a-key',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  },
)
let stdout = ''
server.stdout.on('data', (chunk) => {
  stdout += chunk
})

function fail(message) {
  console.error(`mcp-smoke: ${message}`)
  process.exit(1)
}

process.on('exit', () => {
  server.kill('SIGTERM')
  rmSync(cwd, { recursive: true, force: true })
})

async function waitReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`${base}/healthz`)
      if (res.ok) return res.json()
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
      authorization: 'Bearer smoke-token',
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

const health = await waitReady()
if (!health?.ok) fail('server unhealthy')

// no token, no entry
const anon = await fetch(`${base}/mcp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
})
if (anon.status !== 401) fail(`unauthenticated /mcp returned ${anon.status}, expected 401`)

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

for (const forbidden of ['recall', 'retain']) {
  if (names.includes(forbidden)) fail(`memory tool '${forbidden}' exposed over http`)
}

const exited = new Promise((resolve) => server.once('exit', resolve))
server.kill('SIGTERM')
await exited
const leaked = stdout.match(/^mcp-smoke-env (.*)$/m)
if (!leaked) fail('env probe did not report')
if (JSON.parse(leaked[1]).length) fail(`db secrets reached the process: ${leaked[1]}`)

console.log(`mcp-smoke: handshake ok, ${names.length} tools exposed (${names.join(', ')})`)
console.log('mcp-smoke: no db secrets in process.env, no memory tools over http')
process.exit(0)
