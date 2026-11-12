/**
 * Neon Function entry for the Hub content MCP.
 *
 * Neon Functions expose a web-standard `fetch` handler, so this exports the
 * same Hono app mcp-content/server.mjs serves over node:http. Same contract:
 * stateless POSTs to /mcp, bearer/?token=//t/<token>/mcp transport auth, Hub
 * account credentials stay server-side. Never uses DATABASE_URL.
 *
 * Env:
 *   MCP_TOKEN            shared secret (or MCP_ALLOW_ANONYMOUS=1)
 *   HUB_ORIGIN           Hub base URL, e.g. https://youngohub.org
 *   HUB_EMAIL / HUB_PASSWORD  or HUB_TOKEN
 */
import { scrubEnv } from '../lib/env.mjs'
import { createMcpApp } from '../server.mjs'

scrubEnv()

export default createMcpApp()
