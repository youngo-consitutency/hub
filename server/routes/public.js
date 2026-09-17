import { Router } from 'express'
import * as store from '../lib/store.js'
import { getSessionAccount } from '../lib/accounts.js'
import { getWgProgress } from '../lib/lifecycle.js'
import {
  eventView,
  groupView,
  feedView,
  searchView,
  directoryView,
} from '../lib/publicViews.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import { bearerToken } from '../lib/security.js'
import { listResourceCatalogue } from '../lib/resourceCatalogue.js'

export const publicRouter = Router()
const gysSignupLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 6 })

publicRouter.use(async (req, res, next) => {
  try {
    const account = await getSessionAccount(bearerToken(req))
    if (account?.isVerified) {
      req.publicAccount = account
      res.set('Cache-Control', 'no-store')
    }
    next()
  } catch (err) {
    next(err)
  }
})

const viewOptions = (req) => ({ includePrivate: Boolean(req.publicAccount) })

publicRouter.get('/recognition', (_req, res) => {
  res.status(410).json({
    error: {
      code: 'retired',
      message: 'Contribution points have been retired.',
    },
  })
})

publicRouter.get('/feed', (req, res) => {
  res.json(feedView(store.getFeed(), viewOptions(req)))
})

publicRouter.get('/events', (req, res) => {
  res.json({
    items: store
      .listEvents({ type: req.query.type })
      .map((event) => eventView(event, viewOptions(req))),
  })
})

publicRouter.get('/events/:slug', (req, res) => {
  const event = store.getEvent(req.params.slug)
  if (!event)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Unknown event' } })
  res.json(eventView(event, viewOptions(req)))
})

publicRouter.get('/submissions', (req, res) => {
  res.json({ items: store.listSubmissions(req.query.state || 'open') })
})

publicRouter.get('/submissions/:slug', (req, res) => {
  const submission = store.getSubmission(req.params.slug)
  if (!submission)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Unknown submission' } })
  res.json(submission)
})

publicRouter.get('/council', (req, res) => {
  res.json({ items: store.listCouncil(req.query.state || 'active') })
})

publicRouter.get('/council/:slug', (req, res) => {
  const decision = store.getDecision(req.params.slug)
  if (!decision)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Unknown decision' } })
  res.json(decision)
})

publicRouter.get('/coys', (req, res) => {
  res.json({
    items: store.listCoys({ type: req.query.type, region: req.query.region }),
  })
})

publicRouter.get('/coys/:slug', (req, res) => {
  const coy = store.getCoy(req.params.slug)
  if (!coy)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Unknown COY' } })
  res.json(coy)
})

publicRouter.get('/groups', (req, res) => {
  res.json({
    items: store
      .listGroups()
      .map((group) => groupView(group, viewOptions(req))),
  })
})

publicRouter.get('/groups/:slug', async (req, res, next) => {
  try {
    const group = store.getGroup(req.params.slug)
    if (!group)
      return res.status(404).json({
        error: { code: 'not_found', message: 'Unknown working group' },
      })

    const progress = req.publicAccount
      ? await getWgProgress(req.publicAccount.id, req.params.slug)
      : null
    const includeWorkspace = Boolean(
      progress?.presentation_ok && progress?.rules_ok,
    )

    res.json(
      groupView(group, {
        ...viewOptions(req),
        includeWorkspace,
      }),
    )
  } catch (err) {
    next(err)
  }
})

publicRouter.get('/directory', (req, res) => {
  const includePrivate = Boolean(req.publicAccount)
  res.json({
    items: directoryView(store.listDirectory({ member: includePrivate }), {
      includePrivate,
    }),
  })
})

publicRouter.get('/gys', (req, res) => {
  const gys = store.getGys()
  if (!gys)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'No statement available' } })
  res.json(gys)
})

/** Public catalogue with explicit verification state. Drafts never cross this API. */
publicRouter.get('/resources', async (req, res, next) => {
  try {
    const items = await listResourceCatalogue()
    res.json({ items })
  } catch (error) {
    next(error)
  }
})

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Public GYS signup. A honeypot and field limits reduce automated spam without
// adding a CAPTCHA. Logs may include country and organisation, but not names or
// email addresses.
publicRouter.post('/gys/signup', gysSignupLimit, async (req, res) => {
  const b = req.body || {}
  if (b.website) return res.status(201).json({ ok: true }) // honeypot: bots fill this; feign success

  const name = String(b.name || '').trim()
  const email = String(b.email || '').trim()
  const country = String(b.country || '').trim()
  const organization = String(b.organization || '').trim()

  const fields = {}
  if (!name) fields.name = 'Please enter your name.'
  if (!EMAIL_RE.test(email)) fields.email = 'Please enter a valid email.'
  if (!country) fields.country = 'Please enter your country.'
  if (
    name.length > 120 ||
    email.length > 160 ||
    country.length > 80 ||
    organization.length > 160
  ) {
    return res.status(400).json({
      error: { code: 'too_long', message: 'One of the fields is too long.' },
    })
  }
  if (Object.keys(fields).length) {
    return res.status(400).json({
      error: {
        code: 'validation',
        message: 'Please check the form.',
        fields,
      },
    })
  }

  try {
    const record = await store.addGysSignup({
      name,
      email,
      country,
      organization: organization || null,
      cycle: 'GYS2026',
    })
    console.log(
      JSON.stringify({
        event: 'gys_signup',
        cycle: 'GYS2026',
        country: record.country,
        organization: record.organization,
        at: record.at,
      }),
    )
    res.status(201).json({ ok: true })
  } catch (err) {
    console.error('gys_signup failed:', err.message)
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'We could not save your signup. Please try again.',
      },
    })
  }
})

publicRouter.get('/search', (req, res) => {
  res.json(
    searchView(store.search(String(req.query.q || '')), viewOptions(req)),
  )
})
