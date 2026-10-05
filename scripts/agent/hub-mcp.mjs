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
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHubMcpServer } from '../../mcp-content/lib/mcpServer.mjs'
import { attachMemoryTools } from '../../mcp-content/lib/memory.mjs'

// Fall back to .env.local/.env for HUB_* credentials when the agent config
// does not inject them. dotenv never overrides existing env vars.
try {
  const { config: loadEnv } = await import('dotenv')
  loadEnv({ path: ['.env.local', '.env'] })
} catch {
  /* running outside the repo checkout */
}

const server = createHubMcpServer()
try {
  const count = await attachMemoryTools(server)
  console.error(`[hub-mcp] ${count} memory tools attached`)
} catch (error) {
  // Memory is additive — the content surface still serves without it.
  console.error(`[hub-mcp] memory tools unavailable: ${error?.message || error}`)
}
await server.connect(new StdioServerTransport())
