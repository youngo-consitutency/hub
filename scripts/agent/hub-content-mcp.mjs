#!/usr/bin/env node
/**
 * MCP for adding Hub information with a YOUNGO Hub account.
 *
 * Talks to the live HTTP API (default https://youngohub.org). Authorization,
 * review queues, and the audit trail stay on the server. Never uses
 * DATABASE_URL — set HUB_EMAIL + HUB_PASSWORD, or HUB_TOKEN.
 *
 * Env:
 *   HUB_ORIGIN     default https://youngohub.org
 *   HUB_EMAIL
 *   HUB_PASSWORD
 *   HUB_TOKEN      optional session token instead of email/password
 */
import { createInterface } from 'node:readline'
import {
  HUB_CONTENT_TOOLS,
  callHubContentTool,
  createHubClient,
  resolveHubOrigin,
} from './hubContentClient.mjs'

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function okResult(id, data) {
  send({
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    },
  })
}

function errResult(id, error) {
  send({
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text: String(error.message || error) }],
      isError: true,
    },
  })
}

let client

function getClient() {
  client ||= createHubClient({
    origin: resolveHubOrigin(),
    email: process.env.HUB_EMAIL,
    password: process.env.HUB_PASSWORD,
    token: process.env.HUB_TOKEN,
  })
  return client
}

async function handle(message) {
  const { id, method, params } = message
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'youngo-hub-content', version: '1.0.0' },
        capabilities: { tools: {} },
      },
    })
    return
  }
  if (method === 'notifications/initialized' || method === 'initialized') {
    return
  }
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: HUB_CONTENT_TOOLS } })
    return
  }
  if (method === 'tools/call') {
    try {
      const data = await callHubContentTool(
        params?.name,
        params?.arguments || {},
        getClient(),
      )
      okResult(id, data)
    } catch (error) {
      errResult(id, error)
    }
    return
  }
  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} })
    return
  }
  if (id != null) {
    send({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    })
  }
}

const rl = createInterface({ input: process.stdin, terminal: false })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let message
  try {
    message = JSON.parse(trimmed)
  } catch {
    return
  }
  handle(message).catch((error) => {
    if (message?.id != null) errResult(message.id, error)
  })
})
