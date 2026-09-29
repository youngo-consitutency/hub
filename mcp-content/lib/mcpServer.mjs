/**
 * Hub-content MCP server on the official @modelcontextprotocol/sdk high-level
 * McpServer — registerTool gives input validation from the zod shapes below
 * and generates tools/list automatically. Shared by the stdio entry point,
 * the hosted Streamable HTTP service, and the Neon Function entry.
 * Never opens a database — Hub writes go through the live member API.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  OPPORTUNITY_FORMATS,
  OPPORTUNITY_KINDS,
} from '../../spa/shared/opportunities.js'
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

// z.enum over a dynamic list — the vocabulary arrays are non-empty constants.
/** @param {readonly string[]} values */
const enumOf = (values) => z.enum(/** @type {[string, ...string[]]} */ (values))

const kindEnum = enumOf(OPPORTUNITY_KINDS.map((item) => item.value))
const formatEnum = enumOf(OPPORTUNITY_FORMATS.map((item) => item.value))
const contentType = z.enum(['event', 'announcement'])

/**
 * Zod shapes per tool — validated by registerTool before dispatch.
 * Keys mirror the JSON schemas in HUB_CONTENT_TOOLS.
 */
const INPUT_SHAPES = {
  whoami: {},
  catalog_options: {},
  list_opportunities: {
    kind: kindEnum.optional(),
    format: formatEnum.optional(),
  },
  list_org_opportunities: { orgId: z.string().optional() },
  create_opportunity: {
    kind: kindEnum,
    title: z.string().min(6).max(200),
    summary: z.string().max(300).optional(),
    body: z.string().max(4000).optional(),
    format: formatEnum.optional(),
    location: z.string().max(200).optional(),
    region: z.string().max(60).optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    deadlineAt: z.string().optional(),
    linkUrl: z.string().optional(),
    orgId: z.string().optional(),
  },
  withdraw_opportunity: { id: z.string(), orgId: z.string().optional() },
  list_opportunity_review: {},
  review_opportunity: {
    id: z.string(),
    decision: z.enum(['approve', 'reject']),
    note: z.string().optional(),
  },
  submit_resource: {
    title: z.string().min(3).max(160),
    url: z.string(),
    summary: z.string().min(20).max(600),
    publisher: z.string().max(120).optional(),
    pathway: z.string(),
    type: z.string(),
    topic: z.string(),
    region: z.string().optional(),
    language: z.string().optional(),
  },
  list_my_resource_submissions: {},
  list_content: {},
  get_content: { contentType, slug: z.string() },
  update_content: {
    contentType,
    slug: z.string(),
    payload: z.record(z.string(), z.unknown()),
    mode: z.enum(['draft', 'apply']).optional(),
  },
  unpublish_content: {
    contentType,
    slug: z.string(),
    reason: z.string().optional(),
  },
  create_content_draft: {
    contentType: z.enum(['event', 'announcement', 'resource']),
    payload: z.record(z.string(), z.unknown()),
  },
  submit_content_draft: { id: z.string() },
  review_content_draft: {
    id: z.string(),
    decision: z.enum(['approve', 'changes_requested']),
    note: z.string().optional(),
  },
  publish_content_draft: { id: z.string() },
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

  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } })

  for (const tool of HUB_CONTENT_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: INPUT_SHAPES[tool.name] || {},
      },
      async (args) => {
        try {
          const data = await callHubContentTool(
            tool.name,
            args || {},
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
      },
    )
  }

  return server
}
