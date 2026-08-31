import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  HUB_CONTENT_TOOLS,
  callHubContentTool,
  catalogOptions,
  createHubClient,
  resolveHubOrigin,
  slugify,
} from '../scripts/agent/hubContentClient.mjs'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('content MCP talks to the Hub HTTP API and not the database', async () => {
  const [stdio, client, http] = await Promise.all([
    read('scripts/agent/hub-content-mcp.mjs'),
    read('mcp-content/lib/client.mjs'),
    read('mcp-content/server.mjs'),
  ])
  assert.match(stdio, /HUB_EMAIL/)
  assert.match(stdio, /HUB_PASSWORD/)
  assert.doesNotMatch(stdio, /from ['"]pg['"]/)
  assert.doesNotMatch(client, /from ['"]pg['"]/)
  assert.doesNotMatch(client, /getPool/)
  assert.doesNotMatch(client, /process\.env\.DATABASE_URL/)
  assert.doesNotMatch(http, /from ['"]pg['"]/)
  assert.doesNotMatch(http, /getPool/)
  assert.doesNotMatch(http, /process\.env\.DATABASE_URL/)
  assert.match(client, /\/api\/auth\/login/)
  assert.match(client, /\/api\/member\/ngo\/opportunities/)
  assert.match(client, /\/api\/member\/resources\/submissions/)
  assert.match(client, /\/api\/member\/content\/drafts/)
})

test('content MCP exposes posting, resource, and governed content tools', () => {
  const names = HUB_CONTENT_TOOLS.map((tool) => tool.name)
  for (const name of [
    'whoami',
    'catalog_options',
    'create_opportunity',
    'list_opportunities',
    'submit_resource',
    'create_content_draft',
    'publish_content_draft',
    'get_content',
    'update_content',
    'unpublish_content',
  ]) {
    assert.ok(names.includes(name), name)
  }
})

test('catalog options reuse Hub posting and resource lists', () => {
  const options = catalogOptions()
  assert.ok(
    options.opportunityKinds.some((item) => item.value === 'opportunity'),
  )
  assert.ok(options.eventTypes.includes('wg_call'))
  assert.ok(options.workingGroups.some((item) => item.slug === 'agriculture'))
  assert.ok(options.resourceTopics.includes('Youth and community'))
})

test('slugify builds a Hub content slug from a title', () => {
  assert.equal(
    slugify('Youth Climate Fellowship 2026'),
    'youth-climate-fellowship-2026',
  )
})

test('resolveHubOrigin requires http(s) and strips a trailing slash', () => {
  assert.equal(
    resolveHubOrigin({ HUB_ORIGIN: 'https://youngohub.org/' }),
    'https://youngohub.org',
  )
  assert.throws(() => resolveHubOrigin({ HUB_ORIGIN: 'youngohub.org' }), /http/)
})

test('create_opportunity signs in then posts to the member API', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const href = String(url)
    calls.push({
      href,
      method: options.method,
      body: options.body,
      headers: options.headers,
    })
    if (href.endsWith('/api/auth/login')) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          token: 'session-token',
          account: { id: 'org-1', entityType: 'organization' },
        }),
      }
    }
    if (href.endsWith('/api/member/ngo/opportunities')) {
      assert.equal(options.headers.Authorization, 'Bearer session-token')
      return {
        ok: true,
        json: async () => ({
          item: {
            id: 'opp-1',
            status: 'pending_review',
            title: 'Youth climate fellowship',
          },
          note: 'Sent for review.',
        }),
      }
    }
    throw new Error(`unexpected ${href}`)
  }

  const client = createHubClient({
    origin: 'https://youngohub.org',
    email: 'org@example.org',
    password: 'password12',
    fetchImpl,
  })
  const result = await callHubContentTool(
    'create_opportunity',
    {
      kind: 'opportunity',
      title: 'Youth climate fellowship',
      linkUrl: 'https://example.org/apply',
    },
    client,
  )

  assert.equal(result.item.id, 'opp-1')
  assert.equal(calls[0].method, 'POST')
  assert.match(calls[0].href, /\/api\/auth\/login$/)
  assert.match(calls[1].href, /\/api\/member\/ngo\/opportunities$/)
  const login = JSON.parse(calls[0].body)
  assert.equal(login.email, 'org@example.org')
  const posted = JSON.parse(calls[1].body)
  assert.equal(posted.kind, 'opportunity')
  assert.equal(posted.title, 'Youth climate fellowship')
})

test('create_content_draft fills a slug from the title when omitted', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const href = String(url)
    calls.push({ href, body: options.body })
    if (href.endsWith('/api/auth/me')) {
      return {
        ok: true,
        json: async () => ({ account: { id: 'ed-1' } }),
      }
    }
    if (href.endsWith('/api/member/content/drafts')) {
      return {
        ok: true,
        json: async () => ({ item: { id: 'draft-1', status: 'draft' } }),
      }
    }
    throw new Error(`unexpected ${href}`)
  }

  const client = createHubClient({
    origin: 'https://youngohub.org',
    token: 'already-signed-in',
    fetchImpl,
  })
  await callHubContentTool(
    'create_content_draft',
    {
      contentType: 'announcement',
      payload: {
        title: 'Open call for GYS inputs',
        body: 'YOUNGO is gathering inputs for the Global Youth Statement.',
      },
    },
    client,
  )
  const posted = JSON.parse(calls.at(-1).body)
  assert.equal(posted.contentType, 'announcement')
  assert.equal(posted.payload.slug, 'open-call-for-gys-inputs')
})

test('get_content, update_content apply, and unpublish_content call live member APIs', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const href = String(url)
    calls.push({
      href,
      method: options.method || 'GET',
      body: options.body,
    })
    if (href.endsWith('/api/auth/me')) {
      return {
        ok: true,
        json: async () => ({ account: { id: 'admin-1' } }),
      }
    }
    if (href.includes('/api/member/content/live/event/ace-follow-up-call')) {
      if ((options.method || 'GET') === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            mode: 'apply',
            slug: 'ace-follow-up-call',
            item: {
              slug: 'ace-follow-up-call',
              title: 'ACE follow-up (updated)',
            },
          }),
        }
      }
      if (href.endsWith('/unpublish')) {
        return {
          ok: true,
          json: async () => ({ unpublished: true, slug: 'ace-follow-up-call' }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          contentType: 'event',
          slug: 'ace-follow-up-call',
          item: { slug: 'ace-follow-up-call', title: 'ACE follow-up call' },
        }),
      }
    }
    throw new Error(`unexpected ${href} ${options.method}`)
  }

  const client = createHubClient({
    origin: 'https://youngohub.org',
    token: 'already-signed-in',
    fetchImpl,
  })

  const loaded = await callHubContentTool(
    'get_content',
    { contentType: 'event', slug: 'ace-follow-up-call' },
    client,
  )
  assert.equal(loaded.item.slug, 'ace-follow-up-call')

  await callHubContentTool(
    'update_content',
    {
      contentType: 'event',
      slug: 'ace-follow-up-call',
      mode: 'apply',
      payload: { title: 'ACE follow-up (updated)' },
    },
    client,
  )
  await callHubContentTool(
    'unpublish_content',
    {
      contentType: 'event',
      slug: 'ace-follow-up-call',
      reason: 'Duplicate listing',
    },
    client,
  )

  assert.equal(calls[1].method, 'GET')
  assert.match(
    calls[1].href,
    /\/api\/member\/content\/live\/event\/ace-follow-up-call$/,
  )
  assert.equal(calls[2].method, 'PATCH')
  assert.equal(JSON.parse(calls[2].body).mode, 'apply')
  assert.equal(calls[3].method, 'POST')
  assert.match(calls[3].href, /\/unpublish$/)
})
