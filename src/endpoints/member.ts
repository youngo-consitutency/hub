import type { Endpoint, PayloadRequest } from 'payload'
import { endpoint, fail, json } from '../lib/respond'
import {
  accountView,
  isVerifiedAccount,
  requireAccount,
  requireVerifiedMember,
} from '../lib/accounts'
import { getAccessProfile } from '../lib/access'
import { toCamelCase } from '../lib/case'
import * as store from '../lib/content'
import { getDocument } from '../lib/documents'
import { getOwnMemberProfile } from '../lib/memberDirectory'
import { saveMemberPhoto, deleteMemberPhoto } from '../lib/memberPhotos'
import { audit } from '../lib/audit'
import { trimmed } from '../lib/text'
import { wgActivityView } from '../lib/views'

// Course structure (modules, quiz, pass score) is staff-editable content —
// the `membership-course` content document holds the whole definition.
type CourseDoc = {
  version: string
  passScore: number
  modules: any[]
  quiz: { id: string; prompt: string; choices: any[]; correct: string }[]
}

async function getCourse(req: PayloadRequest): Promise<CourseDoc> {
  const course = (await getDocument(req, 'membership-course'))?.body as CourseDoc | undefined
  if (!course?.quiz?.length) {
    throw fail.notFound('The onboarding course is not configured yet.')
  }
  return { ...course, modules: course.modules || [] }
}

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
  const p = toCamelCase<any>(patch)
  const presentationOk = p.presentationOk ?? existing?.presentationOk ?? false
  const rulesOk = p.rulesOk ?? existing?.rulesOk ?? false
  const unlocked =
    presentationOk && rulesOk
      ? existing?.unlockedAt || new Date().toISOString()
      : existing?.unlockedAt || null
  const status =
    p.status ?? (presentationOk && rulesOk ? 'active' : existing?.status || 'interested')
  const data = {
    account: accountId,
    wgSlug,
    presentationOk,
    rulesOk,
    unlockedAt: unlocked,
    joinedAt:
      existing?.joinedAt ||
      (p.status ? new Date().toISOString() : existing?.joinedAt) ||
      new Date().toISOString(),
    status,
    roleInWg: p.roleInWg ?? existing?.roleInWg ?? 'member',
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
        canAdminister: access.capabilities.includes('accounts.manage'),
        managedWgs: access.wgAssignments.map((i: any) => i.wgSlug).sort(),
        ngo: seat
          ? {
              orgAccountId:
                typeof seat.orgAccount === 'object' ? seat.orgAccount.id : seat.orgAccount,
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
      const course = await getCourse(req)
      return json({
        version: course.version,
        passScore: course.passScore,
        modules: course.modules,
        quiz: course.quiz.map(({ id, prompt, choices }) => ({
          id,
          prompt,
          choices,
        })),
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
      const course = await getCourse(req)
      const b = ((await req.json?.()) || {}) as any
      const answers = b?.answers || {}
      let score = 0
      for (const q of course.quiz) if (answers[q.id] === q.correct) score += 1
      const total = course.quiz.length
      const passed = score >= course.passScore
      if (!passed) {
        return json(
          {
            error: {
              code: 'quiz_failed',
              message: `You scored ${score}/${total}. You need at least ${course.passScore} correct to pass. Review the modules and try again.`,
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
      const nextStatus = ['active', 'renewal_due', 'awaiting_onboarding'].includes(status)
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
      const progress = await upsertWgProgress(req, account.id, String(req.routeParams?.wg), {
        presentationOk: Boolean(b.presentationOk),
        rulesOk: Boolean(b.rulesOk),
        status: 'active',
      })
      return json({ progress: wgProgressView(progress, account.id) })
    }),
  },
  {
    path: '/member/workspace/:wg/join',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const progress = await upsertWgProgress(req, account.id, String(req.routeParams?.wg), {
        status: 'pending_approval',
      })
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
        ? b.expertiseTags
            .map((t: unknown) => String(t).trim())
            .filter(Boolean)
            .slice(0, 20)
        : []
      const directoryVisibility = ['private', 'members', 'public'].includes(b.directoryVisibility)
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

  // ── Focal point overview ──────────────────────────────────────────
  {
    path: '/member/focal/overview',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const access = await getAccessProfile(req, account)
      // The focal overview belongs to the elected Focal Points — an
      // administrator has no mandate and gets no view.
      if (!access.isFocalPoint) throw fail.forbidden()
      const [feed, events, submissions, decisions, groups, directory] = await Promise.all([
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
      await audit(req, account, {
        action: 'member.profile_photo_updated',
        targetType: 'member_profile',
        targetId: String(account.id),
        after: {
          contentType: photo.content_type,
          byteSize: photo.byte_size,
          revision: photo.revision,
        },
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
        await audit(req, account, {
          action: 'member.profile_photo_removed',
          targetType: 'member_profile',
          targetId: String(account.id),
        })
      return json({
        ok: true,
        profile: await getOwnMemberProfile(accountView(account)),
      })
    }),
  },
]
