#!/usr/bin/env node
// Render this project's agent MCP configuration into every supported tool.
// The canonical server map lives here, not in per-tool files — never edit
// those by hand. Secrets come from the environment or .env.local; nothing
// this script writes lands in a tracked file (all outputs are gitignored —
// keep them that way).
//
//   HINDSIGHT_API_KEY=hsk_… npm run sync:mcp
//
// Get the key from a maintainer or the Hindsight/Vectorize dashboard.
// Restart agents afterwards — MCP clients read config at launch.
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

// .env.local values lose to real env vars.
const envPath = join(ROOT, '.env.local')
const fromFile = existsSync(envPath) ? dotenv.parse(readFileSync(envPath)) : {}
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
if (env('HUB_TOKEN') || (env('HUB_EMAIL') && env('HUB_PASSWORD'))) {
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
// Names this script owns — removed before rewriting even when absent from
// the map above (a credential-less sync must still clear stale tables).
const MANAGED = [...new Set([...Object.keys(canonical), 'memory', 'hub-content'])]

const json = (o) => JSON.stringify(o, null, 2) + '\n'
const write = (p, s) => {
  mkdirSync(dirname(p), { recursive: true })
  if (existsSync(p)) chmodSync(p, 0o600)
  writeFileSync(p, s, { mode: 0o600 })
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

// Index of the closing `}` of the object literal that opens at openIdx,
// skipping strings and comments so braces inside them cannot miscount.
const objEnd = (s, openIdx) => {
  let depth = 0
  for (let j = openIdx; j < s.length; j++) {
    const c = s[j]
    if (c === '"') {
      for (j++; j < s.length && s[j] !== '"'; j++) if (s[j] === '\\') j++
    } else if (c === '/' && s[j + 1] === '/') {
      while (j < s.length && s[j] !== '\n') j++
    } else if (c === '/' && s[j + 1] === '*') {
      while (j < s.length && !(s[j] === '*' && s[j + 1] === '/')) j++
      j++
    } else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return j
  }
  return -1
}

// Zed (JSONC): upsert entries inside context_servers only, so a same-named
// key elsewhere in settings is never touched.
{
  const p = join(ROOT, '.zed/settings.json')
  let raw = existsSync(p) ? readFileSync(p, 'utf8') : '{\n}\n'
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
  const keyIdx = raw.search(/"context_servers"\s*:/)
  if (keyIdx !== -1) {
    const openIdx = raw.indexOf('{', keyIdx)
    const closeIdx = objEnd(raw, openIdx)
    let block = raw.slice(openIdx, closeIdx + 1)
    for (const name of MANAGED) {
      for (let i = block.indexOf(`"${name}"`); i !== -1; i = block.indexOf(`"${name}"`, i)) {
        if (!new RegExp(`"${name}"\\s*:\\s*\\{`).test(block.slice(i, i + name.length + 10))) {
          i++
          continue
        }
        const end = objEnd(block, block.indexOf('{', i)) + 1
        let e = end
        while (block[e] === ',' || block[e] === ' ' || block[e] === '\n') e++
        block = block.slice(0, i) + block.slice(e)
        i = -1
      }
    }
    raw =
      raw.slice(0, openIdx + 1) + '\n' + entries + ',' + block.slice(1) + raw.slice(closeIdx + 1)
  } else {
    const last = raw.lastIndexOf('}')
    raw = raw.slice(0, last) + `,\n  "context_servers": {\n${entries}\n  }\n` + raw.slice(last + 1)
  }
  write(p, raw)
  console.log('wrote', p.replace(ROOT, '.'))
}

// Codex TOML (.codex -> .agents/tool-cfg/codex): drop managed tables
// section-wise so `[` inside array values cannot truncate a section.
{
  const p = join(ROOT, '.agents/tool-cfg/codex/config.toml')
  const existing = existsSync(p) ? readFileSync(p, 'utf8') : ''
  const kept = existing
    .split(/^(?=\[)/m)
    .filter(
      (s) => !MANAGED.some((n) => new RegExp(`^\\[mcp_servers\\.${n}[.\\]]`).test(s.trimStart())),
    )
    .join('')
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
  write(p, kept.trimEnd() + '\n\n' + toml + '\n')
  console.log('wrote', p.replace(ROOT, '.'))
}

console.log('\nRestart agents to pick up changes.')
