#!/usr/bin/env node
/**
 * The unified Hub MCP for local agents — Hub content tools plus the shared
 * session-memory bank behind a single stdio server.
 *
 * Talks to the Hub HTTP API (default http://localhost:3000). Authorisation,
 * review queues, and the audit trail stay on the server. Never uses
 * DATABASE_URL — set HUB_EMAIL + HUB_PASSWORD, or HUB_TOKEN.
 *
 * Env:
 *   HUB_ORIGIN        default http://localhost:3000
 *   HUB_EMAIL
 *   HUB_PASSWORD
 *   HUB_TOKEN         optional session token instead of email/password
 *   HINDSIGHT_API_KEY adds the shared session-memory tools (recall/retain…)
 *
 * Remote / phone clients should use the hosted HTTP server instead:
 *   node mcp-content/server.mjs   (content tools only — memory stays local)
 */
// Deps first: a bare `npm ci`-less checkout makes static imports throw a
// raw ERR_MODULE_NOT_FOUND that agent UIs surface as an opaque crash.
// Import dynamically so the failure is a readable message instead.
let StdioServerTransport, createHubMcpServer, attachMemoryTools
try {
  ;({ StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js'))
  ;({ createHubMcpServer } = await import('../../mcp-content/lib/mcpServer.mjs'))
  ;({ attachMemoryTools } = await import('../../mcp-content/lib/memory.mjs'))
} catch {
  console.error('[hub-mcp] dependencies not installed — run `npm ci` in the repo root')
  process.exit(1)
}

// Fall back to .env.local/.env for HUB_* credentials when the agent config
// does not inject them. dotenv never overrides existing env vars.
try {
  const { config: loadEnv } = await import('dotenv')
  loadEnv({ path: ['.env.local', '.env'] })
} catch {
  /* running outside the repo checkout */
}

const server = createHubMcpServer()
const hasContent = process.env.HUB_TOKEN || (process.env.HUB_EMAIL && process.env.HUB_PASSWORD)
console.error(
  `[hub-mcp] content credentials: ${
    hasContent ? 'ok' : 'missing — set HUB_TOKEN or HUB_EMAIL+HUB_PASSWORD in .env.local'
  }`,
)
try {
  const count = await attachMemoryTools(server)
  console.error(`[hub-mcp] ${count} memory tools attached`)
} catch (error) {
  // Memory is additive — the content surface still serves without it.
  console.error(`[hub-mcp] memory tools unavailable: ${error?.message || error}`)
}
await server.connect(new StdioServerTransport())
