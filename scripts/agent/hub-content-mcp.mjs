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
 * Remote / phone clients should use the Railway HTTP server instead:
 *   node mcp-content/server.mjs
 */
import { createInterface } from 'node:readline'
import { createToolRunner } from '../../mcp-content/lib/protocol.mjs'

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

const runner = createToolRunner()

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
  runner
    .dispatch(message)
    .then((out) => {
      if (out) send(out)
    })
    .catch((error) => {
      if (message?.id != null) {
        send({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [{ type: 'text', text: String(error.message || error) }],
            isError: true,
          },
        })
      }
    })
})
