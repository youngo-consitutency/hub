/**
 * Hub-content MCP server on the official @modelcontextprotocol/sdk high-level
 * McpServer — registerTool gives input validation from the zod shapes below
 * and generates tools/list automatically. Shared by the stdio entry point,
 * the hosted Streamable HTTP service, and the Neon Function entry.
 * Never opens a database — Hub writes go through the live member API.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { OPPORTUNITY_FORMATS, OPPORTUNITY_KINDS } from '../../src/shared/opportunities.js'
import { callHubContentTool, createHubClient, resolveHubOrigin } from './client.mjs'

export const SERVER_INFO = {
  name: 'youngo-hub',
  version: '1.4.0',
}

// z.enum over a dynamic list — the vocabulary arrays are non-empty constants.
/** @param {readonly string[]} values */
const enumOf = (values) => z.enum(/** @type {[string, ...string[]]} */ (values))

const kindEnum = enumOf(OPPORTUNITY_KINDS.map((item) => item.value))
const formatEnum = enumOf(OPPORTUNITY_FORMATS.map((item) => item.value))
const contentType = z.enum(['event', 'announcement'])
const feedbackStatus = z.enum(['new', 'triaged', 'in_progress', 'resolved', 'declined'])

const isoDate = () => z.string().describe('ISO date-time').optional()
const catalogPick = (list) => z.string().describe(`One of catalog_options.${list}`)

// one source of truth: registerTool validates with these and derives the
// json schema for tools/list from them
const TOOLS = {
  whoami: {
    description:
      'Return the signed-in Hub account, entity type, verification, organisation access, and capabilities. Call this first to see whether this account can post opportunities (org seat), submit resources (verified member), or draft/publish events and announcements (content team).',
    input: {},
  },
  catalog_options: {
    description:
      'Closed lists the Hub accepts for postings and resources: opportunity kinds/formats, event types, and resource pathway/type/topic/region/language.',
    input: {},
  },
  list_opportunities: {
    description:
      'List published opportunities on the member board. Requires a verified Hub account.',
    input: { kind: kindEnum.optional(), format: formatEnum.optional() },
  },
  list_org_opportunities: {
    description:
      'List this organisation’s own postings, including those still in review. Requires an organisation seat that can manage requests.',
    input: {
      orgId: z
        .string()
        .describe('Organisation account id when the caller has several seats.')
        .optional(),
    },
  },
  create_opportunity: {
    description:
      'Add an opportunity, training, workshop, call, hackathon, or event posting. Uses the signed-in organisation account. The first posting from an organisation is held for Membership Team review; later postings may go live immediately. Does not replace YOUNGO’s own calls — it publishes information members can find.',
    input: {
      kind: kindEnum,
      title: z.string().min(6).max(200),
      summary: z.string().max(300).optional(),
      body: z.string().max(4000).optional(),
      format: formatEnum.optional(),
      location: z.string().max(200).optional(),
      region: z.string().max(60).optional(),
      startsAt: isoDate(),
      endsAt: isoDate(),
      deadlineAt: isoDate(),
      linkUrl: z.string().describe('Absolute http(s) URL').optional(),
      orgId: z.string().optional(),
    },
  },
  withdraw_opportunity: {
    description:
      'Withdraw one of this organisation’s live postings. Requires an organisation seat that can manage requests.',
    input: { id: z.string(), orgId: z.string().optional() },
  },
  list_opportunity_review: {
    description:
      'Staff review queue: pending postings, published postings, and posting organisations. Admins and Membership Team only.',
    input: {},
  },
  review_opportunity: {
    description:
      'Approve or reject a posting in the review queue. Admins and Membership Team only.',
    input: {
      id: z.string(),
      decision: z.enum(['approve', 'reject']),
      note: z.string().optional(),
    },
  },
  list_feedback_tickets: {
    description:
      'Feedback tickets members filed from the Hub, newest first. Platform operators and the Membership Team only.',
    input: {
      status: feedbackStatus.optional(),
      kind: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
  },
  triage_feedback_ticket: {
    description:
      'Set a feedback ticket status and/or triage note. Platform operators and the Membership Team only. Audited.',
    input: {
      id: z.string(),
      status: feedbackStatus.optional(),
      triageNote: z.string().max(2000).optional(),
    },
  },
  submit_resource: {
    description:
      'Suggest a science/resource Hub item for review. Any verified member may submit. It is not published until content review.',
    input: {
      title: z.string().min(3).max(160),
      url: z.string(),
      summary: z.string().min(20).max(600),
      publisher: z.string().max(120).optional(),
      pathway: catalogPick('resourcePathways'),
      type: catalogPick('resourceTypes'),
      topic: catalogPick('resourceTopics'),
      region: catalogPick('resourceRegions').optional(),
      language: catalogPick('resourceLanguages').optional(),
    },
  },
  list_my_resource_submissions: {
    description: 'List resource submissions created by this Hub account.',
    input: {},
  },
  list_content: {
    description:
      'List content-studio drafts, reviews, and live events/announcements. Requires content.draft or content.review.',
    input: {},
  },
  get_content: {
    description:
      'Load one live event or announcement by slug. Requires content.draft or content.review. Returns 404 when the slug is not live.',
    input: { contentType, slug: z.string() },
  },
  update_content: {
    description:
      'Patch a live event or announcement by slug. Only sent fields change. mode=draft (default) creates a draft that reuses submit/review/publish. mode=apply writes through now and requires content.review plus content.publish. Same slug replaces the live item; it never duplicates.',
    input: {
      contentType,
      slug: z.string(),
      payload: z.record(z.string(), z.unknown()),
      mode: z.enum(['draft', 'apply']).default('draft'),
    },
  },
  unpublish_content: {
    description:
      'Remove a live event or announcement from the calendar/board while keeping history. Requires content.publish. Does not delete without an audit record.',
    input: { contentType, slug: z.string(), reason: z.string().optional() },
  },
  create_content_draft: {
    description:
      'Create an event or announcement draft (or a resource draft). Requires content.draft. Not live until someone with content.review and content.publish moves it through review. A slug is generated from the title when omitted.',
    input: {
      contentType: z.enum(['event', 'announcement', 'resource']),
      payload: z.record(z.string(), z.unknown()),
    },
  },
  submit_content_draft: {
    description: 'Send a draft for review. Requires content.draft.',
    input: { id: z.string() },
  },
  review_content_draft: {
    description: 'Approve or request changes on a draft. Requires content.review.',
    input: {
      id: z.string(),
      decision: z.enum(['approve', 'changes_requested']),
      note: z.string().optional(),
    },
  },
  publish_content_draft: {
    description:
      'Publish an approved event, announcement, or resource so members can find it. Requires content.publish. Does not skip review.',
    input: { id: z.string() },
  },
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

/** @param {Partial<NodeJS.ProcessEnv>} [env] */
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

  for (const [name, { description, input }] of Object.entries(TOOLS)) {
    server.registerTool(name, { description, inputSchema: input }, async (args) => {
      try {
        const data = await callHubContentTool(name, args || {}, getClient())
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
  }

  return server
}
