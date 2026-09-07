import { Router } from 'express'
import { createRateLimiter } from '../lib/rateLimit.js'
import {
  CONTRIBUTION_KINDS,
  createContribution,
  listContributions,
} from '../lib/consultationContributions.js'

export const consultationRouter = Router()
const submitLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 8 })

consultationRouter.get('/kinds', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ kinds: CONTRIBUTION_KINDS })
})

consultationRouter.get('/contributions', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const items = await listContributions({
      kind: req.query.kind,
      limit: req.query.limit,
    })
    res.json({ items })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Could not load the consultation floor.',
      },
    })
  }
})

consultationRouter.post('/contributions', submitLimit, async (req, res) => {
  const body = req.body || {}
  if (body.website) return res.status(201).json({ ok: true, item: null })

  try {
    const item = await createContribution(body)
    res.status(201).json({ ok: true, item })
  } catch (err) {
    if (err.code === 'validation') {
      return res.status(400).json({
        error: { code: 'validation', message: err.message },
      })
    }
    console.error(err)
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Could not save that contribution. Please try again.',
      },
    })
  }
})
