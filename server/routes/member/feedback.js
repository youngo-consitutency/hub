// Feedback tickets: any signed-in account can report, the Hub team triages.
//
// Deliberately not behind requireVerified — a member stuck on the membership
// course is exactly the person who needs to tell the team they are blocked.
import { Router } from 'express'
import { requireAccount } from './guards.js'
import { recordAudit } from '../../lib/audit.js'
import {
  FEEDBACK_KINDS,
  FEEDBACK_SEVERITIES,
  FEEDBACK_STATUSES,
  attachGithubIssue,
  createTicket,
  listMyTickets,
  listTickets,
  normalizeTicketInput,
  updateTicket,
} from '../../lib/feedback.js'
import { createGithubIssue } from '../../lib/githubIssues.js'
import { createRateLimiter } from '../../lib/rateLimit.js'

export const router = Router()

const submitLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 })

function canTriage(account) {
  return (
    account.role === 'admin' ||
    account.access?.teamRoles?.includes('membership_team')
  )
}

router.get('/feedback/options', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  res.json({
    kinds: FEEDBACK_KINDS,
    severities: FEEDBACK_SEVERITIES,
    canTriage: canTriage(account),
  })
})

router.get('/feedback/mine', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  res.json({ items: await listMyTickets(account.id) })
})

router.post('/feedback', submitLimit, async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  let input
  try {
    input = normalizeTicketInput(req.body)
  } catch (error) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: error.message } })
  }
  const ticket = await createTicket(input, account.id)
  await recordAudit({
    actorId: account.id,
    action: 'feedback.submitted',
    targetType: 'feedback_ticket',
    targetId: ticket.id,
    after: { kind: ticket.kind, severity: ticket.severity },
    requestId: req.requestId,
  })
  // Mirroring is best-effort; the ticket is already saved either way.
  const issueUrl = await createGithubIssue(ticket, account)
  if (issueUrl) await attachGithubIssue(ticket.id, issueUrl)
  res.status(201).json({ item: { ...ticket, githubIssueUrl: issueUrl } })
})

router.get('/feedback', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!canTriage(account)) {
    return res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Feedback triage is for admins and the Membership Team.',
      },
    })
  }
  res.json({
    items: await listTickets({
      status: req.query.status,
      kind: req.query.kind,
      limit: req.query.limit,
    }),
    statuses: FEEDBACK_STATUSES,
    kinds: FEEDBACK_KINDS,
  })
})

router.patch('/feedback/:id', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!canTriage(account)) {
    return res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Feedback triage is for admins and the Membership Team.',
      },
    })
  }
  let item
  try {
    item = await updateTicket(req.params.id, {
      status: req.body?.status,
      triageNote: req.body?.triageNote,
    })
  } catch (error) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: error.message } })
  }
  if (!item) {
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Ticket not found.' } })
  }
  await recordAudit({
    actorId: account.id,
    action: 'feedback.triaged',
    targetType: 'feedback_ticket',
    targetId: item.id,
    after: { status: item.status },
    requestId: req.requestId,
  })
  res.json({ item })
})
