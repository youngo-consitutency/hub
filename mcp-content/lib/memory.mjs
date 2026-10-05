/**
 * Attach the project's shared session-memory tools to an MCP server.
 *
 * The Hindsight bank is itself a remote MCP — this proxies its tools
 * through the local server so agents configure a single `hub` server.
 * Local/stdio entry points only: the hosted HTTP service must not expose
 * session memory, or other consumers' recall and retain would land in
 * this project's bank.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { z } from 'zod'

const MEMORY_URL = 'https://api.hindsight.vectorize.io/mcp/youngo-hub/'

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {Partial<NodeJS.ProcessEnv>} [env]
 * @returns {Promise<number>} tools attached — 0 when HINDSIGHT_API_KEY is unset
 */
export async function attachMemoryTools(server, env = process.env) {
  if (!env.HINDSIGHT_API_KEY) return 0
  const client = new Client({ name: 'hub-memory-proxy', version: '1.0.0' })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(MEMORY_URL), {
      requestInit: { headers: { Authorization: `Bearer ${env.HINDSIGHT_API_KEY}` } },
    }),
  )
  const { tools } = await client.listTools()
  for (const tool of tools) {
    let inputSchema
    try {
      inputSchema = z.fromJSONSchema(tool.inputSchema)
    } catch {
      inputSchema = z.looseObject({})
    }
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema,
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      },
      (args) => client.callTool({ name: tool.name, arguments: args }),
    )
  }
  return tools.length
}
