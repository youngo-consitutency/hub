#!/usr/bin/env node
// Render this project's agent MCP configuration into every supported tool.
// The canonical server map lives here, not in per-tool files — never edit
// those by hand. Secrets come from the environment or .env.local; nothing
// this script writes lands in a tracked file.
//
//   HINDSIGHT_API_KEY=hsk_… node scripts/agent/sync-mcp.mjs
//
// Get the key from a maintainer or the Hindsight/Vectorize dashboard.
// Restart agents afterwards — MCP clients read config at launch.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

// .env.local values lose to real env vars.
const envPath = join(ROOT, '.env.local')
const fromFile = existsSync(envPath)
  ? Object.fromEntries(
      readFileSync(envPath, 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    )
  : {}
const env = (k) => process.env[k] || fromFile[k]

const key = env('HINDSIGHT_API_KEY')
if (!key) {
  console.error('HINDSIGHT_API_KEY not found in environment or .env.local')
  process.exit(1)
}

// Project-scoped servers only. Shared/agnostic servers (context7, supabase,
// vercel, github) belong in each maintainer's global config — never here.
const canonical = {
  memory: {
    url: 'https://api.hindsight.vectorize.io/mcp/youngo-hub/',
    headers: { Authorization: `Bearer ${key}` },
  },
}
if (env('HUB_EMAIL') || env('HUB_TOKEN')) {
  canonical['hub-content'] = {
    command: 'node',
    args: [join(ROOT, 'scripts/agent/hub-content-mcp.mjs')],
    env: {
      HUB_ORIGIN: env('HUB_ORIGIN') || 'http://localhost:3000',
      ...(env('HUB_EMAIL') ? { HUB_EMAIL: env('HUB_EMAIL') } : {}),
      ...(env('HUB_PASSWORD') ? { HUB_PASSWORD: env('HUB_PASSWORD') } : {}),
      ...(env('HUB_TOKEN') ? { HUB_TOKEN: env('HUB_TOKEN') } : {}),
    },
  }
}

const json = (o) => JSON.stringify(o, null, 2) + '\n'
const write = (p, s) => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, s)
}

// Devin (.devin -> .agents/tool-cfg/devin) and Cursor own their whole map.
for (const p of [
  join(ROOT, '.agents/tool-cfg/devin/mcp_config.json'),
  join(ROOT, '.agents/tool-cfg/cursor/mcp.json'),
  join(ROOT, '.mcp.json'), // Claude Code project config
]) {
  write(p, json({ mcpServers: canonical }))
  console.log('wrote', p.replace(ROOT, '.'))
}

// Zed (JSONC): upsert context_servers entries inside the existing block.
{
  const p = join(ROOT, '.zed/settings.json')
  let raw = existsSync(p) ? readFileSync(p, 'utf8') : '{\n}\n'
  for (const name of Object.keys(canonical)) {
    for (let i = raw.indexOf(`"${name}"`); i !== -1; i = raw.indexOf(`"${name}"`, i)) {
      if (!new RegExp(`"${name}"\\s*:\\s*\\{`).test(raw.slice(i, i + name.length + 10))) {
        i++
        continue
      }
      let j = raw.indexOf('{', i),
        depth = 0
      for (; j < raw.length; j++) {
        if (raw[j] === '{') depth++
        else if (raw[j] === '}' && --depth === 0) break
      }
      let end = j + 1
      while (raw[end] === ',' || raw[end] === ' ' || raw[end] === '\n') end++
      raw = raw.slice(0, i) + raw.slice(end)
      i = -1
    }
  }
  const entries = Object.entries(canonical)
    .map(([name, s]) => {
      const body = s.url
        ? `"url": ${JSON.stringify(s.url)}` +
          (s.headers ? `, "headers": ${JSON.stringify(s.headers)}` : '')
        : `"command": ${JSON.stringify(s.command)}, "args": ${JSON.stringify(s.args)}` +
          (s.env ? `, "env": ${JSON.stringify(s.env)}` : '')
      return `    "${name}": { ${body} }`
    })
    .join(',\n')
  raw = /"context_servers"\s*:\s*\{/.test(raw)
    ? raw.replace(/("context_servers"\s*:\s*\{)/, `$1\n${entries},`)
    : raw.replace(/\{\s*\n?\}/, `{\n  "context_servers": {\n${entries}\n  }\n}`)
  write(p, raw)
  console.log('wrote', p.replace(ROOT, '.'))
}

// Codex TOML (.codex -> .agents/tool-cfg/codex): replaces mcp_servers tables.
{
  const p = join(ROOT, '.agents/tool-cfg/codex/config.toml')
  const existing = existsSync(p) ? readFileSync(p, 'utf8') : ''
  const toml = Object.entries(canonical)
    .map(([name, s]) => {
      if (s.url) {
        const headers = s.headers
          ? `\nhttp_headers = { ${Object.entries(s.headers)
              .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
              .join(', ')} }`
          : ''
        return `[mcp_servers.${name}]\nurl = ${JSON.stringify(s.url)}${headers}\nstartup_timeout_sec = 30\ntool_timeout_sec = 240`
      }
      const e = Object.entries(s.env ?? {})
        .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
        .join(', ')
      return `[mcp_servers.${name}]\ncommand = ${JSON.stringify(s.command)}\nargs = ${JSON.stringify(s.args)}${e ? `\nenv = { ${e} }` : ''}`
    })
    .join('\n\n')
  write(p, existing.replace(/\[mcp_servers\.[^\]]*\][^[]*/g, '').trimEnd() + '\n\n' + toml + '\n')
  console.log('wrote', p.replace(ROOT, '.'))
}

console.log('\nRestart agents to pick up changes.')
