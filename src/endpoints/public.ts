import type { Endpoint, PayloadRequest } from 'payload'
import { endpoint, fail, json, PUBLIC_CACHE, viewCache } from '../lib/respond'
import { isVerifiedAccount } from '../lib/accounts'
import { eventView, groupView, feedView, searchView, directoryView } from '../lib/views'
import * as store from '../lib/content'
import { getDocument } from '../lib/documents'
import { rateLimit } from '../lib/rateLimit'

// Members who are verified get the private view of shared content.
const viewOptions = (req: PayloadRequest) => {
  const account = req.user?.collection === 'accounts' ? req.user : null
  return { includePrivate: isVerifiedAccount(account), account }
}

async function wgProgressFor(req: PayloadRequest, wgSlug: string) {
  const account = req.user?.collection === 'accounts' ? req.user : null
  if (!account) return null
  const { docs } = await req.payload.find({
    collection: 'wg-progress',
    where: {
      account: { equals: account.id },
      wgSlug: { equals: wgSlug },
    },
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0] as any) || null
}

const gysSignupLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  scope: 'gys-signup',
})

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const publicEndpoints: Endpoint[] = [
  {
    path: '/landing',
    method: 'get',
    handler: endpoint(async (req) => {
      const { docs } = await req.payload.find({
        collection: 'content-events',
        where: {
          and: [
            { state: { equals: 'published' } },
            { startsAt: { greater_than_equal: new Date().toISOString() } },
          ],
        },
        select: { slug: true, title: true, startsAt: true },
        sort: 'startsAt',
        limit: 3,
        depth: 0,
        overrideAccess: false,
        req,
      })
      // Deliberately project only public fields, even for signed-in requests.
      const res = json({
        events: docs.map(({ slug, title, startsAt }) => ({ slug, title, startsAt })),
      })
      res.headers.set('Cache-Control', PUBLIC_CACHE)
      return res
    }),
  },
  {
    path: '/recognition',
    method: 'get',
    handler: endpoint(() =>
      json(
        {
          error: {
            code: 'retired',
            message: 'Contribution points have been retired.',
          },
        },
        { status: 410 },
      ),
    ),
  },
  {
    path: '/feed',
    method: 'get',
    handler: endpoint(async (req) => {
      const opts = viewOptions(req)
      const feed = await store.getFeed(req, new Date(), opts.includePrivate)
      return viewCache(json(feedView(feed, opts)), opts.includePrivate)
    }),
  },
  {
    path: '/events',
    method: 'get',
    handler: endpoint(async (req) => {
      const opts = viewOptions(req)
      const type = (req.query?.type as string) || undefined
      const items = await store.listEvents(req, { type })
      return viewCache(json({ items: items.map((e) => eventView(e, opts)) }), opts.includePrivate)
    }),
  },
  {
    path: '/events/:slug',
    method: 'get',
    handler: endpoint(async (req) => {
      const opts = viewOptions(req)
      const event = await store.getEvent(req, String(req.routeParams?.slug))
      if (!event) throw fail.notFound('Unknown event')
      return viewCache(json(eventView(event, opts)), opts.includePrivate)
    }),
  },
  {
    path: '/submissions',
    method: 'get',
    handler: endpoint(async (req) => {
      const state = (req.query?.state as string) || 'open'
      return viewCache(json({ items: await store.listSubmissions(req, state) }), false)
    }),
  },
  {
    path: '/submissions/:slug',
    method: 'get',
    handler: endpoint(async (req) => {
      const sub = await store.getSubmission(req, String(req.routeParams?.slug))
      if (!sub) throw fail.notFound('Unknown submission')
      return viewCache(json(sub), false)
    }),
  },
  {
    path: '/council',
    method: 'get',
    handler: endpoint(async (req) => {
      const state = (req.query?.state as string) || 'active'
      const opts = viewOptions(req)
      return viewCache(
        json({ items: await store.listDecisions(req, state, opts.includePrivate) }),
        opts.includePrivate,
      )
    }),
  },
  {
    path: '/council/:slug',
    method: 'get',
    handler: endpoint(async (req) => {
      const opts = viewOptions(req)
      const d = await store.getDecision(req, String(req.routeParams?.slug), opts.includePrivate)
      if (!d) throw fail.notFound('Unknown decision')
      return viewCache(json(d), opts.includePrivate)
    }),
  },
  {
    path: '/coys',
    method: 'get',
    handler: endpoint(async (req) => {
      return viewCache(
        json({
          items: await store.listCoys(req, {
            type: req.query?.type as string,
            region: req.query?.region as string,
          }),
        }),
        false,
      )
    }),
  },
  {
    path: '/coys/:slug',
    method: 'get',
    handler: endpoint(async (req) => {
      const coy = await store.getCoy(req, String(req.routeParams?.slug))
      if (!coy) throw fail.notFound('Unknown COY')
      return viewCache(json(coy), false)
    }),
  },
  {
    path: '/groups',
    method: 'get',
    handler: endpoint(async (req) => {
      const opts = viewOptions(req)
      const items = await store.listGroups(req)
      return viewCache(json({ items: items.map((g) => groupView(g, opts)) }), opts.includePrivate)
    }),
  },
  {
    path: '/groups/:slug',
    method: 'get',
    handler: endpoint(async (req) => {
      const slug = String(req.routeParams?.slug)
      const opts = viewOptions(req)
      const group = await store.getGroup(req, slug)
      if (!group) throw fail.notFound('Unknown working group')
      const progress = opts.account ? await wgProgressFor(req, slug) : null
      const includeWorkspace = Boolean(progress?.presentationOk && progress?.rulesOk)
      return viewCache(json(groupView(group, { ...opts, includeWorkspace })), opts.includePrivate)
    }),
  },
  {
    path: '/directory',
    method: 'get',
    handler: endpoint(async (req) => {
      const opts = viewOptions(req)
      const items = await store.listDirectory(req)
      return viewCache(
        json({
          items: directoryView(items, {
            includePrivate: opts.includePrivate,
          }),
        }),
        opts.includePrivate,
      )
    }),
  },
  {
    path: '/gys',
    method: 'get',
    handler: endpoint(async (req) => {
      const gys = await store.getGys(req)
      if (!gys) throw fail.notFound('No statement available')
      return viewCache(json(gys), false)
    }),
  },
  {
    path: '/resources',
    method: 'get',
    handler: endpoint(async (req) => {
      return viewCache(json({ items: await store.listResources(req) }), false)
    }),
  },
  {
    path: '/gys/signup',
    method: 'post',
    handler: endpoint(async (req) => {
      await gysSignupLimit(req)
      const b = ((await req.json?.()) || {}) as Record<string, any>
      if (b.website) return json({ ok: true }, { status: 201 })

      const name = String(b.name || '').trim()
      const email = String(b.email || '').trim()
      const country = String(b.country || '').trim()
      const organization = String(b.organization || '').trim()

      const fields: Record<string, string> = {}
      if (!name) fields.name = 'Please enter your name.'
      if (!EMAIL_RE.test(email)) fields.email = 'Please enter a valid email.'
      if (!country) fields.country = 'Please enter your country.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      if (
        name.length > 120 ||
        email.length > 160 ||
        country.length > 80 ||
        organization.length > 160
      ) {
        return json(
          { error: { code: 'too_long', message: 'One of the fields is too long.' } },
          { status: 400 },
        )
      }
      await store.addGysSignup(req, {
        name,
        email,
        country,
        organization: organization || undefined,
        cycle: 'GYS2026',
      })
      req.payload.logger.info({ event: 'gys_signup', country })
      return json({ ok: true }, { status: 201 })
    }),
  },
  {
    path: '/documents/:slug',
    method: 'get',
    handler: endpoint(async (req) => {
      const doc = await getDocument(req, String(req.routeParams?.slug))
      if (!doc) throw fail.notFound('Unknown document')
      return viewCache(json(doc), false)
    }),
  },
  {
    path: '/search',
    method: 'get',
    handler: endpoint(async (req) => {
      const opts = viewOptions(req)
      const q = String(req.query?.q || '')
      const results = await store.search(req, q, opts.includePrivate)
      return viewCache(json(searchView(results, opts)), opts.includePrivate)
    }),
  },
]
