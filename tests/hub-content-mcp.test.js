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
  const [server, client] = await Promise.all([
    read('scripts/agent/hub-content-mcp.mjs'),
    read('scripts/agent/hubContentClient.mjs'),
  ])
  assert.match(server, /youngo-hub-content/)
  assert.match(server, /HUB_EMAIL/)
  assert.match(server, /HUB_PASSWORD/)
  assert.doesNotMatch(server, /from ['"]pg['"]/)
  assert.doesNotMatch(client, /from ['"]pg['"]/)
  assert.doesNotMatch(client, /getPool|DATABASE_URL/)
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
