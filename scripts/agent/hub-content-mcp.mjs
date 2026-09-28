#!/usr/bin/env node
/**
 * Stdio MCP for adding Hub information with a YOUNGO Hub account.
 *
 * Talks to the live HTTP API (default https://youngohub.org). Authorisation,
 * review queues, and the audit trail stay on the server. Never uses
 * DATABASE_URL — set HUB_EMAIL + HUB_PASSWORD, or HUB_TOKEN.
 *
 * Env:
 *   HUB_ORIGIN     default https://youngohub.org
 *   HUB_EMAIL
 *   HUB_PASSWORD
 *   HUB_TOKEN      optional session token instead of email/password
 *
 * Remote / phone clients should use the hosted HTTP server instead:
 *   node mcp-content/server.mjs
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHubMcpServer } from '../../mcp-content/lib/mcpServer.mjs'

const server = createHubMcpServer()
await server.connect(new StdioServerTransport())
