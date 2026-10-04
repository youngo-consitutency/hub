import type { Endpoint, PayloadRequest } from 'payload'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import { requireTeam } from '../lib/accounts'
import { audit } from '../lib/audit'
import * as store from '../lib/content'
import { contributionsFromCsv, previewCsvImport, synthesizeGysContributions } from '../lib/gys.js'
import type { Doc, AnyValue } from '../lib/domain'
import type { GysTrackedContribution } from '../payload-types'

const GYS_STATUSES = [
  'submitted',
  'triaged',
  'drafting',
  'needs_review',
  'approved',
  'rejected',
  'published',
]
const GYS_TRANSITIONS: Record<string, string[]> = {
  submitted: ['triaged', 'rejected'],
  triaged: ['drafting', 'rejected'],
  drafting: ['needs_review'],
  needs_review: ['drafting', 'approved', 'rejected'],
  approved: ['published', 'drafting'],
  rejected: ['triaged'],
  published: [],
}

const publicCycleView = (row: Doc) =>
  row
    ? {
        id: row.id,
        code: row.code,
        title: row.title,
        year: row.year,
        status: row.status,
        opensAt: row.opensAt || null,
        closesAt: row.closesAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    : null

const publicContributionView = (row: Doc) => ({
  id: row.id,
  cycleId: typeof row.cycle === 'object' ? row.cycle?.id : row.cycle,
  title: row.title,
  body: row.body,
  theme: row.theme || null,
  region: row.region || null,
  country: row.country || null,
  submitterType: row.submitterType || null,
  organization: row.organization || null,
  source: row.source || 'manual',
  externalId: row.externalId || null,
  authorId: typeof row.author === 'object' ? row.author?.id : row.author,
  reviewerId: typeof row.reviewer === 'object' ? row.reviewer?.id : row.reviewer,
  status: row.status,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

async function getGysWorkflow(req: PayloadRequest): Promise<{
  cycle: NonNullable<ReturnType<typeof publicCycleView>>
  contributions: Doc[]
  statuses: string[]
  synthesis: AnyValue
}> {
  let { docs } = await req.payload.find({
    collection: 'gys-workflow-cycles',
    where: { status: { not_equals: 'archived' } },
    sort: '-year,-createdAt',
    limit: 1,
    overrideAccess: true,
  })
  if (!docs[0]) {
    const year = new Date().getFullYear()
    const created = await req.payload.create({
      collection: 'gys-workflow-cycles',
      data: {
        code: `gys-${year}`,
        title: `Global Youth Statement ${year}`,
        year,
        status: 'intake',
      },
      overrideAccess: true,
      req,
    })
    docs = [created]
  }
  const cycle = docs[0] as Doc
  const { docs: contributions } = await req.payload.find({
    collection: 'gys-tracked-contributions',
    where: { cycle: { equals: cycle.id } },
    sort: '-updatedAt',
    limit: 1000,
    overrideAccess: true,
    depth: 1,
  })
  const items = (contributions as Doc[]).map(publicContributionView)
  return {
    cycle: publicCycleView(cycle)!,
    contributions: items,
    statuses: GYS_STATUSES,
    synthesis: synthesizeGysContributions(items),
  }
}

export const gysEndpoints: Endpoint[] = [
  // ── GYS policy team ───────────────────────────────────────────────
  {
    path: '/member/team/gys/overview',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireTeam(req, 'gys_policy_team')
      const gys = await store.getGys(req)
      const workflow = await getGysWorkflow(req)
      return json({
        current: workflow.cycle || gys?.current || null,
        process: gys?.process || [],
        contributions: workflow.contributions,
        statuses: workflow.statuses,
        synthesis: workflow.synthesis,
        formUrl: gys?.current?.inputsUrl || null,
        submissions: await store.listSubmissions(req, 'open'),
        decisions: await store.listDecisions(req, 'active', true),
      })
    }),
  },
  {
    path: '/member/team/gys/inputs/preview',
    method: 'post',
    handler: endpoint(async (req) => {
      await requireTeam(req, 'gys_policy_team')
      const b = await readBody(req)
      const preview = previewCsvImport(b.csvText, b.columnMap)
      if (!preview.ok) throw fail.validation({ csvText: preview.error || 'Invalid CSV.' })
      return json(preview)
    }),
  },
  {
    path: '/member/team/gys/inputs/import',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'gys_policy_team')
      const b = await readBody(req)
      const workflow = await getGysWorkflow(req)
      let parsed: AnyValue
      try {
        parsed = contributionsFromCsv(b.csvText, b.columnMap)
      } catch (err: AnyValue) {
        throw fail.validation({ csvText: err.message })
      }
      const imported: Doc[] = []
      const errors: Doc[] = []
      let skipped = 0
      for (const item of parsed.contributions) {
        if (item.externalId) {
          const dup = await req.payload.find({
            collection: 'gys-tracked-contributions',
            where: {
              cycle: { equals: workflow.cycle.id },
              externalId: { equals: item.externalId },
            },
            limit: 1,
            overrideAccess: true,
          })
          if (dup.totalDocs) {
            skipped += 1
            continue
          }
        }
        try {
          imported.push(
            await req.payload.create({
              collection: 'gys-tracked-contributions',
              data: {
                cycle: workflow.cycle.id,
                ...item,
                author: staff.id,
                status: 'submitted',
              },
              overrideAccess: true,
              req,
            }),
          )
        } catch (err: AnyValue) {
          errors.push({ externalId: item.externalId, error: err.message })
        }
      }
      await audit(req, staff, {
        action: 'gys.inputs_imported',
        targetType: 'gys_cycle',
        targetId: String(workflow.cycle.id),
        after: {
          imported: imported.length,
          skipped,
          errors: errors.length,
        },
      })
      return json(
        { imported: imported.length, skipped, errors, contributions: imported },
        { status: 201 },
      )
    }),
  },
  {
    path: '/member/team/gys/cycle',
    method: 'patch',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'gys_policy_team')
      const b = await readBody(req)
      const allowed = [
        'planning',
        'intake',
        'synthesis',
        'review',
        'consultation',
        'approved',
        'published',
        'archived',
      ]
      if (!allowed.includes(b.status)) throw fail.validation({ status: 'Invalid cycle status.' })
      const workflow = await getGysWorkflow(req)
      const updated = await req.payload.update({
        collection: 'gys-workflow-cycles',
        id: workflow.cycle.id,
        data: { status: b.status },
        overrideAccess: true,
        req,
      })
      await audit(req, staff, {
        action: 'gys.cycle_update',
        targetType: 'gys_cycle',
        targetId: String(updated.id),
        after: { status: b.status },
      })
      return json({ cycle: publicCycleView(updated) })
    }),
  },
  {
    path: '/member/team/gys/contributions',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'gys_policy_team')
      const b = await readBody(req)
      if (!String(b.title || '').trim() || !String(b.body || '').trim())
        throw fail.validation({
          title: 'Title and contribution text are required.',
        })
      const workflow = await getGysWorkflow(req)
      const created = await req.payload.create({
        collection: 'gys-tracked-contributions',
        data: {
          cycle: workflow.cycle.id,
          title: String(b.title).trim().slice(0, 240),
          body: String(b.body).trim().slice(0, 20000),
          theme:
            String(b.theme || '')
              .trim()
              .slice(0, 160) || null,
          region:
            String(b.region || '')
              .trim()
              .slice(0, 120) || null,
          country:
            String(b.country || '')
              .trim()
              .slice(0, 120) || null,
          submitterType:
            String(b.submitterType || '')
              .trim()
              .slice(0, 60) || null,
          organization:
            String(b.organization || '')
              .trim()
              .slice(0, 200) || null,
          source: String(b.source || 'manual').slice(0, 60),
          externalId: b.externalId ? String(b.externalId).slice(0, 200) : null,
          rawAnswers: b.rawAnswers || null,
          author: staff.id,
          status: 'submitted',
          version: 1,
        },
        overrideAccess: true,
        req,
      })
      await audit(req, staff, {
        action: 'gys.contribution_add',
        targetType: 'gys_contribution',
        targetId: String(created.id),
      })
      return json({ item: publicContributionView(created) }, { status: 201 })
    }),
  },
  {
    path: '/member/team/gys/contributions/:id',
    method: 'patch',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'gys_policy_team')
      const b = await readBody(req)
      const row = (await req.payload.findByID({
        collection: 'gys-tracked-contributions',
        id: param(req, 'id'),
        overrideAccess: true,
        req,
      })) as Doc
      if (!row) throw fail.notFound()
      const status = String(b.status || '')
      if (!GYS_STATUSES.includes(status))
        throw fail.validation({ status: 'Invalid contribution status.' })
      if (status !== row.status && !(GYS_TRANSITIONS[row.status] || []).includes(status))
        throw fail.validation({
          status: `Cannot move from ${row.status} to ${status}.`,
        })
      const updated = await req.payload.update({
        collection: 'gys-tracked-contributions',
        id: row.id,
        data: {
          status: status as GysTrackedContribution['status'],
          reviewer: staff.id,
          version: (row.version || 1) + (status !== row.status ? 1 : 0),
        },
        overrideAccess: true,
        req,
      })
      await audit(req, staff, {
        action: 'gys.contribution_update',
        targetType: 'gys_contribution',
        targetId: String(row.id),
        before: { status: row.status },
        after: { status },
      })
      return json({ item: publicContributionView(updated) })
    }),
  },
]
