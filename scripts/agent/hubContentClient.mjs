/**
 * HTTP client for the Hub content MCP. Signs in with a YOUNGO Hub account and
 * calls the same member APIs the website uses, so authorization and audit stay
 * on the server. Never opens a database.
 */
import { EVENT_TYPES } from '../../shared/contentValidation.js'
import {
  RESOURCE_LANGUAGES,
  RESOURCE_PATHWAYS,
  RESOURCE_REGIONS,
  RESOURCE_TOPICS,
  RESOURCE_TYPES,
} from '../../shared/resourceHub.js'
import {
  OPPORTUNITY_FORMATS,
  OPPORTUNITY_KINDS,
} from '../../server/lib/opportunities.js'

export const HUB_CONTENT_TOOLS = [
  {
    name: 'whoami',
    description:
      'Return the signed-in Hub account, entity type, verification, organisation access, and capabilities. Call this first to see whether this account can post opportunities (org seat), submit resources (verified member), or draft/publish events and announcements (content team).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'catalog_options',
    description:
      'Closed lists the Hub accepts for postings and resources: opportunity kinds/formats, event types, and resource pathway/type/topic/region/language.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_opportunities',
    description:
      'List published opportunities on the member board. Requires a verified Hub account.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: OPPORTUNITY_KINDS.map((item) => item.value),
        },
        format: {
          type: 'string',
          enum: OPPORTUNITY_FORMATS.map((item) => item.value),
        },
      },
    },
  },
  {
    name: 'list_org_opportunities',
    description:
      'List this organisation’s own postings, including those still in review. Requires an organisation seat that can manage requests.',
    inputSchema: {
      type: 'object',
      properties: {
        orgId: {
          type: 'string',
          description:
            'Organisation account id when the caller has several seats.',
        },
      },
    },
  },
  {
    name: 'create_opportunity',
    description:
      'Add an opportunity, training, workshop, call, hackathon, or event posting. Uses the signed-in organisation account. The first posting from an organisation is held for Membership Team review; later postings may go live immediately. Does not replace YOUNGO’s own calls — it publishes information members can find.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: OPPORTUNITY_KINDS.map((item) => item.value),
        },
        title: { type: 'string', minLength: 6, maxLength: 200 },
        summary: { type: 'string', maxLength: 300 },
        body: { type: 'string', maxLength: 4000 },
        format: {
          type: 'string',
          enum: OPPORTUNITY_FORMATS.map((item) => item.value),
        },
        location: { type: 'string', maxLength: 200 },
        region: { type: 'string', maxLength: 60 },
        startsAt: { type: 'string', description: 'ISO date-time' },
        endsAt: { type: 'string', description: 'ISO date-time' },
        deadlineAt: { type: 'string', description: 'ISO date-time' },
        linkUrl: { type: 'string', description: 'Absolute http(s) URL' },
        orgId: { type: 'string' },
      },
      required: ['kind', 'title'],
    },
  },
  {
    name: 'withdraw_opportunity',
    description:
      'Withdraw one of this organisation’s live postings. Requires an organisation seat that can manage requests.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        orgId: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_opportunity_review',
    description:
      'Staff review queue: pending postings, published postings, and posting organisations. Admins and Membership Team only.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'review_opportunity',
    description:
      'Approve or reject a posting in the review queue. Admins and Membership Team only.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        decision: { type: 'string', enum: ['approve', 'reject'] },
        note: { type: 'string' },
      },
      required: ['id', 'decision'],
    },
  },
  {
    name: 'submit_resource',
    description:
      'Suggest a science/resource Hub item for review. Any verified member may submit. It is not published until content review.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 3, maxLength: 160 },
        url: { type: 'string' },
        summary: { type: 'string', minLength: 20, maxLength: 600 },
        publisher: { type: 'string', maxLength: 120 },
        pathway: {
          type: 'string',
          enum: RESOURCE_PATHWAYS.map((item) => item.value),
        },
        type: {
          type: 'string',
          enum: RESOURCE_TYPES.map((item) => item.value),
        },
        topic: { type: 'string', enum: [...RESOURCE_TOPICS] },
        region: {
          type: 'string',
          enum: RESOURCE_REGIONS.map((item) => item.value),
        },
        language: { type: 'string', enum: [...RESOURCE_LANGUAGES] },
      },
      required: ['title', 'url', 'summary', 'pathway', 'type', 'topic'],
    },
  },
  {
    name: 'list_my_resource_submissions',
    description: 'List resource submissions created by this Hub account.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_content',
    description:
      'List content-studio drafts, reviews, and live events/announcements. Requires content.draft or content.review.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_content_draft',
    description:
      'Create an event or announcement draft (or a resource draft). Requires content.draft. Not live until someone with content.review and content.publish moves it through review. A slug is generated from the title when omitted.',
    inputSchema: {
      type: 'object',
      properties: {
        contentType: {
          type: 'string',
          enum: ['event', 'announcement', 'resource'],
        },
        payload: { type: 'object', additionalProperties: true },
      },
      required: ['contentType', 'payload'],
    },
  },
  {
    name: 'submit_content_draft',
    description: 'Send a draft for review. Requires content.draft.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'review_content_draft',
    description:
      'Approve or request changes on a draft. Requires content.review.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        decision: { type: 'string', enum: ['approve', 'changes_requested'] },
        note: { type: 'string' },
      },
      required: ['id', 'decision'],
    },
  },
  {
    name: 'publish_content_draft',
    description:
      'Publish an approved event, announcement, or resource so members can find it. Requires content.publish. Does not skip review.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
]

export function catalogOptions() {
  return {
    opportunityKinds: OPPORTUNITY_KINDS,
    opportunityFormats: OPPORTUNITY_FORMATS,
    eventTypes: EVENT_TYPES,
    announcementHint: {
      fields: [
        'slug',
        'title',
        'body',
        'pinned',
        'ctaUrl',
        'ctaLabel',
        'ctaDeadlineAt',
      ],
    },
    eventHint: {
      fields: [
        'slug',
        'title',
        'type',
        'startsAt',
        'endsAt',
        'description',
        'wg',
        'meetingUrl',
        'recordingUrl',
      ],
    },
    resourcePathways: RESOURCE_PATHWAYS,
    resourceTypes: RESOURCE_TYPES,
    resourceTopics: RESOURCE_TOPICS,
    resourceRegions: RESOURCE_REGIONS,
    resourceLanguages: RESOURCE_LANGUAGES,
  }
}

export function slugify(title) {
  const base = String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
  return base || 'item'
}

export function resolveHubOrigin(env = process.env) {
  const raw = String(env.HUB_ORIGIN || 'https://youngohub.org').trim()
  const origin = raw.replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(origin)) {
    throw new Error('HUB_ORIGIN must be an http(s) URL.')
  }
  return origin
}

function apiError(status, body) {
  const message =
    body?.error?.message ||
    body?.message ||
    `Hub API request failed (${status})`
  const error = new Error(message)
  error.status = status
  error.code = body?.error?.code
  error.fields = body?.error?.fields
  error.body = body
  return error
}

export function createHubClient({
  origin,
  email,
  password,
  token,
  fetchImpl = fetch,
} = {}) {
  const hubOrigin = String(origin || '').replace(/\/+$/, '')
  if (!hubOrigin) throw new Error('Hub origin is required.')
  let sessionToken = token || null
  let account = null

  async function request(path, { method = 'GET', body, query } = {}) {
    const url = new URL(path, `${hubOrigin}/`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value != null && value !== '') url.searchParams.set(key, value)
      }
    }
    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`
    const response = await fetchImpl(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw apiError(response.status, data)
    return data
  }

  async function ensureSession() {
    if (sessionToken && account) return account
    if (sessionToken) {
      const data = await request('/api/auth/me')
      account = data.account
      return account
    }
    if (!email || !password) {
      throw new Error(
        'Set HUB_EMAIL and HUB_PASSWORD, or HUB_TOKEN, for a YOUNGO Hub account.',
      )
    }
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password, website: '' },
    })
    if (!data?.token || !data?.account) {
      throw new Error('Sign-in did not return a Hub session.')
    }
    sessionToken = data.token
    account = data.account
    return account
  }

  return {
    origin: hubOrigin,
    async whoami() {
      const signedIn = await ensureSession()
      return request('/api/auth/me').catch(() => ({ account: signedIn }))
    },
    async memberGet(path, query) {
      await ensureSession()
      return request(path, { query })
    },
    async memberPost(path, body, query) {
      await ensureSession()
      return request(path, { method: 'POST', body, query })
    },
    async memberPatch(path, body) {
      await ensureSession()
      return request(path, { method: 'PATCH', body })
    },
  }
}

export async function callHubContentTool(name, args, client) {
  switch (name) {
    case 'whoami':
      return client.whoami()
    case 'catalog_options':
      return catalogOptions()
    case 'list_opportunities':
      return client.memberGet('/api/member/opportunities', {
        kind: args.kind,
        format: args.format,
      })
    case 'list_org_opportunities':
      return client.memberGet('/api/member/ngo/opportunities', {
        orgId: args.orgId,
      })
    case 'create_opportunity':
      return client.memberPost(
        '/api/member/ngo/opportunities',
        {
          kind: args.kind,
          title: args.title,
          summary: args.summary,
          body: args.body,
          format: args.format,
          location: args.location,
          region: args.region,
          startsAt: args.startsAt,
          endsAt: args.endsAt,
          deadlineAt: args.deadlineAt,
          linkUrl: args.linkUrl,
          orgId: args.orgId,
        },
        args.orgId ? { orgId: args.orgId } : undefined,
      )
    case 'withdraw_opportunity':
      return client.memberPost(
        `/api/member/ngo/opportunities/${encodeURIComponent(args.id)}/withdraw`,
        args.orgId ? { orgId: args.orgId } : {},
      )
    case 'list_opportunity_review':
      return client.memberGet('/api/member/opportunities/review')
    case 'review_opportunity':
      return client.memberPost(
        `/api/member/opportunities/${encodeURIComponent(args.id)}/review`,
        { decision: args.decision, note: args.note },
      )
    case 'submit_resource':
      return client.memberPost('/api/member/resources/submissions', {
        title: args.title,
        url: args.url,
        summary: args.summary,
        publisher: args.publisher,
        pathway: args.pathway,
        type: args.type,
        topic: args.topic,
        region: args.region || 'global',
        language: args.language || 'English',
      })
    case 'list_my_resource_submissions':
      return client.memberGet('/api/member/resources/submissions/mine')
    case 'list_content':
      return client.memberGet('/api/member/content')
    case 'create_content_draft': {
      const payload = { ...(args.payload || {}) }
      if (!payload.slug && payload.title) payload.slug = slugify(payload.title)
      return client.memberPost('/api/member/content/drafts', {
        contentType: args.contentType,
        payload,
      })
    }
    case 'submit_content_draft':
      return client.memberPost(
        `/api/member/content/drafts/${encodeURIComponent(args.id)}/submit`,
        {},
      )
    case 'review_content_draft':
      return client.memberPost(
        `/api/member/content/drafts/${encodeURIComponent(args.id)}/review`,
        { decision: args.decision, note: args.note },
      )
    case 'publish_content_draft':
      return client.memberPost(
        `/api/member/content/drafts/${encodeURIComponent(args.id)}/publish`,
        {},
      )
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
