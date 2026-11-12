import type { Endpoint } from 'payload'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import { accountRef, requireCwMember, requireVerifiedMember } from '../lib/accounts'
import { audit } from '../lib/audit'
import { beleniosVoterList, eligibleVoters, isFacilitator, loadElection } from '../lib/governance'
import type { Doc, AnyValue } from '../lib/domain'

// S10 elections. the hub runs nominations and screening, decides who may
// vote and records the result; the vote itself happens on belenios, whose
// ballots are secret and publicly verifiable (see lib/governance.ts)

const candidateView = (c: AnyValue) => ({
  id: c.id,
  race: c.race,
  account: accountRef(c.account),
  statement: c.statement,
  videoUrl: c.videoUrl,
  status: c.status,
  nominatedAt: c.nominatedAt,
})

const electionView = (e: AnyValue, extra?: AnyValue) => ({
  id: e.id,
  title: e.title,
  kind: e.kind,
  status: e.status,
  description: e.description,
  races: (e.races ?? []).map((r: AnyValue) => ({ slug: r.slug, label: r.label })),
  nominationsOpenAt: e.nominationsOpenAt,
  nominationsCloseAt: e.nominationsCloseAt,
  votingOpensAt: e.votingOpensAt,
  votingCloseAt: e.votingCloseAt,
  quorumIndividuals: e.quorumIndividuals,
  quorumOrganisations: e.quorumOrganisations,
  ballotUrl: e.externalRef || null,
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
      return json({ items: (docs as Doc[]).map((e) => electionView(e)) })
    }),
  },
  {
    path: '/governance/elections',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await isFacilitator(req, account)))
        throw fail.forbidden('Only the Election Facilitation Team may create elections.')
      const b = await readBody(req)
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
          races: b.races.map((r: AnyValue) => ({
            slug: String(r.slug).trim(),
            label: String(r.label ?? r.slug).trim(),
          })),
          quorumIndividuals: b.quorumIndividuals ?? 100,
          quorumOrganisations: b.quorumOrganisations ?? 25,
        },
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
      const e = await loadElection(req, param(req, 'id'))
      // Candidacies publish when voting opens (S10 §2.3); counts only before.
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
          candidates: published ? (all as Doc[]).map(candidateView) : undefined,
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
      const e = await loadElection(req, param(req, 'id'))
      const flow: Record<string, string> = {
        announced: 'nominations',
        nominations: 'voting',
        voting: 'tallying',
        restart_required: 'nominations',
      }
      const next = flow[e.status]
      if (!next) throw fail.conflict('invalid_phase', `Cannot advance from ${e.status}.`)
      const now = new Date().toISOString()
      const patch: AnyValue = { status: next }
      if (next === 'nominations') {
        patch.nominationsOpenAt = now
        patch.nominationsCloseAt = new Date(Date.now() + 7 * 86400000).toISOString()
      }
      if (next === 'voting') {
        if (!e.externalRef)
          throw fail.conflict(
            'ballot_missing',
            'Set the Belenios election link before voting opens.',
          )
        patch.nominationsCloseAt = e.nominationsCloseAt ?? now
        patch.votingOpensAt = now
        patch.votingCloseAt = new Date(Date.now() + 5 * 86400000).toISOString()
        // snapshot the eligible registry for quorum reporting (S10 §3.4)
        const voters = await eligibleVoters()
        patch.eligibleIndividualCount = voters.filter((v) => v.kind === 'individual').length
        patch.eligibleOrgCount = voters.filter((v) => v.kind === 'organisation').length
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
      const e = await loadElection(req, param(req, 'id'))
      if (e.status !== 'nominations')
        throw fail.conflict('invalid_phase', 'Nominations are not open.')
      const b = await readBody(req)
      const fields: Record<string, string> = {}
      const raceSlugs = (e.races ?? []).map((r: AnyValue) => r.slug)
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
        },
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
      const e = await loadElection(req, param(req, 'id'))
      const b = await readBody(req)
      if (!['screened_in', 'screened_out'].includes(b.status))
        throw fail.validation({ status: 'Must be screened_in or screened_out.' })
      const candidate = await req.payload
        .findByID({
          collection: 'election-candidates',
          id: Number(param(req, 'cid')),
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
    // the belenios election this vote runs on
    path: '/governance/elections/:id/ballot',
    method: 'put',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await isFacilitator(req, account)))
        throw fail.forbidden('Only the Election Facilitation Team may set the ballot.')
      const e = await loadElection(req, param(req, 'id'))
      if (!['announced', 'nominations', 'voting'].includes(e.status))
        throw fail.conflict(
          'invalid_phase',
          `Cannot change the ballot while status is ${e.status}.`,
        )
      const url = httpsUrl((await readBody(req)).url)
      if (!url) throw fail.validation({ url: 'Use the https link of the Belenios election.' })
      const updated = await req.payload.update({
        collection: 'elections',
        id: e.id,
        data: { externalRef: url },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: 'election.ballot_set',
        targetType: 'governance',
        targetId: String(e.id),
      })
      return json({ election: electionView(updated) })
    }),
  },
  {
    // voter list to upload into belenios, which emails each voter a credential
    path: '/governance/elections/:id/voters',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await isFacilitator(req, account)))
        throw fail.forbidden('Only the Election Facilitation Team may export voters.')
      const e = await loadElection(req, param(req, 'id'))
      const voters = await eligibleVoters()
      await audit(req, account, {
        action: 'election.voters_exported',
        targetType: 'governance',
        targetId: String(e.id),
        after: { voters: voters.length },
      })
      return new Response(beleniosVoterList(voters), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="election-${e.id}-voters.txt"`,
          'Cache-Control': 'no-store',
        },
      })
    }),
  },
  {
    // record the result belenios published; quorum still decides restart
    path: '/governance/elections/:id/result',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await isFacilitator(req, account)))
        throw fail.forbidden('Only the Election Facilitation Team may record results.')
      const e = await loadElection(req, param(req, 'id'))
      if (!['voting', 'tallying'].includes(e.status))
        throw fail.conflict('invalid_phase', `Cannot record a result while status is ${e.status}.`)
      if (!e.externalRef)
        throw fail.conflict('ballot_missing', 'This election has no Belenios link.')
      const b = await readBody(req)
      const fields: Record<string, string> = {}
      const archiveUrl = httpsUrl(b.archiveUrl)
      if (!archiveUrl) fields.archiveUrl = 'Use the https link of the published Belenios result.'
      const individuals = Number(b.ballotsCast?.individuals)
      const organisations = Number(b.ballotsCast?.organisations)
      if (!Number.isInteger(individuals) || individuals < 0)
        fields.individuals = 'Ballots cast by individuals.'
      if (!Number.isInteger(organisations) || organisations < 0)
        fields.organisations = 'Ballots cast by organisations.'
      const { docs: screened } = await req.payload.find({
        collection: 'election-candidates',
        where: {
          and: [{ election: { equals: e.id } }, { status: { equals: 'screened_in' } }],
        },
        limit: 500,
        overrideAccess: true,
      })
      const races: Doc = {}
      for (const race of e.races ?? []) {
        const elected = (b.races?.[race.slug]?.elected ?? []).map(Number)
        const pool = (screened as Doc[]).filter((c) => c.race === race.slug)
        const unknown = elected.filter((id: number) => !pool.some((c) => c.id === id))
        if (unknown.length) fields[race.slug] = 'Elected ids must be screened-in candidates.'
        races[race.slug] = {
          elected: pool
            .filter((c) => elected.includes(c.id))
            .map((c) => ({ id: c.id, name: accountRef(c.account)?.name })),
        }
      }
      if (Object.keys(fields).length) throw fail.validation(fields)
      const quorum = {
        individualsMet: individuals >= (e.quorumIndividuals ?? 100),
        organisationsMet: organisations >= (e.quorumOrganisations ?? 25),
      }
      const updated = await req.payload.update({
        collection: 'elections',
        id: e.id,
        data: {
          status:
            quorum.individualsMet && quorum.organisationsMet ? 'completed' : 'restart_required',
          result: {
            source: 'belenios',
            ballotUrl: e.externalRef,
            archiveUrl,
            recordedAt: new Date().toISOString(),
            ballotsCast: { individuals, organisations },
            quorum,
            races,
          },
        },
        overrideAccess: true,
      })
      await audit(req, account, {
        action: `election.${updated.status}`,
        targetType: 'governance',
        targetId: String(e.id),
      })
      return json({ election: electionView(updated) })
    }),
  },
]

// only https links: these are shown to members and opened in their browsers
function httpsUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? '').trim())
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
