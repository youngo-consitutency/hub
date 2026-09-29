#!/usr/bin/env node
/**
 * Stdio MCP for adding Hub information with a YOUNGO Hub account.
 *
 * Talks to the Hub HTTP API (default http://localhost:3000). Authorisation,
 * review queues, and the audit trail stay on the server. Never uses
 * DATABASE_URL — set HUB_EMAIL + HUB_PASSWORD, or HUB_TOKEN.
 *
 * Env:
 *   HUB_ORIGIN     default http://localhost:3000
 *   HUB_EMAIL
 *   HUB_PASSWORD
 *   HUB_TOKEN      optional session token instead of email/password
 *
 * Remote / phone clients should use the hosted HTTP server instead:
 *   node mcp-content/server.mjs
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHubMcpServer } from '../../mcp-content/lib/mcpServer.mjs'

// Fall back to .env.local/.env for HUB_* credentials when the agent config
// does not inject them. dotenv never overrides existing env vars.
try {
  const { config: loadEnv } = await import('dotenv')
  loadEnv({ path: ['.env.local', '.env'] })
} catch {
  /* running outside the repo checkout */
}

const server = createHubMcpServer()
await server.connect(new StdioServerTransport())
