import { Router } from 'express'
import { createHash } from 'node:crypto'
import { getSessionAccount } from '../lib/accounts.js'
import { ensureAdminRole } from '../lib/lifecycle.js'
import { getAccessProfile, hasCapability } from '../lib/access.js'
import { recordAudit } from '../lib/audit.js'
import { cookieValue, SESSION_COOKIE, rateLimit } from '../lib/security.js'
import {
  INTELLIGENCE_FIELD_POLICY,
  queryIntelligence,
  recordIntelligenceQuery,
  getIntelligenceMetrics,
  listWritebacks,
  createWriteback,
  approveWriteback,
  applyWriteback,
} from '../lib/intelligence.js'

export const intelligenceRouter = Router()

const publicLimit = rateLimit({
  name: 'intelligence-public',
  max: 20,
  windowMs: 60_000,
})
const memberLimit = rateLimit({
  name: 'intelligence-member',
  max: 40,
  windowMs: 60_000,
})

function bearerToken(req) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  return (
    String(req.headers['x-session-token'] || '').trim() ||
    cookieValue(req, SESSION_COOKIE) ||
    null
  )
}

async function requireAccount(req, res) {
  let account = await getSessionAccount(bearerToken(req))
  if (!account) {
    res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Sign in to use Hub Intelligence.',
      },
    })
    return null
  }
  account = await ensureAdminRole(account)
  req.account = account
  return account
}

function requireVerified(account, res) {
  if (!account?.isVerified) {
    res.status(403).json({
      error: {
        code: 'not_verified',
        message: 'Complete the membership course to unlock Hub Intelligence.',
      },
    })
    return false
  }
  return true
}

function cleanQuery(req, res) {
  const query = String(req.body?.query || '').trim()
  if (query.length < 3 || query.length > 500) {
    res.status(400).json({
      error: {
        code: 'validation',
        message: 'Question must be 3–500 characters.',
      },
    })
    return null
  }
  return query
}

function queryFingerprint(query) {
  return createHash('sha256').update(query).digest('hex').slice(0, 16)
}

intelligenceRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

intelligenceRouter.get('/policy', (req, res) =>
  res.json({ policy: INTELLIGENCE_FIELD_POLICY }),
)

intelligenceRouter.post(
  '/public/query',
  publicLimit,
  async (req, res, next) => {
    try {
      const query = cleanQuery(req, res)
      if (!query) return
      const result = queryIntelligence({ query, limit: req.body?.limit })
      await recordIntelligenceQuery({
        audience: 'public',
        query: `[public-query:${queryFingerprint(query)}]`,
        resultCount: result.evidence.length,
        requestId: req.requestId,
      })
      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

intelligenceRouter.post('/query', memberLimit, async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(account, res)) return
    const access = await getAccessProfile(account)
    if (!hasCapability(access, 'intelligence.query'))
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Intelligence query access is not assigned.',
        },
      })
    const query = cleanQuery(req, res)
    if (!query) return
    const result = queryIntelligence({
      query,
      account,
      access,
      limit: req.body?.limit,
    })
    await Promise.all([
      recordIntelligenceQuery({
        actorId: account.id,
        audience: result.audience,
        query,
        resultCount: result.evidence.length,
        requestId: req.requestId,
      }),
      recordAudit({
        actorId: account.id,
        action: 'intelligence.query',
        targetType: 'intelligence_query',
        targetId: queryFingerprint(query),
        after: {
          audience: result.audience,
          resultCount: result.evidence.length,
        },
        requestId: req.requestId,
      }),
    ])
    res.json(result)
  } catch (error) {
    next(error)
  }
})

intelligenceRouter.get('/metrics', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    const access = await getAccessProfile(account)
    if (!hasCapability(access, 'audit.read'))
      return res.status(403).json({
        error: { code: 'forbidden', message: 'Audit access required.' },
      })
    res.json(await getIntelligenceMetrics())
  } catch (error) {
    next(error)
  }
})

intelligenceRouter.post('/writebacks', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(account, res)) return
    const access = await getAccessProfile(account)
    if (!hasCapability(access, 'intelligence.writeback.propose'))
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Writeback proposal access is not assigned.',
        },
      })
    const item = await createWriteback({
      actorId: account.id,
      idempotencyKey: req.get('idempotency-key'),
      payload: req.body,
    })
    await recordAudit({
      actorId: account.id,
      action: 'intelligence.writeback.proposed',
      targetType: 'intelligence_writeback',
      targetId: item.id,
      after: { action: item.action, status: item.status },
      requestId: req.requestId,
    })
    res.status(201).json({ item })
  } catch (error) {
    if (error.code === 'validation')
      return res
        .status(400)
        .json({ error: { code: error.code, message: error.message } })
    next(error)
  }
})

intelligenceRouter.get('/writebacks', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    const access = await getAccessProfile(account)
    const canReview = hasCapability(access, 'intelligence.writeback.approve')
    res.json({
      items: await listWritebacks({ actorId: account.id, canReview }),
    })
  } catch (error) {
    next(error)
  }
})

intelligenceRouter.post('/writebacks/:id/approve', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    const access = await getAccessProfile(account)
    if (!hasCapability(access, 'intelligence.writeback.approve'))
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Admin writeback approval required.',
        },
      })
    const item = await approveWriteback({
      id: req.params.id,
      actorId: account.id,
      reason: req.body?.reason,
    })
    await recordAudit({
      actorId: account.id,
      action: 'intelligence.writeback.approved',
      targetType: 'intelligence_writeback',
      targetId: req.params.id,
      after: { status: item.status },
      reason: req.body?.reason,
      requestId: req.requestId,
    })
    res.json({ item })
  } catch (error) {
    if (['validation', 'separation_of_duties'].includes(error.code))
      return res
        .status(409)
        .json({ error: { code: error.code, message: error.message } })
    next(error)
  }
})

intelligenceRouter.post('/writebacks/:id/apply', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account) return
    const access = await getAccessProfile(account)
    if (!hasCapability(access, 'intelligence.writeback.apply'))
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Admin writeback application required.',
        },
      })
    const result = await applyWriteback({
      id: req.params.id,
      actorId: account.id,
    })
    await recordAudit({
      actorId: account.id,
      action: 'intelligence.writeback.applied',
      targetType: 'intelligence_writeback',
      targetId: req.params.id,
      after: { status: 'applied', noteId: result.note.id },
      requestId: req.requestId,
    })
    res.json(result)
  } catch (error) {
    if (error.code === 'not_approved')
      return res
        .status(409)
        .json({ error: { code: error.code, message: error.message } })
    next(error)
  }
})
