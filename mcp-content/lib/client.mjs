/**
 * HTTP client for the Hub content MCP. Signs in with a YOUNGO Hub account and
 * calls the same member APIs the website uses, so authorisation and audit stay
 * on the server. Never opens a database.
 */
// Schema-bound enums (select-field options) come from src/shared; content
// vocab and working groups are fetched live from the Hub API so the catalogue
// always reflects the database — nothing operational is baked into this file.
import { OPPORTUNITY_FORMATS, OPPORTUNITY_KINDS } from '../../src/shared/opportunities.js'
import { slugify } from '../../src/shared/slug.js'

export { slugify }

// Vocab + working groups are live Hub data — fetched per call so the MCP
// advertises what the database actually accepts, not a bundled snapshot.
export async function catalogOptions(client) {
  const [options, groups] = await Promise.all([
    client.memberGet('/api/documents/content-options').catch(() => null),
    client.memberGet('/api/groups').catch(() => null),
  ])
  const body = options?.body || {}
  return {
    opportunityKinds: OPPORTUNITY_KINDS,
    opportunityFormats: OPPORTUNITY_FORMATS,
    eventTypes: body.eventTypes || [],
    workingGroups: (groups?.items || []).map((g) => ({
      slug: g.slug,
      name: g.name,
    })),
    announcementHint: {
      fields: ['slug', 'title', 'body', 'pinned', 'ctaUrl', 'ctaLabel', 'ctaDeadlineAt'],
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
    resourcePathways: body.resourcePathways || [],
    resourceTypes: body.resourceTypes || [],
    resourceTopics: body.resourceTopics || [],
    resourceRegions: body.resourceRegions || [],
    resourceLanguages: body.resourceLanguages || [],
  }
}

// slugs share one algorithm with the Hub API (src/shared/slug.js); 'item' is
// the MCP fallback when a title normalises to nothing.
const contentSlug = (title) => slugify(title) || 'item'

/** @param {Partial<NodeJS.ProcessEnv>} [env] */
export function resolveHubOrigin(env = process.env) {
  const raw = String(env.HUB_ORIGIN || 'http://localhost:3000').trim()
  const origin = raw.replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(origin)) {
    throw new Error('HUB_ORIGIN must be an http(s) URL.')
  }
  return origin
}

function apiError(status, body) {
  const message = body?.error?.message || body?.message || `Hub API request failed (${status})`
  const error = new Error(message)
  error.status = status
  error.code = body?.error?.code
  error.fields = body?.error?.fields
  error.body = body
  return error
}

/**
 * @param {{
 *   origin: string,
 *   email?: string,
 *   password?: string,
 *   token?: string,
 *   fetchImpl?: typeof fetch,
 * }} [options]
 */
export function createHubClient({ origin, email, password, token, fetchImpl = fetch } = {}) {
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
      throw new Error('Set HUB_EMAIL and HUB_PASSWORD, or HUB_TOKEN, for a YOUNGO Hub account.')
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
      return catalogOptions(client)
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
      return client.memberPost(`/api/member/opportunities/${encodeURIComponent(args.id)}/review`, {
        decision: args.decision,
        note: args.note,
      })
    case 'list_feedback_tickets':
      return client.memberGet('/api/member/feedback', {
        status: args.status,
        kind: args.kind,
        limit: args.limit,
      })
    case 'triage_feedback_ticket':
      return client.memberPatch(`/api/member/feedback/${encodeURIComponent(args.id)}`, {
        status: args.status,
        triageNote: args.triageNote,
      })
    case 'submit_resource':
      return client.memberPost('/api/member/resources/submissions', {
        title: args.title,
        url: args.url,
        summary: args.summary,
        publisher: args.publisher,
        pathway: args.pathway,
        type: args.type,
        topic: args.topic,
        region: args.region,
        language: args.language,
      })
    case 'list_my_resource_submissions':
      return client.memberGet('/api/member/resources/submissions/mine')
    case 'list_content':
      return client.memberGet('/api/member/content')
    case 'get_content':
      return client.memberGet(
        `/api/member/content/live/${encodeURIComponent(args.contentType)}/${encodeURIComponent(args.slug)}`,
      )
    case 'update_content':
      return client.memberPatch(
        `/api/member/content/live/${encodeURIComponent(args.contentType)}/${encodeURIComponent(args.slug)}`,
        {
          payload: args.payload,
          mode: args.mode === 'apply' ? 'apply' : 'draft',
        },
      )
    case 'unpublish_content':
      return client.memberPost(
        `/api/member/content/live/${encodeURIComponent(args.contentType)}/${encodeURIComponent(args.slug)}/unpublish`,
        { reason: args.reason },
      )
    case 'create_content_draft': {
      const payload = { ...(args.payload || {}) }
      if (!payload.slug && payload.title) payload.slug = contentSlug(payload.title)
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
      return client.memberPost(`/api/member/content/drafts/${encodeURIComponent(args.id)}/review`, {
        decision: args.decision,
        note: args.note,
      })
    case 'publish_content_draft':
      return client.memberPost(
        `/api/member/content/drafts/${encodeURIComponent(args.id)}/publish`,
        {},
      )
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
