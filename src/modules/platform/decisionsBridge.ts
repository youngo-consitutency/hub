import type { PayloadRequest } from 'payload'
import { db, fail, permissions, text, type Actor, type Input } from './service'
import { DECISION_VIEW_SELECT, transitionDeadline } from './platformShared'
import {
  advanceIfDue,
  checkVeto,
  computeWindows,
  countEligible,
  loadProposal,
  proposalFlags,
  recordEvent,
} from '../../lib/decisionRuntime'
import { requireCwMember, requireVerifiedMember } from '../../lib/accounts'
import type { Doc, AnyValue } from '../../lib/domain'
import type { DecisionFlag, DecisionProposal } from '../../payload-types'

// Bridge between the operational platform UI (/platform/decisions*) and the
// S09 decision engine. decision_proposals is the single store; the legacy
// platform_decisions table survives only as a uuid-keyed projection so
// platform_tasks/platform_enquiries foreign keys and old links keep working.
// Every mutation writes S09 first, then syncs the projection row.

const STAGE: Record<string, string> = {
  draft: 'draft',
  consultation: 'consultation',
  revision: 'revision',
  decision: 'decision',
  voting: 'voting',
  adopted: 'adopted',
  vetoed: 'withdrawn',
  withdrawn: 'withdrawn',
  failed_quorum: 'not_adopted',
  rejected: 'not_adopted',
}

const CLOSED = ['adopted', 'vetoed', 'withdrawn', 'rejected', 'failed_quorum']

function platformBodyId(p: AnyValue): string {
  return p.body === 'council' ? 'council' : String(p.bodyRef ?? '')
}

function deadlineFor(p: AnyValue): string | null {
  if (p.status === 'consultation') return p.consultationEndsAt
  if (p.status === 'revision') return p.revisionEndsAt
  if (p.status === 'decision') return p.decisionEndsAt
  if (p.status === 'voting') return p.votingEndsAt
  return null
}

// Accept a numeric S09 id, a platform projection uuid, or an imported
// legacy uuid stored in legacy_ref.
async function resolveProposal(req: PayloadRequest, raw: string) {
  const id = String(raw)
  if (/^\d+$/.test(id)) return loadProposal(req, Number(id))
  const { rows } = await db().query(
    'SELECT s09_proposal_id FROM platform_decisions WHERE id = $1',
    [id],
  )
  if (rows[0]?.s09_proposal_id) return loadProposal(req, rows[0].s09_proposal_id)
  return loadProposal(req, id) // legacy_ref fallback inside loadProposal
}

async function publicId(p: AnyValue): Promise<string> {
  if (p.legacyRef) return p.legacyRef
  const { rows } = await db().query(
    'SELECT id FROM platform_decisions WHERE s09_proposal_id = $1',
    [p.id],
  )
  return rows[0]?.id ?? String(p.id)
}

// Mirror the mutable display columns back into platform_decisions so raw-SQL
// readers (public register, enquiry gate, task links) stay consistent.
async function syncProjection(p: AnyValue) {
  await db().query(
    `UPDATE platform_decisions SET
       title=$2, proposal=$3, stage=$4, deadline_at=$5, outcome=$6,
       outcome_evidence=$7, electorate_size=$8, votes_for=$9,
       votes_against=$10, is_public=$11, version=$12, updated_at=now()
     WHERE s09_proposal_id=$1`,
    [
      p.id,
      p.title,
      p.proposalText,
      STAGE[p.status],
      deadlineFor(p),
      p.resultSummary,
      p.outcomeEvidence,
      p.eligibleVoterCount,
      p.votesFor,
      p.votesAgainst,
      p.isPublic ?? false,
      p.version ?? 1,
    ],
  )
}

// platform body slug → S09 body scope.
async function s09Body(bodySlug: string) {
  const { rows } = await db().query('SELECT kind FROM platform_bodies WHERE id = $1', [bodySlug])
  const kind = rows[0]?.kind
  if (kind === 'council') return { body: 'council', bodyRef: null }
  if (kind === 'operational_team' || kind === 'coordination')
    return { body: 'operational_team', bodyRef: bodySlug }
  return { body: 'working_group', bodyRef: bodySlug }
}

async function bodyView(req: PayloadRequest, p: AnyValue) {
  const { rows } = await db().query(`${DECISION_VIEW_SELECT} WHERE dp.id = $1`, [p.id])
  return rows[0]
}

export async function saveDecision(req: PayloadRequest, actor: Actor, input: Input, id?: string) {
  const p = await permissions(actor)
  if (id) {
    const proposal = await resolveProposal(req, id)
    const bodyId = platformBodyId(proposal)
    if (!p.participates(bodyId)) fail(403, 'Only members of this body can edit the proposal.')
    if (Number(proposal.version) !== Number(input.version))
      fail(409, 'The proposal changed. Review its current version.')
    if (!['draft', 'revision'].includes(proposal.status))
      fail(409, 'The proposal cannot be edited in this phase.')
    if (
      proposal.proposedBy !== actor.id &&
      (proposal.proposedBy as Doc)?.id !== actor.id &&
      !p.manages(bodyId)
    )
      fail(403, 'Only the author or a body coordinator can edit.')
    const title = text(input, 'title')
    const proposalText = text(input, 'proposal', 20000)
    const version = (proposal.version ?? 1) + 1
    const updated = await req.payload.update({
      collection: 'decision-proposals',
      id: proposal.id,
      data: {
        title,
        proposalText,
        version,
        revisions: [
          ...(proposal.revisions ?? []),
          { version, title, proposal: proposalText, createdAt: new Date().toISOString() },
        ],
      } as Doc,
      overrideAccess: true,
    })
    await recordEvent(req, proposal.id, 'revised', actor, { version })
    await syncProjection(updated)
    return { id: await publicId(proposal) }
  }

  const bodyId = text(input, 'bodyId')
  if (!p.participates(bodyId)) fail(403, 'Only members of this body can propose a decision.')
  const title = text(input, 'title')
  const proposalText = text(input, 'proposal', 20000)
  const process = text(input, 'process')
  const policyVersion = text(input, 'policyVersion', 200)
  const urgency = text(input, 'urgencyReason', 2000, false)
  if (!['standard', 'snap'].includes(process))
    fail(
      400,
      'Choose a standard or snap process. Conference decisions require a separate attendance model.',
    )
  const snapHours = Number(input.snapHours ?? 24)
  if (!Number.isFinite(snapHours) || snapHours <= 0 || snapHours >= 168)
    fail(400, 'Snap decisions need fewer than 168 hours.')
  if (process !== 'standard' && urgency.length < 8)
    fail(400, 'Explain the urgency or conference context.')
  const { body, bodyRef } = await s09Body(bodyId)
  const proposal = await req.payload.create({
    collection: 'decision-proposals',
    data: {
      title,
      context: proposalText.slice(0, 2000),
      proposalText,
      decisionType: process === 'snap' ? 'snap' : 'standard',
      body: body as DecisionProposal['body'],
      bodyRef,
      policyVersion,
      snapHours,
      snapJustification: urgency || null,
      snapDeadline:
        process === 'snap' ? new Date(Date.now() + snapHours * 3600000).toISOString() : null,
      status: 'draft',
      proposedBy: Number(actor.id),
      contactPersons: [Number(actor.id)],
      version: 1,
      revisions: [
        {
          version: 1,
          title,
          proposal: proposalText,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    overrideAccess: true,
  })
  const { rows } = await db().query(
    `INSERT INTO platform_decisions
       (body_id, title, proposal, stage, process, policy_version,
        urgency_reason, snap_hours, author_id, version, s09_proposal_id)
     VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,1,$9) RETURNING id`,
    [
      bodyId,
      title,
      proposalText,
      process,
      policyVersion,
      urgency,
      snapHours,
      actor.id,
      proposal.id,
    ],
  )
  await recordEvent(req, proposal.id, 'created', actor)
  return { id: rows[0].id }
}

export async function decisionDetail(req: PayloadRequest, actor: Actor, id: string) {
  requireVerifiedMember(req)
  let proposal = await resolveProposal(req, id)
  proposal = await advanceIfDue(req, proposal)
  proposal = await checkVeto(req, proposal)
  await syncProjection(proposal)
  const p = await permissions(actor)
  const bodyId = platformBodyId(proposal)
  if (!p.participates(bodyId) && !p.officer)
    fail(403, 'Only members of this body can read the process.')

  const flags = await proposalFlags(req, proposal.id)
  const { docs: comments } = await req.payload.find({
    collection: 'decision-comments',
    where: { proposal: { equals: proposal.id } },
    sort: 'createdAt',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })
  const { docs: events } = await req.payload.find({
    collection: 'decision-events',
    where: { proposal: { equals: proposal.id } },
    sort: 'createdAt',
    limit: 500,
    overrideAccess: true,
  })

  const contributions = [
    ...(comments as Doc[]).map((c) => ({
      id: `c:${c.id}`,
      authorId: c.account?.id ?? c.account,
      authorName: c.account?.name ?? '',
      kind: 'comment' as const,
      text: c.body,
      grounds: '',
      alternative: '',
      resolution: null,
      createdAt: c.createdAt,
    })),
    ...flags.map((f) => ({
      id: `f:${f.id}`,
      authorId: f.raisedBy?.id ?? f.raisedBy,
      authorName: f.raisedBy?.name ?? '',
      kind: f.kind as 'red' | 'grey',
      text: f.reason,
      grounds: f.rationaleCategory ? f.rationaleCategory.replace(/_/g, ' ') : '',
      alternative: f.alternative ?? '',
      resolution: f.status === 'open' ? null : f.responseNote,
      createdAt: f.raisedAt,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return {
    viewerId: actor.id,
    decision: await bodyView(req, proposal),
    contributions,
    revisions: (proposal.revisions ?? [])
      .map((r: AnyValue) => ({
        version: r.version,
        title: r.title,
        proposal: r.proposal,
        createdAt: r.createdAt,
      }))
      .sort((a: AnyValue, b: AnyValue) => b.version - a.version),
    history: (events as Doc[]).map((e) => ({
      action: e.type,
      reason: e.detail ? JSON.stringify(e.detail) : '',
      createdAt: e.createdAt,
    })),
    canManage: p.manages(bodyId),
    canParticipate: true,
  }
}

export async function contribute(req: PayloadRequest, actor: Actor, id: string, input: Input) {
  const account = requireCwMember(req)
  let proposal = await resolveProposal(req, id)
  proposal = await advanceIfDue(req, proposal)
  const p = await permissions(actor)
  if (!p.participates(platformBodyId(proposal)))
    fail(403, 'Only members of this body may participate.')
  if (
    !['consultation', 'decision'].includes(proposal.status) ||
    (deadlineFor(proposal) && new Date(deadlineFor(proposal) as string).getTime() <= Date.now())
  )
    fail(409, 'The response period is closed.')
  const kind = text(input, 'kind')
  const message = text(input, 'text', 5000)
  const grounds = text(input, 'grounds', 3000, false)
  const alternative = text(input, 'alternative', 5000, false)
  if (!['comment', 'red', 'grey'].includes(kind)) fail(400, 'Choose comment, red or grey flag.')
  if (kind === 'comment') {
    await req.payload.create({
      collection: 'decision-comments',
      data: {
        proposal: proposal.id,
        account: account.id,
        body: message,
        createdAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
    await recordEvent(req, proposal.id, 'commented', account)
    return
  }
  if (kind === 'red' && (!grounds || !alternative))
    fail(400, 'A red flag needs grounds and an alternative proposal.')
  if (kind === 'grey' && !grounds) fail(400, 'Explain the concern behind a grey flag.')
  const flag = await req.payload.create({
    collection: 'decision-flags',
    data: {
      proposal: proposal.id,
      kind: kind as DecisionFlag['kind'],
      rationaleCategory: (input.rationaleCategory ?? null) as DecisionFlag['rationaleCategory'],
      reason: grounds ? `${message}\n\n${grounds}` : message,
      alternative: alternative || null,
      raisedBy: account.id,
      status: 'open',
      raisedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })
  await recordEvent(req, proposal.id, `flag_${kind}_raised`, account, {
    flagId: flag.id,
  })
}

export async function resolveContribution(
  req: PayloadRequest,
  actor: Actor,
  contributionId: string,
  input: Input,
) {
  requireVerifiedMember(req)
  const [kind, rawId] = String(contributionId).split(':')
  if (kind === 'c') fail(400, 'Comments are not flags.')
  if (kind !== 'f' || !/^\d+$/.test(rawId ?? '')) fail(404, 'Contribution not found.')
  const flag = await req.payload
    .findByID({
      collection: 'decision-flags',
      id: Number(rawId),
      depth: 1,
      overrideAccess: true,
    })
    .catch(() => fail(404, 'Contribution not found.'))
  const proposalId = (flag as Doc).proposal?.id ?? (flag as Doc).proposal
  const proposal = await loadProposal(req, proposalId)
  if (CLOSED.includes(proposal.status)) fail(409, 'The decision is already closed.')
  const raiser = (flag as Doc).raisedBy?.id ?? (flag as Doc).raisedBy
  // A coordinator may answer a flag, but its author must confirm withdrawal.
  const p = await permissions(actor)
  if (raiser !== actor.id && !p.officer)
    fail(403, 'Only the flag author can confirm that their concern is resolved.')
  const reason = text(input, 'resolution', 3000)
  await req.payload.update({
    collection: 'decision-flags',
    id: (flag as Doc).id,
    data: {
      status: 'withdrawn',
      responseNote: reason,
      respondedBy: Number(actor.id),
      respondedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })
  await recordEvent(req, proposal.id, 'flag_withdrawn', actor, {
    flagId: (flag as Doc).id,
    resolution: reason,
  })
}

const NEXT_STAGE: Record<string, string[]> = {
  draft: ['consultation', 'withdrawn'],
  consultation: ['revision', 'withdrawn'],
  revision: ['decision', 'withdrawn'],
  decision: ['adopted', 'voting', 'withdrawn'],
  voting: ['adopted', 'not_adopted', 'withdrawn'],
}

const S09_TARGET: Record<string, string> = {
  consultation: 'consultation',
  revision: 'revision',
  decision: 'decision',
  voting: 'voting',
  adopted: 'adopted',
  not_adopted: 'rejected',
  withdrawn: 'withdrawn',
}

export async function transition(req: PayloadRequest, actor: Actor, id: string, input: Input) {
  let proposal = await resolveProposal(req, id)
  proposal = await advanceIfDue(req, proposal)
  const p = await permissions(actor)
  const bodyId = platformBodyId(proposal)
  if (!p.manages(bodyId))
    fail(403, 'The assigned body facilitator must confirm process transitions.')
  if (Number(proposal.version) !== Number(input.version))
    fail(409, 'The proposal changed. Review its current version.')
  const next = text(input, 'stage')
  if (!NEXT_STAGE[proposal.status]?.includes(next)) fail(409, 'This transition is not allowed.')
  const currentDeadline = deadlineFor(proposal)
  if (next !== 'withdrawn' && currentDeadline && new Date(currentDeadline).getTime() > Date.now())
    fail(409, 'Wait for the current response period to end.')

  let reason = text(input, 'reason', 3000)
  const evidence = text(input, 'evidence', 3000, false)
  const outcomeBasis = text(input, 'outcomeBasis', 40, false)
  if (outcomeBasis && !['process', 'formal_veto'].includes(outcomeBasis))
    fail(400, 'Choose a recognised outcome basis.')

  const version = (proposal.version ?? 1) + 1
  const bump = async (data: Doc, event: string, detail?: AnyValue) => {
    const updated = await req.payload.update({
      collection: 'decision-proposals',
      id: proposal.id,
      data: { version, ...data },
      overrideAccess: true,
    })
    await recordEvent(req, proposal.id, event, actor, detail)
    await syncProjection(updated)
    return updated
  }

  if (next === 'consultation') {
    const windows = computeWindows(
      proposal.decisionType,
      new Date(),
      proposal.snapDeadline ? new Date(proposal.snapDeadline) : null,
    )
    await bump(
      {
        status: 'consultation',
        presentedAt: new Date().toISOString(),
        ...windows,
      },
      'presented',
      windows,
    )
    return
  }

  if (next === 'revision' || next === 'decision') {
    await bump({ status: S09_TARGET[next] }, `phase_${next}`)
    return
  }

  if (next === 'voting') {
    const eligible = await countEligible(req, proposal)
    await bump(
      {
        status: 'voting',
        eligibleVoterCount: eligible,
        votingEndsAt: transitionDeadline('standard', 'voting', new Date()),
        ballotOptions: [{ option: 'for' }, { option: 'against' }],
      },
      'vote_opened',
      { eligibleVoterCount: eligible },
    )
    return
  }

  if (next === 'withdrawn') {
    if (outcomeBasis === 'formal_veto') {
      if (proposal.status !== 'voting')
        fail(409, 'A formal veto stops the vote and withdraws the proposal.')
      const organisations = Number(input.vetoOrganisations)
      const south = Number(input.vetoGlobalSouth)
      const bodies = Number(input.vetoBodies)
      if (
        ![organisations, south, bodies].every(Number.isSafeInteger) ||
        Math.min(organisations, south, bodies) < 0 ||
        south > organisations
      )
        fail(400, 'Enter valid represented organisation and body counts.')
      if (organisations < 20 && south < 6 && bodies < 5)
        fail(409, 'The formal veto threshold has not been met.')
      await bump(
        {
          status: 'vetoed',
          decidedAt: new Date().toISOString(),
          resultSummary: `Formal veto: ${reason}`,
          outcomeEvidence: evidence || null,
        },
        'vetoed',
        { organisations, globalSouthOrganisations: south, bodies, reason },
      )
      return
    }
    await bump(
      {
        status: 'withdrawn',
        decidedAt: new Date().toISOString(),
        resultSummary: reason,
        outcomeEvidence: evidence || null,
      },
      'withdrawn',
      { reason },
    )
    return
  }

  // adopted / not_adopted
  if (!evidence) fail(400, 'Record the outcome evidence.')
  if (proposal.status === 'decision') {
    const flags = await proposalFlags(req, proposal.id)
    const openRed = flags.filter((f) => f.kind === 'red' && f.status === 'open').length
    if (openRed) fail(409, 'Resolve the outstanding red flags or use the voting process.')
    const openGrey = flags.filter((f) => f.kind === 'grey' && f.status === 'open').length
    if (openGrey) reason += `\nReservations considered: ${text(input, 'reservations', 3000)}`
    if (next !== 'adopted') fail(409, 'A consensus process may only adopt or move to a vote.')
    await bump(
      {
        status: 'adopted',
        adoptedVia: openGrey ? 'consensus_with_reservations' : 'consensus',
        decidedAt: new Date().toISOString(),
        resultSummary: reason,
        outcomeEvidence: evidence,
      },
      'adopted',
      { via: openGrey ? 'consensus_with_reservations' : 'consensus' },
    )
  } else {
    // voting → adopted/not_adopted with the recorded tally.
    const electorate = Number(input.electorateSize)
    const forVotes = Number(input.votesFor)
    const against = Number(input.votesAgainst)
    if (
      ![electorate, forVotes, against].every(Number.isSafeInteger) ||
      electorate < 1 ||
      forVotes < 0 ||
      against < 0 ||
      forVotes + against > electorate
    )
      fail(400, 'Enter valid eligible-seat and vote counts.')
    if (forVotes + against < Math.ceil(electorate * 0.05))
      fail(
        409,
        'The vote did not meet quorum. Withdraw the proposal and record the ballot evidence.',
      )
    const passed = forVotes * 3 >= (forVotes + against) * 2
    if ((next === 'adopted') !== passed)
      fail(409, 'The recorded vote does not support this outcome (5% quorum, two-thirds approval).')
    await bump(
      {
        status: passed ? 'adopted' : 'rejected',
        adoptedVia: passed ? 'vote' : null,
        decidedAt: new Date().toISOString(),
        resultSummary: reason,
        outcomeEvidence: evidence,
        eligibleVoterCount: electorate,
        votesFor: forVotes,
        votesAgainst: against,
      },
      passed ? 'adopted' : 'rejected',
      { votesFor: forVotes, votesAgainst: against, electorate },
    )
  }

  if (next === 'adopted') {
    await db().query(
      `INSERT INTO platform_tasks(body_id,title,description,owner_id,due_at,status,decision_id,created_by)
       SELECT $1,$2,$3,$4,now()+interval '7 days','open',$5,$4`,
      [
        bodyId,
        `Communicate decision: ${proposal.title}`.slice(0, 200),
        'Update the constituency decision tracker and communicate through the main channel. Record the communication link here when complete.',
        actor.id,
        (
          await db().query('SELECT id FROM platform_decisions WHERE s09_proposal_id=$1', [
            proposal.id,
          ])
        ).rows[0]?.id ?? null,
      ],
    )
  }
}

export async function publishDecision(
  req: PayloadRequest,
  actor: Actor,
  id: string,
  version: unknown,
) {
  const p = await permissions(actor)
  if (!p.publisher) fail(403, 'A content publisher must approve public disclosure.')
  const proposal = await resolveProposal(req, id)
  const bodyId = platformBodyId(proposal)
  if (!p.participates(bodyId))
    fail(403, 'The publisher must belong to this body to review its decision.')
  if (proposal.status !== 'adopted' || Number(proposal.version) !== Number(version))
    fail(409, 'Only an adopted, current proposal can be published by a different person.')
  // Editorial independence: neither the author nor the last reviser may
  // approve publication of their own text.
  const { docs: lastRevised } = await req.payload.find({
    collection: 'decision-events',
    where: {
      and: [{ proposal: { equals: proposal.id } }, { type: { equals: 'revised' } }],
    },
    sort: '-createdAt',
    limit: 1,
    overrideAccess: true,
  })
  const lastEditor = (lastRevised[0] as Doc)?.actor?.id ?? (lastRevised[0] as Doc)?.actor
  const author = proposal.proposedBy?.id ?? proposal.proposedBy
  if (author === actor.id || (lastEditor ?? author) === actor.id)
    fail(409, 'Only an adopted, current proposal can be published by a different person.')
  const updated = await req.payload.update({
    collection: 'decision-proposals',
    id: proposal.id,
    data: { isPublic: true },
    overrideAccess: true,
  })
  await recordEvent(req, proposal.id, 'published', actor, {
    note: 'Approved for the public decision register',
  })
  await syncProjection(updated)
}

export async function withdrawDecisionPublication(
  req: PayloadRequest,
  actor: Actor,
  id: string,
  input: Input,
) {
  const p = await permissions(actor)
  if (!p.publisher) fail(403, 'A content publisher assignment is required.')
  const reason = text(input, 'reason', 2000)
  const proposal = await resolveProposal(req, id)
  if (!p.participates(platformBodyId(proposal)))
    fail(403, 'The publisher must belong to this body.')
  if (Number(proposal.version) !== Number(input.version))
    fail(409, 'The record changed. Reload first.')
  const updated = await req.payload.update({
    collection: 'decision-proposals',
    id: proposal.id,
    data: { isPublic: false },
    overrideAccess: true,
  })
  await recordEvent(req, proposal.id, 'publication_withdrawn', actor, {
    reason,
  })
  await syncProjection(updated)
}
