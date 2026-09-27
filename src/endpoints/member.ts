import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import {
  accountView,
  isVerifiedAccount,
  requireAccount,
  requireVerifiedMember,
} from '../lib/accounts'
import { getAccessProfile } from '../lib/access'
import { opportunityShape } from '../lib/content'
import { requirePgPool } from '../lib/pg'
import * as store from '../lib/content'
import {
  COURSE_MODULES,
  COURSE_VERSION,
  PASS_SCORE,
  QUIZ,
  scoreQuiz,
} from '../lib/membershipCourse.js'
import { rateLimit } from '../lib/rateLimit'
import {
  getMemberPerson,
  getOwnAppeal,
  getOwnMemberProfile,
  listMemberPeople,
  readMemberPhoto,
  saveMemberPhoto,
  deleteMemberPhoto,
  submitAppeal,
} from '../lib/membership'

const feedbackLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  scope: 'feedback',
})

async function wgProgress(req: PayloadRequest, accountId: string | number, wgSlug: string) {
  const { docs } = await req.payload.find({
    collection: 'wg-progress',
    where: {
      account: { equals: accountId },
      wgSlug: { equals: wgSlug },
    },
    limit: 1,
    overrideAccess: true,
  })
  return (docs[0] as any) || null
}

async function upsertWgProgress(
  req: PayloadRequest,
  accountId: string | number,
  wgSlug: string,
  patch: Record<string, any>,
) {
  const existing = await wgProgress(req, accountId, wgSlug)
  const presentationOk = patch.presentationOk ?? patch.presentation_ok ?? existing?.presentationOk ?? false
  const rulesOk = patch.rulesOk ?? patch.rules_ok ?? existing?.rulesOk ?? false
  const unlocked =
    presentationOk && rulesOk
      ? existing?.unlockedAt || new Date().toISOString()
      : existing?.unlockedAt || null
  const status =
    patch.status ??
    (presentationOk && rulesOk ? 'active' : existing?.status || 'interested')
  const data = {
    account: accountId,
    wgSlug,
    presentationOk,
    rulesOk,
    unlockedAt: unlocked,
    joinedAt: existing?.joinedAt || (patch.status ? new Date().toISOString() : existing?.joinedAt) || new Date().toISOString(),
    status,
    roleInWg: patch.roleInWg ?? patch.role_in_wg ?? existing?.roleInWg ?? 'member',
  }
  if (existing) {
    return req.payload.update({
      collection: 'wg-progress',
      id: existing.id,
      data: data as any,
      overrideAccess: true,
      req,
    })
  }
  return req.payload.create({
    collection: 'wg-progress',
    data: data as any,
    overrideAccess: true,
    req,
  })
}

function wgProgressView(d: any, accountId?: string | number) {
  if (!d) return null
  return {
    account_id: accountId ?? (typeof d.account === 'object' ? d.account?.id : d.account),
    wg_slug: d.wgSlug,
    presentation_ok: d.presentationOk,
    rules_ok: d.rulesOk,
    unlocked_at: d.unlockedAt,
    joined_at: d.joinedAt,
    status: d.status,
    role_in_wg: d.roleInWg,
  }
}

export function wgActivityView(d: any) {
  return {
    id: d.id,
    wg_slug: d.wgSlug,
    kind: d.kind,
    title: d.title,
    body: d.body,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    url: d.url,
    task_force_slug: d.taskForceSlug,
    created_by: typeof d.createdBy === 'object' ? d.createdBy?.id : d.createdBy,
    created_at: d.createdAt,
  }
}

const FEEDBACK_KINDS = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'ui_ux', label: 'Design or usability' },
  { value: 'feature', label: 'Feature idea' },
  { value: 'blocker', label: 'I am blocked' },
  { value: 'content', label: 'Wrong or missing content' },
  { value: 'other', label: 'Something else' },
]
const FEEDBACK_SEVERITIES = [
  { value: 'low', label: 'Minor' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Serious' },
  { value: 'critical', label: 'Cannot use the Hub' },
]

const trimmed = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export const memberEndpoints: Endpoint[] = [
  {
    path: '/member/access',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const access = await getAccessProfile(req, account)
      const seat = await req.payload
        .find({
          collection: 'ngo-seats',
          where: {
            memberAccount: { equals: account.id },
            status: { equals: 'active' },
          },
          limit: 1,
          sort: '-acceptedAt',
          overrideAccess: true,
        })
        .then((r) => r.docs[0] as any)
      return json({
        ...access,
        isAdmin: account.role === 'admin',
        managedWgs: access.wgAssignments.map((i: any) => i.wgSlug).sort(),
        ngo: seat
          ? {
              orgAccountId:
                typeof seat.orgAccount === 'object'
                  ? seat.orgAccount.id
                  : seat.orgAccount,
              seatRole: seat.seatRole,
            }
          : null,
      })
    }),
  },
  {
    path: '/member/course',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      return json({
        version: COURSE_VERSION,
        passScore: PASS_SCORE,
        modules: COURSE_MODULES,
        quiz: QUIZ.map(({ id, prompt, choices }) => ({ id, prompt, choices })),
        accountStatus: account.memberStatus,
        alreadyPassed: isVerifiedAccount(account),
      })
    }),
  },
  {
    path: '/member/course/submit',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const b = ((await req.json?.()) || {}) as any
      const { score, total, passed } = scoreQuiz(b?.answers || {})
      if (!passed) {
        return json(
          {
            error: {
              code: 'quiz_failed',
              message: `You scored ${score}/${total}. You need at least ${PASS_SCORE} correct to pass. Review the modules and try again.`,
            },
            score,
            total,
            passed: false,
          },
          { status: 400 },
        )
      }
      const now = new Date().toISOString()
      const status = account.membershipStatus
      const nextStatus = ['active', 'renewal_due', 'awaiting_onboarding'].includes(
        status,
      )
        ? status
        : account.membershipTrack === 'constituency_work'
          ? 'awaiting_onboarding'
          : 'course_passed'
      const updated = await req.payload.update({
        collection: 'accounts',
        id: account.id,
        data: {
          memberStatus: 'verified',
          hubAccessStatus: 'active',
          membershipStatus: nextStatus,
          coursePassedAt: account.coursePassedAt || now,
          courseScore: score,
          verifiedAt: account.verifiedAt || now,
        } as any,
        overrideAccess: true,
        req,
      })
      return json({
        ok: true,
        score,
        total,
        passed: true,
        account: accountView(updated),
      })
    }),
  },
  {
    path: '/member/workspace',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'wg-progress',
        where: { account: { equals: account.id } },
        sort: '-joinedAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({
        items: (docs as any[]).map((d) => wgProgressView(d, account.id)),
      })
    }),
  },
  {
    path: '/member/workspace/:wg',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const wg = String(req.routeParams?.wg)
      const progress = await wgProgress(req, account.id, wg)
      const unlocked = Boolean(progress?.presentationOk && progress?.rulesOk)
      let activities: any[] = []
      if (unlocked) {
        const { docs } = await req.payload.find({
          collection: 'wg-activities',
          where: { wgSlug: { equals: wg } },
          sort: '-createdAt',
          limit: 50,
          overrideAccess: true,
        })
        activities = docs.map(wgActivityView)
      }
      return json({
        progress: wgProgressView(progress, account.id),
        activities,
      })
    }),
  },
  {
    path: '/member/workspace/:wg/onboard',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = ((await req.json?.()) || {}) as any
      const progress = await upsertWgProgress(
        req,
        account.id,
        String(req.routeParams?.wg),
        {
          presentationOk: Boolean(b.presentationOk),
          rulesOk: Boolean(b.rulesOk),
          status: 'active',
        },
      )
      return json({ progress: wgProgressView(progress, account.id) })
    }),
  },
  {
    path: '/member/workspace/:wg/join',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const progress = await upsertWgProgress(
        req,
        account.id,
        String(req.routeParams?.wg),
        { status: 'pending_approval' },
      )
      return json({ progress: wgProgressView(progress, account.id) })
    }),
  },

  // ── Member profile ────────────────────────────────────────────────
  {
    path: '/member/profile',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'member-profiles',
        where: { account: { equals: account.id } },
        limit: 1,
        overrideAccess: true,
      })
      const row = docs[0] as any
      const photoUpdatedAt = row?.photoUpdatedAt ?? null
      return json({
        profile: {
          accountId: account.id,
          displayName: row?.displayName ?? account.name ?? 'YOUNGO member',
          headline: row?.headline || '',
          bio: row?.bio || '',
          pronouns: row?.pronouns || '',
          expertiseTags: row?.expertiseTags || [],
          directoryVisibility: row?.directoryVisibility || 'private',
          showCountry: Boolean(row?.showCountry),
          showOrganization: Boolean(row?.showOrganization),
          showWorkingGroups: row?.showWorkingGroups ?? true,
          showRoles: row?.showRoles ?? true,
          roleTitle: row?.roleTitle || '',
          revision: row?.revision || 1,
          updatedAt: row?.updatedAt ?? null,
          hasPhoto: Boolean(row?.hasPhoto ?? photoUpdatedAt),
          photoUpdatedAt,
          photoUrl: photoUpdatedAt
            ? `/api/member/people/${account.id}/photo?v=${encodeURIComponent(photoUpdatedAt)}`
            : null,
        },
      })
    }),
  },
  {
    path: '/member/profile',
    method: 'patch',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = ((await req.json?.()) || {}) as any
      const fields: Record<string, string> = {}
      const displayName = trimmed(b.displayName, 120)
      if (!displayName) fields.displayName = 'Display name is required.'
      const bio = trimmed(b.bio, 2000)
      const headline = trimmed(b.headline, 200)
      const pronouns = trimmed(b.pronouns, 60)
      const roleTitle = trimmed(b.roleTitle, 120)
      const expertiseTags = Array.isArray(b.expertiseTags)
        ? b.expertiseTags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 20)
        : []
      const directoryVisibility = ['private', 'members', 'public'].includes(
        b.directoryVisibility,
      )
        ? b.directoryVisibility
        : 'private'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const { docs } = await req.payload.find({
        collection: 'member-profiles',
        where: { account: { equals: account.id } },
        limit: 1,
        overrideAccess: true,
      })
      const existing = docs[0] as any
      const data = {
        account: account.id,
        displayName,
        headline,
        bio,
        pronouns,
        expertiseTags,
        directoryVisibility,
        showCountry: Boolean(b.showCountry),
        showOrganization: Boolean(b.showOrganization),
        showWorkingGroups: b.showWorkingGroups !== false,
        showRoles: b.showRoles !== false,
        roleTitle,
        revision: (existing?.revision || 1) + 1,
      }
      const profile = existing
        ? await req.payload.update({
            collection: 'member-profiles',
            id: existing.id,
            data: data as any,
            overrideAccess: true,
            req,
          })
        : await req.payload.create({
            collection: 'member-profiles',
            data: data as any,
            overrideAccess: true,
            req,
          })
      return json({ profile })
    }),
  },

  // ── Member people directory ───────────────────────────────────────
  {
    path: '/member/people',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      return json(
        await listMemberPeople({
          search: req.query?.search,
          tag: req.query?.tag,
          workingGroup: req.query?.workingGroup,
          workingGroupRole: req.query?.workingGroupRole,
          page: req.query?.page,
          pageSize: req.query?.pageSize,
        }),
      )
    }),
  },
  {
    path: '/member/people/:id',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const access = await getAccessProfile(req, account)
      const person = await getMemberPerson(
        { ...accountView(account), access },
        req.routeParams?.id,
      )
      if (!person) throw fail.notFound('Member profile not found.')
      return json({ person })
    }),
  },

  // ── Feedback ──────────────────────────────────────────────────────
  {
    path: '/member/feedback/options',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const access = await getAccessProfile(req, account)
      return json({
        kinds: FEEDBACK_KINDS,
        severities: FEEDBACK_SEVERITIES,
        canTriage:
          account.role === 'admin' || access.teamRoles.includes('membership_team'),
      })
    }),
  },
  {
    path: '/member/feedback/mine',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const { docs } = await req.payload.find({
        collection: 'feedback-tickets',
        where: { account: { equals: account.id } },
        sort: '-createdAt',
        limit: 100,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/feedback',
    method: 'post',
    handler: endpoint(async (req) => {
      feedbackLimit(req)
      const account = requireAccount(req)
      const b = ((await req.json?.()) || {}) as any
      const title = trimmed(b.title, 200)
      const kind = FEEDBACK_KINDS.some((k) => k.value === b.kind)
        ? b.kind
        : null
      const severity = FEEDBACK_SEVERITIES.some((s) => s.value === b.severity)
        ? b.severity
        : 'normal'
      const body = trimmed(b.body, 5000)
      if (!title || !kind || !body) {
        throw fail.validation({
          ...(title ? {} : { title: 'Please describe the issue briefly.' }),
          ...(kind ? {} : { kind: 'Pick what this is about.' }),
          ...(body ? {} : { body: 'Tell us what happened.' }),
        })
      }
      const ticket = await req.payload.create({
        collection: 'feedback-tickets',
        data: {
          title,
          kind,
          severity,
          body,
          pageUrl: trimmed(b.pageUrl, 500) || null,
          contextNote: trimmed(b.contextNote, 200) || null,
          account: account.id,
          contactEmail: account.email,
          status: 'new',
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: ticket }, { status: 201 })
    }),
  },
  {
    path: '/member/feedback',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const access = await getAccessProfile(req, account)
      const canTriage =
        account.role === 'admin' || access.teamRoles.includes('membership_team')
      if (!canTriage) throw fail.forbidden('Feedback triage is for admins and the Membership Team.')
      const where: any = {}
      if (req.query?.status) where.status = { equals: req.query.status }
      if (req.query?.kind) where.kind = { equals: req.query.kind }
      const { docs } = await req.payload.find({
        collection: 'feedback-tickets',
        where,
        sort: '-createdAt',
        limit: Math.min(200, Number(req.query?.limit || 100)),
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/feedback/:id',
    method: 'patch',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const access = await getAccessProfile(req, account)
      const canTriage =
        account.role === 'admin' || access.teamRoles.includes('membership_team')
      if (!canTriage) throw fail.forbidden()
      const b = ((await req.json?.()) || {}) as any
      const data: any = {}
      if (b.status && ['new', 'triaged', 'in_progress', 'resolved', 'declined'].includes(b.status))
        data.status = b.status
      if (b.triageNote !== undefined) data.triageNote = trimmed(b.triageNote, 2000)
      const updated = await req.payload.update({
        collection: 'feedback-tickets',
        id: String(req.routeParams?.id),
        data,
        overrideAccess: true,
        req,
      })
      return json({ item: updated })
    }),
  },

  // ── Opportunities board (member read) ─────────────────────────────
  {
    path: '/member/opportunities',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      const items = await store.listOpportunities(req, {
        kind: req.query?.kind as string,
        format: req.query?.format as string,
      })
      return json({
        items,
        kinds: [
          { value: 'event', label: 'Event' },
          { value: 'workshop', label: 'Online workshop' },
          { value: 'hackathon', label: 'Hackathon' },
          { value: 'opportunity', label: 'Opportunity' },
          { value: 'call', label: 'Open call' },
          { value: 'training', label: 'Training' },
        ],
        formats: [
          { value: 'online', label: 'Online' },
          { value: 'in_person', label: 'In person' },
          { value: 'hybrid', label: 'Hybrid' },
        ],
      })
    }),
  },
  {
    path: '/member/opportunities/review',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const access = await getAccessProfile(req, account)
      if (!(account.role === 'admin' || access.teamRoles.includes('membership_team')))
        throw fail.forbidden('Posting review is for admins and the Membership Team.')
      const [pending, published] = await Promise.all([
        req.payload.find({
          collection: 'opportunities',
          where: { status: { equals: 'pending_review' } },
          sort: 'createdAt',
          limit: 100,
          overrideAccess: true,
        }),
        req.payload.find({
          collection: 'opportunities',
          where: { status: { equals: 'published' } },
          sort: '-createdAt',
          limit: 50,
          overrideAccess: true,
        }),
      ])
      const pool = requirePgPool()
      const { rows: orgRows } = await pool.query(
        `SELECT a.id AS org_account_id,
                a.organization_name,
                a.posting_trust AS override_state,
                a.posting_trust_note AS override_note,
                EXISTS (
                  SELECT 1 FROM opportunities o
                   WHERE o.org_account_id = a.id AND o.status = 'published'
                ) AS has_published
           FROM accounts a
           JOIN (
             SELECT DISTINCT org_account_id FROM opportunities
           ) posted ON posted.org_account_id = a.id
          ORDER BY a.organization_name NULLS LAST, a.id
          LIMIT 200`,
      )
      const organisations = orgRows.map((row: any) => {
        const override = row.override_state || null
        const trusted =
          override === 'trusted' ||
          (override !== 'review_required' && Boolean(row.has_published))
        return {
          orgAccountId: row.org_account_id,
          organizationName: row.organization_name || null,
          trusted,
          override,
          overrideNote: row.override_note || null,
        }
      })
      return json({
        items: (pending.docs as any[]).map(opportunityShape),
        published: (published.docs as any[]).map(opportunityShape),
        organisations,
      })
    }),
  },

  // ── Notification preferences ──────────────────────────────────────
  {
    path: '/member/notifications/preferences',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const { docs } = await req.payload.find({
        collection: 'notification-prefs',
        where: { account: { equals: account.id } },
        limit: 1,
        overrideAccess: true,
      })
      const row = docs[0] as any
      return json({
        accountId: account.id,
        timezone: row?.timezone || 'UTC',
        digestDay: row?.digestDay ?? 1,
        digestHourUtc: row?.digestHourUtc ?? 6,
        email: {
          digest: Boolean(row?.email?.digest),
          deadline: Boolean(row?.email?.deadline),
          announcement: Boolean(row?.email?.announcement),
        },
        emailVerified: Boolean(account.emailVerifiedAt),
        deliveryConfigured: Boolean(
          process.env.SMTP_URL || process.env.SMTP_HOST,
        ),
      })
    }),
  },
  {
    path: '/member/notifications/preferences',
    method: 'patch',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const b = ((await req.json?.()) || {}) as any
      if (
        !account.emailVerifiedAt &&
        Object.values(b?.email || {}).some(Boolean)
      ) {
        return json(
          {
            error: {
              code: 'email_unverified',
              message:
                'Verify your email address before enabling email updates.',
            },
          },
          { status: 409 },
        )
      }
      const timezone = String(b.timezone || 'UTC').trim()
      const digestDay = Number(b.digestDay ?? 1)
      const digestHourUtc = Number(b.digestHourUtc ?? 6)
      try {
        new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
      } catch {
        throw fail.validation({ timezone: 'Invalid timezone.' })
      }
      if (!Number.isInteger(digestDay) || digestDay < 0 || digestDay > 6)
        throw fail.validation({ digestDay: 'Digest day must be between 0 and 6.' })
      if (!Number.isInteger(digestHourUtc) || digestHourUtc < 0 || digestHourUtc > 23)
        throw fail.validation({ digestHourUtc: 'Digest hour must be between 0 and 23.' })
      const email = {
        digest: Boolean(b.email?.digest),
        deadline: Boolean(b.email?.deadline),
        announcement: Boolean(b.email?.announcement),
      }
      const { docs } = await req.payload.find({
        collection: 'notification-prefs',
        where: { account: { equals: account.id } },
        limit: 1,
        overrideAccess: true,
      })
      const data = { account: account.id, timezone, digestDay, digestHourUtc, email }
      const row = docs[0] as any
      const saved = row
        ? await req.payload.update({
            collection: 'notification-prefs',
            id: row.id,
            data: data as any,
            overrideAccess: true,
            req,
          })
        : await req.payload.create({
            collection: 'notification-prefs',
            data: data as any,
            overrideAccess: true,
            req,
          })
      return json({ preferences: saved })
    }),
  },

  // ── Focal point overview ──────────────────────────────────────────
  {
    path: '/member/focal/overview',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      if (account.role !== 'focal_point' && account.role !== 'admin')
        throw fail.forbidden()
      const [feed, events, submissions, decisions, groups, directory] =
        await Promise.all([
          store.getFeed(req, new Date(), true),
          store.listEvents(req),
          store.listSubmissions(req, 'open'),
          store.listDecisions(req, 'all', true),
          store.listGroups(req),
          store.listDirectory(req),
        ])
      return json({
        feed,
        events: events.filter((e) => Date.parse(e.startsAt) >= Date.now()),
        submissions: submissions.slice(0, 8),
        decisions: decisions.filter(
          (d) => !['adopted', 'not_adopted', 'withdrawn'].includes(d.status),
        ),
        groups,
        mandateContacts: directory.slice(0, 12),
      })
    }),
  },

  // ── Membership appeal ─────────────────────────────────────────────
  {
    path: '/member/membership/appeal',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      return json({
        membershipStatus: account.membershipStatus,
        membershipEndReason: account.membershipEndReason || null,
        appeal: await getOwnAppeal(account.id),
      })
    }),
  },
  {
    // Raw file body: X-Identity-Kind + X-Appeal-Statement (URI-encoded) headers,
    // Content-Type = the file's type. Matches the legacy SPA apiPostFile call.
    path: '/member/membership/appeal',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      if (account.membershipStatus !== 'rejected') {
        throw new ApiError(
          409,
          'not_rejected',
          'Only a rejected application can be appealed.',
        )
      }
      const bytes = Buffer.from(await (req as any).arrayBuffer())
      const identityKind = String(req.headers.get('x-identity-kind') || '')
      const statement = decodeURIComponent(
        String(req.headers.get('x-appeal-statement') || ''),
      )
      const appeal = await submitAppeal({
        account,
        statement,
        identityKind,
        bytes,
        contentType: String(req.headers.get('content-type') || ''),
      })
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'membership.appeal_submitted',
          targetType: 'membership_appeal',
          targetId: String(appeal.id),
        } as any,
        overrideAccess: true,
        req,
      })
      return Response.json({ appeal }, { status: 201 })
    }),
  },

  // ── Member profile photo (bytea, never the public media store) ──
  {
    path: '/member/profile/photo',
    method: 'put',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const bytes = Buffer.from(await (req as any).arrayBuffer())
      const photo = await saveMemberPhoto(
        account.id,
        bytes,
        String(req.headers.get('content-type') || ''),
        account.id,
      )
      await req.payload.create({
        collection: 'audit-log',
        data: {
          actor: account.id,
          action: 'member.profile_photo_updated',
          targetType: 'member_profile',
          targetId: String(account.id),
          after: {
            contentType: photo.content_type,
            byteSize: photo.byte_size,
            revision: photo.revision,
          },
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ profile: await getOwnMemberProfile(accountView(account)) })
    }),
  },
  {
    path: '/member/profile/photo',
    method: 'delete',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const removed = await deleteMemberPhoto(account.id)
      if (removed)
        await req.payload.create({
          collection: 'audit-log',
          data: {
            actor: account.id,
            action: 'member.profile_photo_removed',
            targetType: 'member_profile',
            targetId: String(account.id),
          } as any,
          overrideAccess: true,
          req,
        })
      return json({
        ok: true,
        profile: await getOwnMemberProfile(accountView(account)),
      })
    }),
  },
  {
    path: '/member/people/:id/photo',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const access = await getAccessProfile(req, account)
      const id = Number(req.routeParams?.id)
      const person = await getMemberPerson({ ...accountView(account), access }, id)
      if (!person)
        throw fail.notFound('Profile photo not found.')
      const photo = await readMemberPhoto(id)
      if (!photo)
        throw fail.notFound('Profile photo not found.')
      return new Response(new Uint8Array(photo.bytes), {
        headers: {
          'Content-Type': photo.content_type,
          'Content-Length': String(photo.byte_size),
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, no-store',
        },
      })
    }),
  },
]
