import crypto from 'node:crypto'
import type { Endpoint } from 'payload'
import { endpoint, fail, json } from '../lib/respond'
import { requireCwMember, requireVerifiedMember } from '../lib/accounts'
import { isUniqueViolation } from '../lib/pg'
import { tallyIrv } from '../lib/decisions'
import { audit } from '../lib/audit'
import { accountRef, isFacilitator, loadElection, tokenHash } from '../lib/governance'

// S10 elections. See lib/governance.ts for shared helpers and the
// credential-secrecy model.

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
      await audit(req, account, {
        action: 'election.created',
        targetType: 'governance',
        targetId: String(election.id),
      })
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
          and: [{ election: { equals: e.id } }, { status: { equals: 'screened_in' } }],
        },
        limit: 500,
        overrideAccess: true,
      })
      const published = ['voting', 'tallying', 'completed', 'restart_required'].includes(e.status)
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
      if (!next) throw fail.conflict('invalid_phase', `Cannot advance from ${e.status}.`)
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
            and: [{ election: { equals: e.id } }, { kind: { equals: 'individual' } }],
          },
          limit: 0,
          overrideAccess: true,
        })
        const org = await req.payload.find({
          collection: 'election-voters',
          where: {
            and: [{ election: { equals: e.id } }, { kind: { equals: 'organisation' } }],
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
      await audit(req, account, {
        action: `election.${next}`,
        targetType: 'governance',
        targetId: String(e.id),
      })
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
          and: [{ election: { equals: e.id } }, { account: { equals: account.id } }],
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
      await audit(req, account, {
        action: 'election.candidate_nominated',
        targetType: 'governance',
        targetId: String(e.id),
      })
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
        .catch(() => {
          throw fail.notFound('Candidate not found.')
        })
      const updated = await req.payload.update({
        collection: 'election-candidates',
        id: candidate.id,
        data: {
          status: b.status,
          screeningNote: b.screeningNote?.trim() || null,
        },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: `election.candidate_${b.status}`,
        targetType: 'governance',
        targetId: String(e.id),
      })
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
          and: [{ election: { equals: e.id } }, { account: { equals: account.id } }],
        },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.totalDocs)
        throw fail.conflict('already_issued', 'A voter credential was already issued to you.')
      const kind = account.entityType === 'organization' ? 'organisation' : 'individual'
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
      await audit(req, account, {
        action: 'election.credential_issued',
        targetType: 'governance',
        targetId: String(e.id),
      })
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
      if (!Array.isArray(b.ranks))
        fields.ranks = 'Must be an array of candidate ids (empty for a blank ballot).'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const hash = tokenHash(e.id, String(b.token).trim())
      const { docs: voters } = await req.payload.find({
        collection: 'election-voters',
        where: {
          and: [{ election: { equals: e.id } }, { tokenHash: { equals: hash } }],
        },
        limit: 1,
        overrideAccess: true,
      })
      if (!voters.length) throw fail.forbidden('Invalid voter credential.')
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
      try {
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
      } catch (error) {
        // The count check above races; the (election, race, voterTokenHash)
        // unique index is the real guard. Converted error shapes vary, so
        // also re-confirm against the table — a row for this credential
        // after a failed insert means the race was lost.
        const { totalDocs } = await req.payload.find({
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
        if (isUniqueViolation(error, 'election-ballots', 'election_ballots') || totalDocs > 0)
          throw fail.conflict('already_voted', 'This credential has already voted in that race.')
        throw error
      }
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
      const quorumOk = ind >= (e.quorumIndividuals ?? 100) && org >= (e.quorumOrganisations ?? 25)
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
      await audit(req, account, {
        action: `election.${e.status}`,
        targetType: 'governance',
        targetId: String(e.id),
      })
      return json({ election: electionView(e) })
    }),
  },
]
