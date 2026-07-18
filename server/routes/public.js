import { Router } from 'express'
import * as store from '../lib/store.js'
import { rateLimit } from '../lib/security.js'
import { listPublicRecognitionBoard, RECOGNITION_TIERS } from '../lib/points.js'

export const publicRouter = Router()

/** Public NGO contribution recognition board (names + points only). */
publicRouter.get('/recognition', async (req, res) => {
  try {
    const items = await listPublicRecognitionBoard({ limit: Number(req.query.limit) || 50 })
    res.json({
      items,
      tiers: RECOGNITION_TIERS,
      note: 'Hub recognition for verified NGO contributions (badge support, UNFCCC submissions). Not an official UNFCCC credential.',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not load recognition board.' } })
  }
})

publicRouter.get('/feed', (req, res) => {
  res.json(store.getFeed())
})

publicRouter.get('/events', (req, res) => {
  res.json({ items: store.listEvents({ type: req.query.type }) })
})

publicRouter.get('/events/:slug', (req, res) => {
  const event = store.getEvent(req.params.slug)
  if (!event) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown event' } })
  res.json(event)
})

publicRouter.get('/submissions', (req, res) => {
  res.json({ items: store.listSubmissions(req.query.state || 'open') })
})

publicRouter.get('/submissions/:slug', (req, res) => {
  const submission = store.getSubmission(req.params.slug)
  if (!submission) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown submission' } })
  res.json(submission)
})

publicRouter.get('/council', (req, res) => {
  res.json({ items: store.listCouncil(req.query.state || 'active') })
})

publicRouter.get('/council/:slug', (req, res) => {
  const decision = store.getDecision(req.params.slug)
  if (!decision) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown decision' } })
  res.json(decision)
})

publicRouter.get('/coys', (req, res) => {
  res.json({ items: store.listCoys({ type: req.query.type, region: req.query.region }) })
})

publicRouter.get('/coys/:slug', (req, res) => {
  const coy = store.getCoy(req.params.slug)
  if (!coy) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown COY' } })
  res.json(coy)
})

publicRouter.get('/groups', (req, res) => {
  res.json({ items: store.listGroups() })
})

publicRouter.get('/groups/:slug', (req, res) => {
  const group = store.getGroup(req.params.slug)
  if (!group) return res.status(404).json({ error: { code: 'not_found', message: 'Unknown working group' } })
  res.json(group)
})

publicRouter.get('/directory', (req, res) => {
  res.json({ items: store.listDirectory({ member: false }) })
})

publicRouter.get('/gys', (req, res) => {
  const gys = store.getGys()
  if (!gys) return res.status(404).json({ error: { code: 'not_found', message: 'No statement available' } })
  res.json(gys)
})

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Public GYS 2026 participation signup. Honeypot + length caps in lieu of a captcha
// (05 §4.7). Logs non-PII only (country/org) per 05 §7 — never names/emails.
publicRouter.post('/gys/signup', rateLimit({ name: 'gys-signup', max: 8, windowMs: 60 * 60_000 }), async (req, res) => {
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
  if (name.length > 120 || email.length > 160 || country.length > 80 || organization.length > 160) {
    return res.status(400).json({ error: { code: 'too_long', message: 'One of the fields is too long.' } })
  }
  if (Object.keys(fields).length) {
    return res.status(400).json({ error: { code: 'validation', message: 'Please check the form.', fields } })
  }

  try {
    const record = await store.addGysSignup({ name, email, country, organization: organization || null, cycle: 'GYS2026' })
    console.log(JSON.stringify({ event: 'gys_signup', cycle: 'GYS2026', country: record.country, organization: record.organization, at: record.at }))
    res.status(201).json({ ok: true })
  } catch (err) {
    console.error('gys_signup failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not save your signup — please try again.' } })
  }
})

publicRouter.get('/search', (req, res) => {
  res.json(store.search(String(req.query.q || '')))
})
