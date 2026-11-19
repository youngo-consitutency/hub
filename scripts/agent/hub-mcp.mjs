#!/usr/bin/env node
/**
 * Unified Hub MCP for local agents: content tools plus session memory over one stdio server.
 * Set HUB_EMAIL + HUB_PASSWORD or HUB_TOKEN (HUB_ORIGIN, HINDSIGHT_API_KEY optional); never uses DATABASE_URL.
 */
// Import dynamically so missing deps give a readable message, not ERR_MODULE_NOT_FOUND.
let StdioServerTransport, createHubMcpServer, attachMemoryTools, loadMcpEnv
try {
  ;({ StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js'))
  ;({ createHubMcpServer } = await import('../../mcp-content/lib/mcpServer.mjs'))
  ;({ attachMemoryTools } = await import('../../mcp-content/lib/memory.mjs'))
  ;({ loadMcpEnv } = await import('../../mcp-content/lib/env.mjs'))
} catch (error) {
  // Only blame missing deps for module-resolution failures — a syntax error
  // or other startup fault must surface its real message.
  const missing = ['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error?.code)
  console.error(
    missing
      ? '[hub-mcp] dependencies not installed — run `npm ci` in the repo root'
      : `[hub-mcp] startup failed: ${error?.message || error}`,
  )
  process.exit(1)
}

// fall back to .env.local/.env for HUB_*/HINDSIGHT_* when the agent config
// doesn't inject them — allow-listed, so DATABASE_URL never comes along
loadMcpEnv()

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
