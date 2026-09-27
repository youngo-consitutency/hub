import crypto from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import { requireAccount } from '../lib/accounts'
import { getAccessProfile } from '../lib/access'
import { tallyIrv } from '../lib/decisions'

// S10 elections + S24 selections. Secret ballots are keyed by voter
// credentials (HMAC'd tokens) and never reference an account — server-trust
// secrecy. Facilitators are admins or members carrying the
// `election_facilitation` / `selection_team` assignment (team scope).

const VERIFIED_ROLES = new Set(['admin', 'focal_point'])

function requireVerifiedMember(req: PayloadRequest) {
  const account = requireAccount(req)
  const ok =
    account?.hubAccessStatus === 'active' &&
    (account?.memberStatus === 'verified' || VERIFIED_ROLES.has(account?.role))
  if (!ok)
    throw new ApiError(403, 'not_verified', 'Complete onboarding and verification first.')
  return account
}

function requireCwMember(req: PayloadRequest) {
  const account = requireVerifiedMember(req)
  if (
    account.membershipTrack !== 'constituency_work' &&
    !VERIFIED_ROLES.has(account.role)
  )
    throw new ApiError(403, 'not_constituency_work', 'Constituency Work membership required (S17 §1.1).')
  return account
}

async function isFacilitator(req: PayloadRequest, account: any) {
  if (account.role === 'admin') return true
  const access = await getAccessProfile(req, account)
  return access.teamRoles.some((r) =>
    ['election_facilitation', 'bottomlining', 'blt'].includes(r),
  )
}

async function isSelector(req: PayloadRequest, account: any) {
  if (VERIFIED_ROLES.has(account.role)) return true
  const access = await getAccessProfile(req, account)
  return access.teamRoles.some((r) =>
    ['selection_team', 'gct', 'election_facilitation'].includes(r),
  )
}

const accountRef = (a: any) =>
  a == null
    ? null
    : { id: typeof a === 'object' ? a.id : a, name: typeof a === 'object' ? a.name : undefined }

const tokenHash = (electionId: number | string, token: string) =>
  crypto
    .createHmac('sha256', process.env.PAYLOAD_SECRET || 'dev')
    .update(`${electionId}:${token}`)
    .digest('hex')

async function loadElection(req: PayloadRequest, id: string | number) {
  return req.payload
    .findByID({ collection: 'elections', id: Number(id), overrideAccess: true })
    .catch(() => { throw fail.notFound('Election not found.') })
}

async function loadSelection(req: PayloadRequest, id: string | number) {
  return req.payload
    .findByID({ collection: 'selections', id: Number(id), overrideAccess: true })
    .catch(() => { throw fail.notFound('Selection not found.') })
}

async function audit(req: PayloadRequest, account: any, action: string, targetId: string) {
  await req.payload.create({
    collection: 'audit-log',
    data: {
      actor: account?.id ?? null,
      actorEmail: account?.email ?? null,
      action,
      targetType: 'governance',
      targetId,
    } as any,
    overrideAccess: true,
  })
}

const candidateView = (c: any) => ({
  id: c.id,
  race: c.race,
  account: accountRef(c.account),
  statement: c.statement,
  videoUrl: c.videoUrl,
  status: c.status,
  nominatedAt: c.nominatedAt,
})

const electionView = (e: any, extra?: any) => ({
  id: e.id,
  title: e.title,
  kind: e.kind,
  status: e.status,
  description: e.description,
  races: (e.races ?? []).map((r: any) => ({ slug: r.slug, label: r.label })),
  nominationsOpenAt: e.nominationsOpenAt,
  nominationsCloseAt: e.nominationsCloseAt,
  votingOpensAt: e.votingOpensAt,
  votingCloseAt: e.votingCloseAt,
  quorumIndividuals: e.quorumIndividuals,
  quorumOrganisations: e.quorumOrganisations,
  result: e.status === 'completed' || e.status === 'restart_required' ? e.result : null,
  ...(extra ?? {}),
})

export const electionEndpoints: Endpoint[] = [
  {
    path: '/governance/elections',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'elections',
        sort: '-createdAt',
        limit: 50,
        overrideAccess: true,
      })
      return json({ items: (docs as any[]).map((e) => electionView(e)) })
    }),
  },
  {
    path: '/governance/elections',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await isFacilitator(req, account)))
        throw fail.forbidden('Only the Election Facilitation Team may create elections.')
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!b.title?.trim()) fields.title = 'Required.'
      if (!Array.isArray(b.races) || !b.races.length)
        fields.races = 'At least one race is required.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const election = await req.payload.create({
        collection: 'elections',
        data: {
          title: b.title.trim(),
          kind: b.kind === 'other' ? 'other' : 'focal_point',
          status: 'announced',
          description: b.description?.trim() || null,
          races: b.races.map((r: any) => ({
            slug: String(r.slug).trim(),
            label: String(r.label ?? r.slug).trim(),
          })),
          quorumIndividuals: b.quorumIndividuals ?? 100,
          quorumOrganisations: b.quorumOrganisations ?? 25,
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, 'election.created', String(election.id))
      return json({ election: electionView(election) }, { status: 201 })
    }),
  },
  {
    path: '/governance/elections/:id',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      const e = await loadElection(req, req.routeParams!.id as string)
      // Candidacies are published simultaneously when voting opens (S10
      // §2.3); before that only counts are exposed.
      const { docs: all } = await req.payload.find({
        collection: 'election-candidates',
        where: {
          and: [
            { election: { equals: e.id } },
            { status: { equals: 'screened_in' } },
          ],
        },
        limit: 500,
        overrideAccess: true,
      })
      const published = ['voting', 'tallying', 'completed', 'restart_required'].includes(
        e.status,
      )
      return json({
        election: electionView(e, {
          candidateCount: all.length,
          candidates: published ? (all as any[]).map(candidateView) : undefined,
        }),
      })
    }),
  },
  {
    path: '/governance/elections/:id/advance',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await isFacilitator(req, account)))
        throw fail.forbidden('Only the Election Facilitation Team may advance phases.')
      const e = await loadElection(req, req.routeParams!.id as string)
      const flow: Record<string, string> = {
        announced: 'nominations',
        nominations: 'voting',
        voting: 'tallying',
        restart_required: 'nominations',
      }
      const next = flow[e.status]
      if (!next)
        throw fail.conflict('invalid_phase', `Cannot advance from ${e.status}.`)
      const now = new Date().toISOString()
      const patch: any = { status: next }
      if (next === 'nominations') {
        patch.nominationsOpenAt = now
        patch.nominationsCloseAt = new Date(Date.now() + 7 * 86400000).toISOString()
      }
      if (next === 'voting') {
        patch.nominationsCloseAt = e.nominationsCloseAt ?? now
        patch.votingOpensAt = now
        patch.votingCloseAt = new Date(Date.now() + 5 * 86400000).toISOString()
        // Snapshot the eligible registry for quorum reporting (S10 §3.4).
        const ind = await req.payload.find({
          collection: 'election-voters',
          where: {
            and: [
              { election: { equals: e.id } },
              { kind: { equals: 'individual' } },
            ],
          },
          limit: 0,
          overrideAccess: true,
        })
        const org = await req.payload.find({
          collection: 'election-voters',
          where: {
            and: [
              { election: { equals: e.id } },
              { kind: { equals: 'organisation' } },
            ],
          },
          limit: 0,
          overrideAccess: true,
        })
        patch.eligibleIndividualCount = ind.totalDocs
        patch.eligibleOrgCount = org.totalDocs
      }
      const updated = await req.payload.update({
        collection: 'elections',
        id: e.id,
        data: patch,
        overrideAccess: true,
      })
      await audit(req, account, `election.${next}`, String(e.id))
      return json({ election: electionView(updated) })
    }),
  },
  {
    path: '/governance/elections/:id/candidates',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const e = await loadElection(req, req.routeParams!.id as string)
      if (e.status !== 'nominations')
        throw fail.conflict('invalid_phase', 'Nominations are not open.')
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      const raceSlugs = (e.races ?? []).map((r: any) => r.slug)
      if (!raceSlugs.includes(b.race)) fields.race = `Must be one of: ${raceSlugs.join(', ')}.`
      if (!b.statement?.trim()) fields.statement = 'A statement of motivation is required.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const existing = await req.payload.find({
        collection: 'election-candidates',
        where: {
          and: [
            { election: { equals: e.id } },
            { account: { equals: account.id } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.totalDocs)
        throw fail.conflict('already_nominated', 'You have already submitted a candidacy.')
      const candidate = await req.payload.create({
        collection: 'election-candidates',
        data: {
          election: e.id,
          race: b.race,
          account: account.id,
          statement: b.statement.trim(),
          videoUrl: b.videoUrl?.trim() || null,
          status: 'pending',
          nominatedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, 'election.candidate_nominated', String(e.id))
      return json({ candidate: candidateView(candidate) }, { status: 201 })
    }),
  },
  {
    path: '/governance/elections/:id/candidates/:cid/screen',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await isFacilitator(req, account)))
        throw fail.forbidden('Only the Election Facilitation Team screens candidacies.')
      const e = await loadElection(req, req.routeParams!.id as string)
      const b = (await req.json?.()) ?? ({} as any)
      if (!['screened_in', 'screened_out'].includes(b.status))
        throw fail.validation({ status: 'Must be screened_in or screened_out.' })
      const candidate = await req.payload
        .findByID({
          collection: 'election-candidates',
          id: Number(req.routeParams!.cid),
          overrideAccess: true,
        })
        .catch(() => { throw fail.notFound('Candidate not found.') })
      const updated = await req.payload.update({
        collection: 'election-candidates',
        id: candidate.id,
        data: {
          status: b.status,
          screeningNote: b.screeningNote?.trim() || null,
        },
        overrideAccess: true,
      })
      await audit(req, account, `election.candidate_${b.status}`, String(e.id))
      return json({ candidate: candidateView(updated) })
    }),
  },
  {
    path: '/governance/elections/:id/credential',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const e = await loadElection(req, req.routeParams!.id as string)
      // Credentials may be issued once voting is scheduled (or in advance).
      if (!['nominations', 'voting', 'tallying'].includes(e.status))
        throw fail.conflict('invalid_phase', 'Voter credentials are not yet being issued.')
      const existing = await req.payload.find({
        collection: 'election-voters',
        where: {
          and: [
            { election: { equals: e.id } },
            { account: { equals: account.id } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.totalDocs)
        throw fail.conflict('already_issued', 'A voter credential was already issued to you.')
      const kind =
        account.entityType === 'organization' ? 'organisation' : 'individual'
      const token = crypto.randomBytes(24).toString('base64url')
      await req.payload.create({
        collection: 'election-voters',
        data: {
          election: e.id,
          account: account.id,
          kind,
          tokenHash: tokenHash(e.id, token),
          issuedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await audit(req, account, 'election.credential_issued', String(e.id))
      // The token is returned once and never stored in raw form.
      return json({ token, kind }, { status: 201 })
    }),
  },
  {
    path: '/governance/elections/:id/vote',
    method: 'post',
    handler: endpoint(async (req) => {
      const e = await loadElection(req, req.routeParams!.id as string)
      if (e.status !== 'voting')
        throw fail.conflict('invalid_phase', 'Voting is not open for this election.')
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      const raceSlugs = (e.races ?? []).map((r: any) => r.slug)
      if (!b.token?.trim()) fields.token = 'Required.'
      if (!raceSlugs.includes(b.race)) fields.race = `Must be one of: ${raceSlugs.join(', ')}.`
      if (!Array.isArray(b.ranks)) fields.ranks = 'Must be an array of candidate ids (empty for a blank ballot).'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const hash = tokenHash(e.id, String(b.token).trim())
      const { docs: voters } = await req.payload.find({
        collection: 'election-voters',
        where: {
          and: [
            { election: { equals: e.id } },
            { tokenHash: { equals: hash } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })
      if (!voters.length)
        throw fail.forbidden('Invalid voter credential.')
      const voter = voters[0] as any
      const { totalDocs: cast } = await req.payload.find({
        collection: 'election-ballots',
        where: {
          and: [
            { election: { equals: e.id } },
            { race: { equals: b.race } },
            { voterTokenHash: { equals: hash } },
          ],
        },
        limit: 0,
        overrideAccess: true,
      })
      if (cast > 0)
        throw fail.conflict('already_voted', 'This credential has already voted in that race.')
      // Validate ranked ids against screened candidates in this race.
      const { docs: cands } = await req.payload.find({
        collection: 'election-candidates',
        where: {
          and: [
            { election: { equals: e.id } },
            { race: { equals: b.race } },
            { status: { equals: 'screened_in' } },
          ],
        },
        limit: 500,
        overrideAccess: true,
      })
      const valid = new Set((cands as any[]).map((c) => c.id))
      const ranks = (b.ranks as any[]).map(String).filter(Boolean)
      if (ranks.some((r) => !valid.has(Number(r))))
        throw fail.validation({ ranks: 'Contains an unknown or unscreened candidate id.' })
      if (new Set(ranks).size !== ranks.length)
        throw fail.validation({ ranks: 'Duplicate candidate in ranking.' })
      await req.payload.create({
        collection: 'election-ballots',
        data: {
          election: e.id,
          race: b.race,
          voterTokenHash: hash,
          kind: voter.kind,
          ranks: ranks.map(Number),
          castAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await req.payload.update({
        collection: 'election-voters',
        id: voter.id,
        data: { votedAt: new Date().toISOString() },
        overrideAccess: true,
      })
      return json({ cast: true })
    }),
  },
  {
    path: '/governance/elections/:id/tally',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await isFacilitator(req, account)))
        throw fail.forbidden('Only the Election Facilitation Team may tally.')
      let e = await loadElection(req, req.routeParams!.id as string)
      if (!['voting', 'tallying'].includes(e.status))
        throw fail.conflict('invalid_phase', `Cannot tally while status is ${e.status}.`)
      const { docs: ballots } = await req.payload.find({
        collection: 'election-ballots',
        where: { election: { equals: e.id } },
        limit: 100000,
        overrideAccess: true,
      })
      // Quorum counts distinct voters who participated in the election,
      // not per-race ballots (a voter may vote in several races).
      const indSet = new Set(
        (ballots as any[]).filter((b) => b.kind === 'individual').map((b) => b.voterTokenHash),
      )
      const orgSet = new Set(
        (ballots as any[]).filter((b) => b.kind === 'organisation').map((b) => b.voterTokenHash),
      )
      const ind = indSet.size
      const org = orgSet.size
      const quorumOk =
        ind >= (e.quorumIndividuals ?? 100) &&
        org >= (e.quorumOrganisations ?? 25)
      const result: any = {
        talliedAt: new Date().toISOString(),
        ballotsCast: { individuals: ind, organisations: org },
        quorum: {
          individualsMet: ind >= (e.quorumIndividuals ?? 100),
          organisationsMet: org >= (e.quorumOrganisations ?? 25),
        },
        races: {},
      }
      let anyRestart = false
      for (const race of e.races ?? []) {
        const { docs: cands } = await req.payload.find({
          collection: 'election-candidates',
          where: {
            and: [
              { election: { equals: e.id } },
              { race: { equals: race.slug } },
              { status: { equals: 'screened_in' } },
            ],
          },
          limit: 500,
          overrideAccess: true,
        })
        const raceBallots = (ballots as any[])
          .filter((b) => b.race === race.slug)
          .map((b) => ({ ranks: (b.ranks ?? []).map(String) }))
        const tally = tallyIrv(
          raceBallots,
          (cands as any[]).map((c) => String(c.id)),
        )
        result.races[race.slug] = {
          candidates: (cands as any[]).map((c) => ({
            id: c.id,
            name: accountRef(c.account)?.name,
          })),
          ballots: raceBallots.length,
          ...tally,
        }
        if (tally.outcome === 'restart' || !quorumOk) anyRestart = true
      }
      e = await req.payload.update({
        collection: 'elections',
        id: e.id,
        data: {
          status: anyRestart ? 'restart_required' : 'completed',
          result,
        },
        overrideAccess: true,
      })
      await audit(req, account, `election.${e.status}`, String(e.id))
      return json({ election: electionView(e) })
    }),
  },
]

// ── Selections (S24) ──────────────────────────────────────────────────────

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
      and: [
        { selection: { equals: selectionId } },
        { account: { equals: accountId } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  return docs[0] as any
}

const COLOUR_SCORES: Record<string, number> = {
  black: -500, red: -100, orange: -10, yellow: 5, green: 10,
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
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!b.title?.trim()) fields.title = 'Required.'
      if (!b.opportunityNote?.trim()) fields.opportunityNote = 'Required.'
      if (!['colour', 'numerical'].includes(b.method)) fields.method = 'Must be colour or numerical.'
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
      await audit(req, account, 'selection.created', String(sel.id))
      return json({ selection: selectionView(sel) }, { status: 201 })
    }),
  },
  {
    path: '/governance/selections/:id',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, req.routeParams!.id as string)
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
      const s = await loadSelection(req, req.routeParams!.id as string)
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
      await audit(req, account, 'selection.committee_joined', String(s.id))
      return json({ member }, { status: 201 })
    }),
  },
  {
    path: '/governance/selections/:id/open',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, req.routeParams!.id as string)
      const creator = (s.createdBy as any)?.id ?? s.createdBy
      if (account.role !== 'admin' && creator !== account.id)
        throw fail.forbidden('Only the creator may open applications.')
      if (s.status !== 'committee_forming')
        throw fail.conflict('invalid_phase', 'Already opened.')
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
          deadlineAt:
            s.deadlineAt ?? new Date(Date.now() + 7 * 86400000).toISOString(),
        },
        overrideAccess: true,
      })
      await audit(req, account, 'selection.opened', String(s.id))
      return json({ selection: selectionView(updated) })
    }),
  },
  {
    path: '/governance/selections/:id/apply',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const s = await loadSelection(req, req.routeParams!.id as string)
      if (s.status !== 'open')
        throw fail.conflict('invalid_phase', 'Applications are not open.')
      const b = (await req.json?.()) ?? ({} as any)
      if (!b.answers || typeof b.answers !== 'object')
        throw fail.validation({ answers: 'Required.' })
      const { totalDocs: existing } = await req.payload.find({
        collection: 'selection-applications',
        where: {
          and: [
            { selection: { equals: s.id } },
            { account: { equals: account.id } },
          ],
        },
        limit: 0,
        overrideAccess: true,
      })
      if (existing > 0)
        throw fail.conflict('already_applied', 'One application per member.')
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
      await audit(req, account, 'selection.applied', String(s.id))
      return json({ application: { id: app.id, status: app.status } }, { status: 201 })
    }),
  },
  {
    path: '/governance/selections/:id/recuse',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const s = await loadSelection(req, req.routeParams!.id as string)
      const member = await committeeMember(req, s.id, account.id)
      if (!member) throw fail.forbidden('Only committee members may declare recusals.')
      const b = (await req.json?.()) ?? ({} as any)
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
      await audit(req, account, 'selection.recusal_declared', String(s.id))
      return json({ member: updated })
    }),
  },
  {
    path: '/governance/selections/:id/close',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, req.routeParams!.id as string)
      const creator = (s.createdBy as any)?.id ?? s.createdBy
      if (account.role !== 'admin' && creator !== account.id)
        throw fail.forbidden('Only the creator may close applications.')
      if (s.status !== 'open')
        throw fail.conflict('invalid_phase', `Cannot close while status is ${s.status}.`)
      const updated = await req.payload.update({
        collection: 'selections',
        id: s.id,
        data: { status: 'evaluating' },
        overrideAccess: true,
      })
      await audit(req, account, 'selection.closed', String(s.id))
      return json({ selection: selectionView(updated) })
    }),
  },
  {
    path: '/governance/selections/:id/applications/:aid/evaluate',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const s = await loadSelection(req, req.routeParams!.id as string)
      if (s.status !== 'evaluating')
        throw fail.conflict('invalid_phase', 'Evaluations open once applications close.')
      const member = await committeeMember(req, s.id, account.id)
      if (!member) throw fail.forbidden('Only committee members may evaluate.')
      const applicationId = Number(req.routeParams!.aid)
      // Recusal check (S24 §2.2.4): conflicted members may not evaluate.
      const recused = (member.recusedApplicantIds ?? []).map(Number)
      if (recused.includes(applicationId))
        throw fail.conflict(
          'conflict_of_interest',
          'You declared a conflict of interest on this application.',
        )
      const b = (await req.json?.()) ?? ({} as any)
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
      await audit(req, account, 'selection.evaluated', String(s.id))
      return json({ evaluation: evalRecord })
    }),
  },
  {
    path: '/governance/selections/:id/decide',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, req.routeParams!.id as string)
      const creator = (s.createdBy as any)?.id ?? s.createdBy
      if (account.role !== 'admin' && creator !== account.id)
        throw fail.forbidden('Only the creator may record the final decision.')
      if (s.status !== 'evaluating')
        throw fail.conflict('invalid_phase', 'Evaluations must finish before deciding.')
      const b = (await req.json?.()) ?? ({} as any)
      if (!Array.isArray(b.selectedApplicationIds))
        throw fail.validation({ selectedApplicationIds: 'Required.' })
      if (b.selectedApplicationIds.length > (s.spotsAvailable ?? 1))
        throw fail.validation({ selectedApplicationIds: `Only ${s.spotsAvailable} spot(s) available.` })
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
      await audit(req, account, 'selection.decided', String(s.id))
      return json({ selection: selectionView(updated) })
    }),
  },
  {
    path: '/governance/selections/:id/announce',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const s = await loadSelection(req, req.routeParams!.id as string)
      const creator = (s.createdBy as any)?.id ?? s.createdBy
      if (account.role !== 'admin' && creator !== account.id)
        throw fail.forbidden('Only the creator may announce the outcome.')
      if (s.status !== 'decided')
        throw fail.conflict('invalid_phase', 'Record the decision first.')
      const { docs: apps } = await req.payload.find({
        collection: 'selection-applications',
        where: {
          and: [
            { selection: { equals: s.id } },
            { status: { equals: 'selected' } },
          ],
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
      await audit(req, account, 'selection.announced', String(s.id))
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
