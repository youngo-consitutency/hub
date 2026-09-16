import { Router, type Request, type Response, type NextFunction } from 'express'
import { getSessionAccount } from '../../lib/accounts.js'
import { bearerToken } from '../../lib/security.js'
import { createRateLimiter } from '../../lib/rateLimit.js'
import * as platform from './service.ts'

export const platformRouter = Router()
platformRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
const enquiryLimit = createRateLimiter({ windowMs: 3600000, max: 5 })
platformRouter.get('/public', async (_req, res) =>
  res.json(await platform.publicPlatform()),
)
platformRouter.post('/enquiries', enquiryLimit, async (req, res) =>
  res.status(201).json(await platform.createEnquiry(req.body || {})),
)

type AuthRequest = Request & { platformActor: platform.Actor }
platformRouter.use(async (req, res, next) => {
  const account = await getSessionAccount(bearerToken(req))
  if (!account) {
    res.status(401).json({
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    })
    return
  }
  ;(req as AuthRequest).platformActor = account
  next()
})
const actor = (req: Request) => (req as AuthRequest).platformActor
platformRouter.post('/members/:id/membership', async (req, res) => {
  await platform.membershipAction(
    actor(req),
    String(req.params.id),
    req.body || {},
  )
  res.json({ ok: true })
})
platformRouter.get('/overview', async (req, res) =>
  res.json(await platform.overview(actor(req))),
)
platformRouter.post('/bodies', async (req, res) =>
  res.status(201).json(await platform.saveBody(actor(req), req.body || {})),
)
platformRouter.patch('/bodies/:id', async (req, res) =>
  res.json(
    await platform.saveBody(actor(req), req.body || {}, String(req.params.id)),
  ),
)
platformRouter.post('/bodies/:id/publish', async (req, res) => {
  await platform.publishBody(
    actor(req),
    String(req.params.id),
    req.body?.version,
  )
  res.json({ ok: true })
})
platformRouter.post('/bodies/:id/join', async (req, res) => {
  await platform.joinBody(actor(req), String(req.params.id))
  res.json({ ok: true })
})
platformRouter.post('/assignments', async (req, res) => {
  await platform.assign(actor(req), req.body || {})
  res.status(201).json({ ok: true })
})
platformRouter.post('/assignments/:id/revoke', async (req, res) => {
  await platform.revoke(
    actor(req),
    String(req.params.id),
    platform.text(req.body || {}, 'reason', 2000),
  )
  res.json({ ok: true })
})
platformRouter.post('/tasks', async (req, res) =>
  res.status(201).json(await platform.saveTask(actor(req), req.body || {})),
)
platformRouter.patch('/tasks/:id', async (req, res) =>
  res.json(
    await platform.saveTask(actor(req), req.body || {}, String(req.params.id)),
  ),
)
platformRouter.post('/decisions', async (req, res) =>
  res.status(201).json(await platform.saveDecision(actor(req), req.body || {})),
)
platformRouter.get('/decisions/:id', async (req, res) =>
  res.json(await platform.decisionDetail(actor(req), String(req.params.id))),
)
platformRouter.patch('/decisions/:id', async (req, res) =>
  res.json(
    await platform.saveDecision(
      actor(req),
      req.body || {},
      String(req.params.id),
    ),
  ),
)
platformRouter.post('/decisions/:id/transition', async (req, res) => {
  await platform.transition(actor(req), String(req.params.id), req.body || {})
  res.json({ ok: true })
})
platformRouter.post('/decisions/:id/contributions', async (req, res) => {
  await platform.contribute(actor(req), String(req.params.id), req.body || {})
  res.status(201).json({ ok: true })
})
platformRouter.post('/contributions/:id/resolve', async (req, res) => {
  await platform.resolveContribution(
    actor(req),
    String(req.params.id),
    req.body || {},
  )
  res.json({ ok: true })
})
platformRouter.post('/decisions/:id/publish', async (req, res) => {
  await platform.publishDecision(
    actor(req),
    String(req.params.id),
    req.body?.version,
  )
  res.json({ ok: true })
})
platformRouter.patch('/enquiries/:id', async (req, res) => {
  await platform.updateEnquiry(
    actor(req),
    String(req.params.id),
    req.body || {},
  )
  res.json({ ok: true })
})
platformRouter.post('/bodies/:id/withdraw-publication', async (req, res) => {
  await platform.withdrawPublication(
    actor(req),
    'body',
    String(req.params.id),
    req.body || {},
  )
  res.json({ ok: true })
})
platformRouter.post('/decisions/:id/withdraw-publication', async (req, res) => {
  await platform.withdrawPublication(
    actor(req),
    'decision',
    String(req.params.id),
    req.body || {},
  )
  res.json({ ok: true })
})
platformRouter.use(
  (error: unknown, _req: Request, res: Response, next: NextFunction) => {
    const err = error as { status?: number; message?: string; code?: string }
    if (err.status) {
      res
        .status(err.status)
        .json({ error: { code: err.code, message: err.message } })
      return
    }
    if (['23503', '23514', '22P02'].includes(err.code || '')) {
      res.status(400).json({
        error: {
          code: 'validation',
          message: 'Check the linked record and field values.',
        },
      })
      return
    }
    next(error)
  },
)
