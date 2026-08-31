/**
 * JSON-RPC MCP methods for Hub content. Shared by stdio and HTTP transports.
 * Never opens a database — Hub writes go through the live member API.
 */
import {
  HUB_CONTENT_TOOLS,
  callHubContentTool,
  createHubClient,
  resolveHubOrigin,
} from './client.mjs'

export const SERVER_INFO = {
  name: 'youngo-hub-content',
  version: '1.2.0',
}

export const PROTOCOL_VERSIONS = new Set(['2024-11-05', '2025-03-26'])

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

export function createToolRunner(env = process.env) {
  let client

  function getClient() {
    client ||= createHubClient({
      origin: resolveHubOrigin(env),
      email: env.HUB_EMAIL,
      password: env.HUB_PASSWORD,
      token: env.HUB_TOKEN,
    })
    return client
  }

  return {
    async dispatch(message) {
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        return {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid Request' },
        }
      }

      const { id, method, params } = message

      if (method === 'initialize') {
        const requested = String(params?.protocolVersion || '')
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: PROTOCOL_VERSIONS.has(requested)
              ? requested
              : '2024-11-05',
            serverInfo: SERVER_INFO,
            capabilities: { tools: {} },
          },
        }
      }

      if (method === 'notifications/initialized' || method === 'initialized') {
        return null
      }

      if (method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: HUB_CONTENT_TOOLS },
        }
      }

      if (method === 'tools/call') {
        try {
          const data = await callHubContentTool(
            params?.name,
            params?.arguments || {},
            getClient(),
          )
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            },
          }
        } catch (error) {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: toolErrorText(error) }],
              isError: true,
            },
          }
        }
      }

      if (method === 'ping') {
        return { jsonrpc: '2.0', id, result: {} }
      }

      if (id != null) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        }
      }

      return null
    },
  }
}
