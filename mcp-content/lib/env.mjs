// env for the content mcp: only the keys it reads ever leave .env.local/.env,
// so the web app's DATABASE_URL / PAYLOAD_SECRET never land in this process
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

const ALLOWED = [
  'HUB_ORIGIN',
  'HUB_EMAIL',
  'HUB_PASSWORD',
  'HUB_TOKEN',
  'HUB_MCP_TOKEN',
  'MCP_TOKEN',
  'MCP_ALLOWED_ORIGINS',
  'HINDSIGHT_API_KEY',
  'PORT',
]

// belt and braces: a parent shell or platform may still inject them
export function scrubEnv(env = process.env) {
  delete env.DATABASE_URL
  delete env.PAYLOAD_SECRET
}

// first file wins and real env always beats files, same as dotenv did
export function loadMcpEnv(files = ['.env.local', '.env'], env = process.env) {
  scrubEnv(env)
  for (const file of files) {
    let parsed
    try {
      parsed = parseEnv(readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    for (const key of ALLOWED) {
      if (env[key] === undefined && parsed[key] !== undefined) env[key] = parsed[key]
    }
  }
}
