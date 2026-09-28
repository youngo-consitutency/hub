/**
 * Hub-content MCP server on the official @modelcontextprotocol/sdk.
 * Shared by the stdio entry point and the hosted Streamable HTTP service.
 * Never opens a database — Hub writes go through the live member API.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  HUB_CONTENT_TOOLS,
  callHubContentTool,
  createHubClient,
  resolveHubOrigin,
} from './client.mjs'

export const SERVER_INFO = {
  name: 'youngo-hub-content',
  version: '1.3.0',
}

export function toolErrorText(error) {
  if (error && (error.code || error.fields || error.status)) {
    return JSON.stringify(
      {
        error: {
          code: error.code || 'request_failed',
          message: error.message || String(error),
          ...(error.status ? { status: error.status } : {}),
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
      null,
      2,
    )
  }
  return String(error?.message || error)
}

export function createHubMcpServer(env = process.env) {
  let client
  const getClient = () => {
    client ||= createHubClient({
      origin: resolveHubOrigin(env),
      email: env.HUB_EMAIL,
      password: env.HUB_PASSWORD,
      token: env.HUB_TOKEN,
    })
    return client
  }

  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: HUB_CONTENT_TOOLS,
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const data = await callHubContentTool(
        request.params.name,
        request.params.arguments || {},
        getClient(),
      )
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: toolErrorText(error) }],
        isError: true,
      }
    }
  })

  return server
}
