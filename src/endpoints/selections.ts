import type { Endpoint, PayloadRequest } from 'payload'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import { requireCwMember, requireVerifiedMember } from '../lib/accounts'
import { audit } from '../lib/audit'
import { accountRef, isSelector, loadSelection } from '../lib/governance'

// S24 selections.

const selectionView = (s: any, extra?: any) => ({
  id: s.id,
  title: s.title,
  opportunityNote: s.opportunityNote,
  kind: s.kind,
  bodyRef: s.bodyRef,
  status: s.status,
  method: s.method,
  criteria: (s.criteria ?? []).map((c: any) => ({ name: c.name, weightPct: c.weightPct })),
  deadlineAt: s.deadlineAt,
  spotsAvailable: s.spotsAvailable,
  selectionSummary: s.selectionSummary,
  createdBy: accountRef(s.createdBy),
  ...(extra ?? {}),
})

async function committeeMember(req: PayloadRequest, selectionId: number, accountId: number) {
  const { docs } = await req.payload.find({
    collection: 'selection-committee',
    where: {
      and: [{ selection: { equals: selectionId } }, { account: { equals: accountId } }],
    },
    limit: 1,
    overrideAccess: true,
  })
  return docs[0] as any
}

// Recording a selection stage belongs to the Selections Team (S24) —
// no account attribute grants selection authority on its own.
async function canAdminister(req: PayloadRequest, s: any, account: any) {
  const creator = (s.createdBy as any)?.id ?? s.createdBy
  return creator === account.id || (await isSelector(req, account))
}

const COLOUR_SCORES: Record<string, number> = {
  black: -500,
  red: -100,
  orange: -10,
  yellow: 5,
  green: 10,
}

export const selectionEndpoints: Endpoint[] = [
  {
    path: '/governance/selections',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'selections',
        sort: '-createdAt',
        limit: 50,
        overrideAccess: true,
      })
      return json({ items: (docs as any[]).map((s) => selectionView(s)) })
    }),
  },
  {
    path: '/governance/selections',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await isSelector(req, account)))
        throw fail.forbidden('Selections are created by the selection/coordination team.')
      const b = await readBody(req)
      const fields: Record<string, string> = {}
      if (!b.title?.trim()) fields.title = 'Required.'
      if (!b.opportunityNote?.trim()) fields.opportunityNote = 'Required.'
      if (!['colour', 'numerical'].includes(b.method))
        fields.method = 'Must be colour or numerical.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const sel = await req.payload.create({
        collection: 'selections',
        data: {
          title: b.title.trim(),
          opportunityNote: b.opportunityNote.trim(),
          kind: b.kind === 'wg_nomination' ? 'wg_nomination' : 'standard',
          bodyRef: b.bodyRef?.trim() || null,
          status: 'committee_forming',
          method: b.method,
          criteria: (b.criteria ?? []).map((c: any) => ({
            name: String(c.name).trim(),
            weightPct: Number(c.weightPct),
          })),
          deadlineAt: b.deadlineAt ?? null,
          spotsAvailable: b.spotsAvailable ?? 1,
          createdBy: account.id,
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'selection.created',
        targetType: 'governance',
        targetId: String(sel.id),
      })
      return json({ selection: selectionView(sel) }, { status: 201 })
    }),
  },
  {
    path: '/governance/selections/:id',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, param(req, 'id'))
      const { totalDocs: committeeCount } = await req.payload.find({
        collection: 'selection-committee',
        where: { selection: { equals: s.id } },
        limit: 0,
        overrideAccess: true,
      })
      const { totalDocs: applicationCount } = await req.payload.find({
        collection: 'selection-applications',
        where: { selection: { equals: s.id } },
        limit: 0,
        overrideAccess: true,
      })
      const mine = await committeeMember(req, s.id, account.id)
      return json({
        selection: selectionView(s, { committeeCount, applicationCount }),
        myCommitteeRole: mine ? 'member' : null,
      })
    }),
  },
  {
    path: '/governance/selections/:id/committee',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const s = await loadSelection(req, param(req, 'id'))
      if (!['committee_forming', 'open'].includes(s.status))
        throw fail.conflict('invalid_phase', 'The committee can no longer be joined.')
      const existing = await committeeMember(req, s.id, account.id)
      if (existing) throw fail.conflict('already_joined', 'Already on the committee.')
      const member = await req.payload.create({
        collection: 'selection-committee',
        data: {
          selection: s.id,
          account: account.id,
          joinedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'selection.committee_joined',
        targetType: 'governance',
        targetId: String(s.id),
      })
      return json({ member }, { status: 201 })
    }),
  },
  {
    path: '/governance/selections/:id/open',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, param(req, 'id'))
      if (!(await canAdminister(req, s, account)))
        throw fail.forbidden('The Selections Team may open applications.')
      if (s.status !== 'committee_forming') throw fail.conflict('invalid_phase', 'Already opened.')
      // S24 §2.2.1: committee needs a minimum of 3 members.
      const { totalDocs: committeeCount } = await req.payload.find({
        collection: 'selection-committee',
        where: { selection: { equals: s.id } },
        limit: 0,
        overrideAccess: true,
      })
      if (committeeCount < 3)
        throw fail.conflict(
          'committee_too_small',
          `A selection committee needs at least 3 members (currently ${committeeCount}).`,
        )
      const updated = await req.payload.update({
        collection: 'selections',
        id: s.id,
        data: {
          status: 'open',
          deadlineAt: s.deadlineAt ?? new Date(Date.now() + 7 * 86400000).toISOString(),
        },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'selection.opened',
        targetType: 'governance',
        targetId: String(s.id),
      })
      return json({ selection: selectionView(updated) })
    }),
  },
  {
    path: '/governance/selections/:id/apply',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const s = await loadSelection(req, param(req, 'id'))
      if (s.status !== 'open') throw fail.conflict('invalid_phase', 'Applications are not open.')
      const b = await readBody(req)
      if (!b.answers || typeof b.answers !== 'object')
        throw fail.validation({ answers: 'Required.' })
      const { totalDocs: existing } = await req.payload.find({
        collection: 'selection-applications',
        where: {
          and: [{ selection: { equals: s.id } }, { account: { equals: account.id } }],
        },
        limit: 0,
        overrideAccess: true,
      })
      if (existing > 0) throw fail.conflict('already_applied', 'One application per member.')
      const app = await req.payload.create({
        collection: 'selection-applications',
        data: {
          selection: s.id,
          account: account.id,
          answers: b.answers,
          selfFinance: Boolean(b.selfFinance),
          gender: b.gender?.trim() || null,
          region: b.region?.trim() || null,
          status: 'submitted',
          submittedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'selection.applied',
        targetType: 'governance',
        targetId: String(s.id),
      })
      return json({ application: { id: app.id, status: app.status } }, { status: 201 })
    }),
  },
  {
    path: '/governance/selections/:id/recuse',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const s = await loadSelection(req, param(req, 'id'))
      const member = await committeeMember(req, s.id, account.id)
      if (!member) throw fail.forbidden('Only committee members may declare recusals.')
      const b = await readBody(req)
      if (!Array.isArray(b.applicantIds) || !b.applicantIds.length)
        throw fail.validation({ applicantIds: 'List the application ids you are conflicted on.' })
      const updated = await req.payload.update({
        collection: 'selection-committee',
        id: member.id,
        data: {
          recusedApplicantIds: b.applicantIds.map(Number),
          coiNote: b.coiNote?.trim() || null,
        },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'selection.recusal_declared',
        targetType: 'governance',
        targetId: String(s.id),
      })
      return json({ member: updated })
    }),
  },
  {
    path: '/governance/selections/:id/close',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, param(req, 'id'))
      if (!(await canAdminister(req, s, account)))
        throw fail.forbidden('The Selections Team may close applications.')
      if (s.status !== 'open')
        throw fail.conflict('invalid_phase', `Cannot close while status is ${s.status}.`)
      const updated = await req.payload.update({
        collection: 'selections',
        id: s.id,
        data: { status: 'evaluating' },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'selection.closed',
        targetType: 'governance',
        targetId: String(s.id),
      })
      return json({ selection: selectionView(updated) })
    }),
  },
  {
    path: '/governance/selections/:id/applications/:aid/evaluate',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const s = await loadSelection(req, param(req, 'id'))
      if (s.status !== 'evaluating')
        throw fail.conflict('invalid_phase', 'Evaluations open once applications close.')
      const member = await committeeMember(req, s.id, account.id)
      if (!member) throw fail.forbidden('Only committee members may evaluate.')
      const applicationId = Number(param(req, 'aid'))
      // Recusal check (S24 §2.2.4): conflicted members may not evaluate.
      const recused = (member.recusedApplicantIds ?? []).map(Number)
      if (recused.includes(applicationId))
        throw fail.conflict(
          'conflict_of_interest',
          'You declared a conflict of interest on this application.',
        )
      const b = await readBody(req)
      const data: any = {
        selection: s.id,
        application: applicationId,
        evaluator: account.id,
        comment: b.comment?.trim() || null,
        evaluatedAt: new Date().toISOString(),
      }
      if (s.method === 'colour') {
        if (!COLOUR_SCORES[b.grade])
          throw fail.validation({ grade: 'Must be black, red, orange, yellow or green.' })
        data.grade = b.grade
      } else {
        if (!b.scores || typeof b.scores !== 'object')
          throw fail.validation({ scores: 'Per-criterion scores (0-10) are required.' })
        for (const [k, v] of Object.entries(b.scores)) {
          const n = Number(v)
          if (!Number.isFinite(n) || n < 0 || n > 10)
            throw fail.validation({ scores: `Score for "${k}" must be 0-10.` })
        }
        data.scores = b.scores
      }
      // One evaluation per evaluator per application (upsert).
      const { docs: existing } = await req.payload.find({
        collection: 'selection-evaluations',
        where: {
          and: [
            { selection: { equals: s.id } },
            { application: { equals: applicationId } },
            { evaluator: { equals: account.id } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })
      const evalRecord = existing.length
        ? await req.payload.update({
            collection: 'selection-evaluations',
            id: existing[0].id,
            data,
            overrideAccess: true,
          })
        : await req.payload.create({
            collection: 'selection-evaluations',
            data,
            overrideAccess: true,
          })
      await audit(req, account, {
        action: 'selection.evaluated',
        targetType: 'governance',
        targetId: String(s.id),
      })
      return json({ evaluation: evalRecord })
    }),
  },
  {
    path: '/governance/selections/:id/decide',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, param(req, 'id'))
      if (!(await canAdminister(req, s, account)))
        throw fail.forbidden('The Selections Team may record the final decision.')
      if (s.status !== 'evaluating')
        throw fail.conflict('invalid_phase', 'Evaluations must finish before deciding.')
      const b = await readBody(req)
      if (!Array.isArray(b.selectedApplicationIds))
        throw fail.validation({ selectedApplicationIds: 'Required.' })
      if (b.selectedApplicationIds.length > (s.spotsAvailable ?? 1))
        throw fail.validation({
          selectedApplicationIds: `Only ${s.spotsAvailable} spot(s) available.`,
        })
      // mark selected/not_selected
      const { docs: apps } = await req.payload.find({
        collection: 'selection-applications',
        where: { selection: { equals: s.id } },
        limit: 1000,
        overrideAccess: true,
      })
      const selected = new Set(b.selectedApplicationIds.map(Number))
      for (const app of apps as any[]) {
        await req.payload.update({
          collection: 'selection-applications',
          id: app.id,
          data: { status: selected.has(app.id) ? 'selected' : 'not_selected' },
          overrideAccess: true,
        })
      }
      const updated = await req.payload.update({
        collection: 'selections',
        id: s.id,
        data: {
          status: 'decided',
          selectionSummary: b.selectionSummary?.trim() || null,
        },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'selection.decided',
        targetType: 'governance',
        targetId: String(s.id),
      })
      return json({ selection: selectionView(updated) })
    }),
  },
  {
    path: '/governance/selections/:id/announce',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, param(req, 'id'))
      if (!(await canAdminister(req, s, account)))
        throw fail.forbidden('The Selections Team may announce the outcome.')
      if (s.status !== 'decided') throw fail.conflict('invalid_phase', 'Record the decision first.')
      const { docs: apps } = await req.payload.find({
        collection: 'selection-applications',
        where: {
          and: [{ selection: { equals: s.id } }, { status: { equals: 'selected' } }],
        },
        limit: 50,
        overrideAccess: true,
      })
      const updated = await req.payload.update({
        collection: 'selections',
        id: s.id,
        data: { status: 'announced' },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'selection.announced',
        targetType: 'governance',
        targetId: String(s.id),
      })
      return json({
        selection: selectionView(updated),
        selected: (apps as any[]).map((a) => ({
          id: a.id,
          account: accountRef(a.account),
        })),
      })
    }),
  },
]
