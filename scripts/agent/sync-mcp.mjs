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
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { applyEdits, modify, parse } from 'jsonc-parser'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

// .env.local values lose to real env vars.
const envPath = join(ROOT, '.env.local')
const fromFile = existsSync(envPath) ? dotenv.parse(readFileSync(envPath)) : {}
const env = (k) => process.env[k] || fromFile[k]

// The `hub` server is a node script in this repo — without dependencies
// installed it fails at startup with an opaque module error in agent UIs.
if (!existsSync(join(ROOT, 'node_modules/@modelcontextprotocol/sdk'))) {
  console.warn(
    'warn: dependencies not installed — the hub server will not start until `npm ci` runs',
  )
}

const key = env('HINDSIGHT_API_KEY')
const hasHubCreds = env('HUB_TOKEN') || (env('HUB_EMAIL') && env('HUB_PASSWORD'))
if (!key && !hasHubCreds) {
  console.error('Neither HINDSIGHT_API_KEY nor Hub credentials found in environment or .env.local')
  process.exit(1)
}

// One unified `hub` server per tool: content tools + memory tools behind a
// single stdio entry (memory attaches when HINDSIGHT_API_KEY is present).
// Project-scoped only — shared/agnostic servers (context7, supabase, vercel,
// github) belong in each maintainer's global config, never here.
const canonical = {
  hub: {
    command: 'node',
    args: [join(ROOT, 'scripts/agent/hub-mcp.mjs')],
    env: {
      HUB_ORIGIN: env('HUB_ORIGIN') || 'http://localhost:3000',
      ...(key ? { HINDSIGHT_API_KEY: key } : {}),
      ...(env('HUB_EMAIL') ? { HUB_EMAIL: env('HUB_EMAIL') } : {}),
      ...(env('HUB_PASSWORD') ? { HUB_PASSWORD: env('HUB_PASSWORD') } : {}),
      ...(env('HUB_TOKEN') ? { HUB_TOKEN: env('HUB_TOKEN') } : {}),
    },
  },
}
// Names this script owns — removed before rewriting even when absent from
// the map above (a credential-less sync must still clear stale tables,
// including the pre-unification `memory`/`hub-content` entries).
const MANAGED = [...new Set([...Object.keys(canonical), 'hub', 'memory', 'hub-content'])]

const json = (o) => JSON.stringify(o, null, 2) + '\n'
// writeFileSync truncates before writing — a crash mid-write would leave a
// truncated settings file. Write a sibling temp file and rename over the
// target so the swap is atomic.
const write = (p, s) => {
  mkdirSync(dirname(p), { recursive: true })
  const tmp = join(dirname(p), `.${basename(p)}.${process.pid}.tmp`)
  writeFileSync(tmp, s, { mode: 0o600 })
  renameSync(tmp, p)
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

// Zed (JSONC): merge into context_servers through a real JSONC edit, so
// comments, strings and same-named keys elsewhere are never touched.
{
  const p = join(ROOT, '.zed/settings.json')
  const raw = existsSync(p) ? readFileSync(p, 'utf8') : '{}\n'
  const settings = parse(raw, [], { allowTrailingComma: true }) ?? {}
  const servers = Object.fromEntries(
    Object.entries(settings.context_servers ?? {}).filter(([name]) => !MANAGED.includes(name)),
  )
  Object.assign(servers, canonical)
  const edits = modify(raw, ['context_servers'], servers, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  })
  write(p, applyEdits(raw, edits))
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
