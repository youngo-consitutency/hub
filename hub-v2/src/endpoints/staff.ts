import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import { accountView, requireAccount } from '../lib/accounts'
import { getAccessProfile, canManageWg } from '../lib/access'
import * as store from '../lib/content'
import { rateLimit } from '../lib/rateLimit'
import {
  listMembershipReviewItems,
  listMemberProfileSummaries,
  listLatestAppealsForAccounts,
  listAccountsForAdmin,
  queryAccountsForAdmin,
  readAppealProof,
  reviewAppeal,
  updateMembershipLifecycle,
  setAccountFields,
  setTeamAssignment,
  ensureOwnerSeat,
  sendMembershipActivatedEmail,
  findAccountRowById,
} from '../lib/membership'
import { emailConfigured, sendEmail } from '../lib/email'
import { createHash } from 'node:crypto'
import { randomBytes } from 'node:crypto'
import { contributionsFromCsv, previewCsvImport } from '../lib/gysImport.js'
import { synthesizeGysContributions } from '../lib/gysSynthesis.js'

const isVerified = (account: any) =>
  account?.hubAccessStatus === 'active' &&
  (account?.memberStatus === 'verified' ||
    ['admin', 'focal_point'].includes(account?.role))

const verifiedAccount = (req: PayloadRequest) => {
  const account = requireAccount(req)
  if (!isVerified(account))
    throw new ApiError(
      403,
      'not_verified',
      'Complete the membership course to use this feature.',
    )
  return account
}

async function requireTeam(req: PayloadRequest, teamRole: string) {
  const account = verifiedAccount(req)
  const access = await getAccessProfile(req, account)
  if (account.role !== 'admin' && !access.teamRoles.includes(teamRole))
    throw fail.forbidden('This team workspace is not assigned to your account.')
  return { account, access }
}

async function requireAdmin(req: PayloadRequest) {
  const account = verifiedAccount(req)
  if (account.role !== 'admin')
    throw fail.forbidden('This console is for administrators.')
  return account
}

async function audit(req: PayloadRequest, actor: any, entry: Record<string, any>) {
  await req.payload.create({
    collection: 'audit-log',
    data: {
      actor: actor?.id,
      actorEmail: actor?.email,
      requestId: (req.headers.get('x-request-id') as string) || null,
      ...entry,
    } as any,
    overrideAccess: true,
    req,
  })
}

function adminReason(body: any): string {
  const reason = String(body?.reason || '').trim()
  if (reason.length < 8)
    throw fail.validation({
      _: 'Give a reason of at least 8 characters for this admin action.',
    })
  return reason.slice(0, 500)
}

const adminLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  scope: 'admin',
})

const ROLE_OPTIONS = [
  'member',
  'admin',
  'focal_point',
  'wg_contact',
  'ngo_admin',
]
const TEAM_ROLE_OPTIONS = [
  'membership_team',
  'gys_policy_team',
  'cp_team',
  'partnerships_team',
  'comms_team',
]
const MEMBERSHIP_STATUS_OPTIONS = [
  'registered',
  'course_passed',
  'awaiting_onboarding',
  'active',
  'renewal_due',
  'expired',
  'terminated',
  'rejected',
]

export const staffEndpoints: Endpoint[] = [
  // ── Admin: accounts ───────────────────────────────────────────────
  {
    path: '/member/admin/accounts',
    method: 'get',
    handler: endpoint(async (req) => {
      adminLimit(req)
      await requireAdmin(req)
      return json(
        await queryAccountsForAdmin({
          search: req.query?.search,
          entityType: req.query?.entityType,
          status: req.query?.status,
          role: req.query?.role,
          sort: req.query?.sort,
          page: req.query?.page,
          pageSize: req.query?.pageSize,
        }),
      )
    }),
  },
  {
    path: '/member/admin/audit',
    method: 'get',
    handler: endpoint(async (req) => {
      adminLimit(req)
      await requireAdmin(req)
      const where: any = {}
      if (req.query?.action) where.action = { contains: req.query.action }
      if (req.query?.actorId) where.actor = { equals: req.query.actorId }
      const { docs } = await req.payload.find({
        collection: 'audit-log',
        where,
        sort: '-createdAt',
        limit: Math.min(500, Number(req.query?.limit || 200)),
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/admin/accounts/:id/verify',
    method: 'post',
    handler: endpoint(async (req) => {
      adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      const before = await findAccountRowById(id)
      if (!before) throw fail.notFound('Account not found.')
      const updatedRow = await setAccountFields(id, {
        member_status: 'verified',
        hub_access_status: 'active',
        membership_status: 'active',
        verified_at: new Date().toISOString(),
        verified_by: 'staff',
      })
      const updated = accountView(updatedRow)
      await audit(req, admin, {
        action: 'membership.status_changed',
        targetType: 'account',
        targetId: id,
        before: accountView(before),
        after: updated,
        reason,
      })
      const mail = await sendMembershipActivatedEmail(updated)
      return json({ account: updated, emailSent: mail.sent })
    }),
  },
  {
    path: '/member/admin/accounts/:id/status',
    method: 'patch',
    handler: endpoint(async (req) => {
      adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      const result = await updateMembershipLifecycle({
        actor: accountView(admin),
        targetId: id,
        body: { ...b, reason },
      })
      await audit(req, admin, {
        action: 'membership.status_changed',
        targetType: 'account',
        targetId: id,
        before: result.before,
        after: result.updated,
        reason,
      })
      return json({ account: result.updated })
    }),
  },
  {
    path: '/member/admin/accounts/:id/role',
    method: 'post',
    handler: endpoint(async (req) => {
      adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      const role = String(b.role || 'member')
      if (!ROLE_OPTIONS.includes(role))
        throw fail.validation({ role: 'Invalid role.' })
      const items = await listAccountsForAdmin()
      const target = items.find((item: any) => String(item.id) === id)
      if (!target) throw fail.notFound('Account not found.')
      if (target.id === admin.id && role !== 'admin')
        throw new ApiError(400, 'self_demote', 'You cannot remove your own admin access.')
      if (
        role === 'ngo_admin' &&
        (target.entityType !== 'organization' || !target.isVerified)
      )
        throw fail.validation({
          role: 'Only a verified organisation account can become an NGO administrator.',
        })
      const updatedRow = await setAccountFields(id, { role })
      const updated = accountView(updatedRow)
      if (role === 'ngo_admin') await ensureOwnerSeat(updated)
      await audit(req, admin, {
        action: 'account.platform_role_changed',
        targetType: 'account',
        targetId: id,
        before: { role: target.role },
        after: { role },
        reason,
      })
      return json({ account: updated })
    }),
  },
  {
    path: '/member/admin/accounts/:id/team-role',
    method: 'post',
    handler: endpoint(async (req) => {
      adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      const teamRole = String(b.teamRole || '')
      if (
        ![
          'membership_team',
          'gys_policy_team',
          'content_editor',
          'content_publisher',
        ].includes(teamRole)
      )
        throw fail.validation({ teamRole: 'Invalid team role.' })
      const items = await listAccountsForAdmin()
      const target = items.find((item: any) => String(item.id) === id)
      if (!target) throw fail.notFound('Account not found.')
      const roles = new Set(target.teamRoles || [])
      if (b.enabled === false) roles.delete(teamRole)
      else roles.add(teamRole)
      const updatedRow = await setAccountFields(id, { team_roles: [...roles] })
      await setTeamAssignment({
        accountId: id,
        teamRole,
        enabled: b.enabled !== false,
        assignedBy: admin.id,
      })
      await audit(req, admin, {
        action: 'account.team_assignment_changed',
        targetType: 'account',
        targetId: id,
        before: { teamRoles: target.teamRoles },
        after: { teamRoles: [...roles] },
        reason,
      })
      return json({ account: accountView(updatedRow) })
    }),
  },
  {
    path: '/member/admin/accounts/:id/reset-link',
    method: 'post',
    handler: endpoint(async (req) => {
      adminLimit(req)
      const admin = await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const reason = adminReason(b)
      if (!emailConfigured())
        throw new ApiError(503, 'email_not_configured', 'Email delivery must be configured before issuing a reset.')
      const targetRow = await findAccountRowById(id)
      if (!targetRow) throw fail.notFound('Account not found.')
      const target = accountView(targetRow)!
      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
      const reset = await req.payload.create({
        collection: 'password-resets' as never,
        data: {
          account: target.id,
          email: target.email,
          tokenHash,
          expiresAt: expiresAt.toISOString(),
        } as never,
        overrideAccess: true,
        req,
      })
      const url = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(rawToken)}`
      try {
        await sendEmail({
          to: target.email,
          subject: 'Reset your YOUNGO Hub password',
          text: `Reset your password: ${url}\n\nThis link expires in 1 hour.`,
        })
      } catch {
        await req.payload.delete({
          collection: 'password-resets' as never,
          id: (reset as any).id,
          overrideAccess: true,
          req,
        })
        throw new ApiError(502, 'email_delivery_failed', 'The email provider did not accept the reset message.')
      }
      await audit(req, admin, {
        action: 'account.password_reset_issued',
        targetType: 'account',
        targetId: id,
        after: { expiresAt: expiresAt.toISOString() },
        reason,
      })
      return json({
        ok: true,
        expiresAt: expiresAt.toISOString(),
        message: 'Password-reset instructions were sent to the account address.',
      })
    }),
  },

  // ── Membership team ───────────────────────────────────────────────
  {
    path: '/member/team/membership/overview',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireTeam(req, 'membership_team')
      const items = await listMembershipReviewItems()
      const profiles = await listMemberProfileSummaries(items)
      const appeals = await listLatestAppealsForAccounts(
        items.map((item: any) => item.id),
      )
      return json({
        items: items.map((item: any) => ({
          ...item,
          profile: profiles.get(item.id),
          appeal: appeals.get(item.id) || null,
        })),
      })
    }),
  },
  {
    path: '/member/team/membership/accounts/:id/verify',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'membership_team')
      const id = String(req.routeParams?.id)
      const updatedRow = await setAccountFields(id, {
        member_status: 'verified',
        hub_access_status: 'active',
        membership_status: 'active',
        constituency_work_status: 'active',
        verified_at: new Date().toISOString(),
        verified_by: staff.email,
      })
      if (!updatedRow) throw fail.notFound('Account not found.')
      const updated = accountView(updatedRow)
      let verifyBody: any = {}
      try {
        verifyBody = (await req.json?.()) || {}
      } catch {
        verifyBody = {}
      }
      await audit(req, staff, {
        action: 'membership.status_changed',
        targetType: 'account',
        targetId: id,
        after: updated,
        reason: verifyBody?.reason,
      })
      const mail = await sendMembershipActivatedEmail(updated)
      return json({ account: updated, emailSent: mail.sent })
    }),
  },
  {
    path: '/member/team/membership/accounts/:id/status',
    method: 'patch',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'membership_team')
      const id = String(req.routeParams?.id)
      const b = ((await req.json?.()) || {}) as any
      const result = await updateMembershipLifecycle({
        actor: accountView(staff),
        targetId: id,
        body: b,
      })
      await audit(req, staff, {
        action: 'membership.status_changed',
        targetType: 'account',
        targetId: id,
        before: result.before,
        after: result.updated,
        reason: result.reason,
      })
      return json({ account: result.updated, emailSent: result.emailSent })
    }),
  },
  {
    path: '/member/team/membership/appeals/:id/proof',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireTeam(req, 'membership_team')
      const proof = await readAppealProof(String(req.routeParams?.id))
      if (!proof) throw fail.notFound('Appeal proof not found.')
      return new Response(new Uint8Array(proof.proof_bytes), {
        headers: {
          'Content-Type': proof.proof_content_type,
          'Content-Length': String(proof.proof_byte_size),
          'Cache-Control': 'private, no-store',
        },
      })
    }),
  },
  {
    path: '/member/team/membership/appeals/:id/review',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'membership_team')
      const b = ((await req.json?.()) || {}) as any
      const appeal = await reviewAppeal({
        id: String(req.routeParams?.id),
        decision: b.decision,
        note: b.note,
        reviewerId: staff.id,
      })
      if (!appeal) throw fail.notFound('Appeal not found.')
      let updated: any = null
      let emailSent: boolean | null = null
      if (appeal.status === 'granted') {
        const targetRow = await findAccountRowById(appeal.accountId)
        const target = accountView(targetRow)
        const result = await updateMembershipLifecycle({
          actor: accountView(staff),
          targetId: appeal.accountId,
          body: {
            status: target?.coursePassedAt ? 'active' : 'registered',
            reason: b.note,
          },
        })
        updated = result.updated
        emailSent = result.emailSent
      }
      await audit(req, staff, {
        action:
          appeal.status === 'granted'
            ? 'membership.appeal_granted'
            : 'membership.appeal_upheld',
        targetType: 'membership_appeal',
        targetId: String(appeal.id),
        after: { status: appeal.status, accountId: appeal.accountId },
        reason: b.note,
      })
      return json({ appeal, account: updated, emailSent })
    }),
  },

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
        formUrl:
          gys?.current?.inputsUrl || 'https://forms.gle/7Hw2ZQoxPvWzaotL9',
        submissions: await store.listSubmissions(req, 'open'),
        decisions: await store.listCouncil(req, 'active'),
      })
    }),
  },
  {
    path: '/member/team/gys/inputs/preview',
    method: 'post',
    handler: endpoint(async (req) => {
      await requireTeam(req, 'gys_policy_team')
      const b = ((await req.json?.()) || {}) as any
      const preview = previewCsvImport(b.csvText, b.columnMap)
      if (!preview.ok)
        throw fail.validation({ csvText: preview.error || 'Invalid CSV.' })
      return json(preview)
    }),
  },
  {
    path: '/member/team/gys/inputs/import',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account: staff } = await requireTeam(req, 'gys_policy_team')
      const b = ((await req.json?.()) || {}) as any
      const workflow = await getGysWorkflow(req)
      let parsed: any
      try {
        parsed = contributionsFromCsv(b.csvText, b.columnMap)
      } catch (err: any) {
        throw fail.validation({ csvText: err.message })
      }
      const imported: any[] = []
      const errors: any[] = []
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
              } as any,
              overrideAccess: true,
              req,
            }),
          )
        } catch (err: any) {
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
      const b = ((await req.json?.()) || {}) as any
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
      if (!allowed.includes(b.status))
        throw fail.validation({ status: 'Invalid cycle status.' })
      const workflow = await getGysWorkflow(req)
      const updated = await req.payload.update({
        collection: 'gys-workflow-cycles',
        id: workflow.cycle.id,
        data: { status: b.status } as any,
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
      const b = ((await req.json?.()) || {}) as any
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
          theme: String(b.theme || '').trim().slice(0, 160) || null,
          region: String(b.region || '').trim().slice(0, 120) || null,
          country: String(b.country || '').trim().slice(0, 120) || null,
          submitterType: String(b.submitterType || '').trim().slice(0, 60) || null,
          organization: String(b.organization || '').trim().slice(0, 200) || null,
          source: String(b.source || 'manual').slice(0, 60),
          externalId: b.externalId ? String(b.externalId).slice(0, 200) : null,
          rawAnswers: b.rawAnswers || null,
          author: staff.id,
          status: 'submitted',
          version: 1,
        } as any,
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
      const b = ((await req.json?.()) || {}) as any
      const row = (await req.payload.findByID({
        collection: 'gys-tracked-contributions',
        id: String(req.routeParams?.id),
        overrideAccess: true,
        req,
      })) as any
      if (!row) throw fail.notFound()
      const status = String(b.status || '')
      if (!GYS_STATUSES.includes(status))
        throw fail.validation({ status: 'Invalid contribution status.' })
      if (
        status !== row.status &&
        !(GYS_TRANSITIONS[row.status] || []).includes(status)
      )
        throw fail.validation({
          status: `Cannot move from ${row.status} to ${status}.`,
        })
      const updated = await req.payload.update({
        collection: 'gys-tracked-contributions',
        id: row.id,
        data: {
          status,
          reviewer: staff.id,
          version: (row.version || 1) + (status !== row.status ? 1 : 0),
        } as any,
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

  // ── Contact point (WG management) ─────────────────────────────────
  {
    path: '/member/cp/:wg/members',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const wg = String(req.routeParams?.wg)
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg))
        throw fail.forbidden('You are not a contact point for this working group.')
      const { docs } = await req.payload.find({
        collection: 'wg-progress',
        where: { wgSlug: { equals: wg } },
        sort: '-joinedAt',
        limit: 500,
        overrideAccess: true,
        depth: 1,
      })
      return json({
        members: (docs as any[]).map((d) => ({
          progress: {
            wg_slug: d.wgSlug,
            status: d.status,
            role_in_wg: d.roleInWg,
            joined_at: d.joinedAt,
            presentation_ok: d.presentationOk,
            rules_ok: d.rulesOk,
            unlocked_at: d.unlockedAt,
          },
          account:
            d.account && typeof d.account === 'object'
              ? accountView(d.account)
              : null,
        })),
      })
    }),
  },
  {
    path: '/member/cp/:wg/members/:accountId/role',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const wg = String(req.routeParams?.wg)
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg)) throw fail.forbidden()
      const accountId = String(req.routeParams?.accountId)
      const b = ((await req.json?.()) || {}) as any
      const roleInWg = ['member', 'contact_point', 'observer'].includes(b.roleInWg)
        ? b.roleInWg
        : 'member'
      const { docs } = await req.payload.find({
        collection: 'wg-progress',
        where: { wgSlug: { equals: wg }, account: { equals: accountId } },
        limit: 1,
        overrideAccess: true,
      })
      if (!docs[0]) throw fail.notFound()
      const updated = await req.payload.update({
        collection: 'wg-progress',
        id: (docs[0] as any).id,
        data: { roleInWg } as any,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'wg.role_update',
        targetType: 'wg_progress',
        targetId: String((docs[0] as any).id),
        after: { wg, roleInWg },
      })
      return json({ progress: updated })
    }),
  },
  {
    path: '/member/cp/:wg/activities',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const wg = String(req.routeParams?.wg)
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg)) throw fail.forbidden()
      const { docs } = await req.payload.find({
        collection: 'wg-activities',
        where: { wg: { equals: wg } },
        sort: '-createdAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/cp/:wg/activities',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const wg = String(req.routeParams?.wg)
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg)) throw fail.forbidden()
      const b = ((await req.json?.()) || {}) as any
      const title = String(b.title || '').trim().slice(0, 200)
      if (!title) throw fail.validation({ title: 'Title is required.' })
      const created = await req.payload.create({
        collection: 'wg-activities',
        data: {
          wg,
          title,
          summary: String(b.summary || '').slice(0, 4000),
          happenedAt: b.happenedAt || null,
          createdBy: account.id,
        } as any,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'wg.activity_add',
        targetType: 'wg_activity',
        targetId: String(created.id),
        after: { wg, title },
      })
      return json({ item: created }, { status: 201 })
    }),
  },
  {
    path: '/member/cp/:wg/public-space',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const wg = String(req.routeParams?.wg)
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg)) throw fail.forbidden()
      const b = ((await req.json?.()) || {}) as any
      const { docs } = await req.payload.find({
        collection: 'working-groups',
        where: { slug: { equals: wg } },
        limit: 1,
        overrideAccess: true,
      })
      if (!docs[0]) throw fail.notFound('Unknown working group.')
      const data: any = { publicSpace: Boolean(b.publicSpace) }
      const updated = await req.payload.update({
        collection: 'working-groups',
        id: (docs[0] as any).id,
        data,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'wg.public_space',
        targetType: 'working_group',
        targetId: String((docs[0] as any).id),
        after: { wg, publicSpace: data.publicSpace },
      })
      return json({ group: updated })
    }),
  },

  // ── CP calls ──────────────────────────────────────────────────────
  {
    path: '/member/cp-calls/slots',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const { docs } = await req.payload.find({
        collection: 'cp-call-slots',
        where: { startsAt: { greater_than: new Date(Date.now() - 24 * 3600 * 1000).toISOString() } },
        sort: 'startsAt',
        limit: 100,
        overrideAccess: true,
        depth: 1,
      })
      const slots = docs as any[]
      return json({
        slots: slots
          .filter((s) => !s.bookedBy || typeof s.bookedBy !== 'object' || s.bookedBy.id !== account.id)
          .map(publicSlot),
        mine: slots
          .filter(
            (s) =>
              s.bookedBy &&
              typeof s.bookedBy === 'object' &&
              String(s.bookedBy.id) === String(account.id),
          )
          .map(publicSlot),
      })
    }),
  },
  {
    path: '/member/cp-calls/slots/:id/book',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const id = String(req.routeParams?.id)
      const slot = (await req.payload.findByID({
        collection: 'cp-call-slots',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!slot) throw fail.notFound()
      if (slot.bookedBy)
        throw new ApiError(409, 'conflict', 'This slot was already booked.')
      if (Date.parse(slot.startsAt) < Date.now())
        throw fail.validation({ startsAt: 'This slot is in the past.' })
      const updated = await req.payload.update({
        collection: 'cp-call-slots',
        id,
        data: { bookedBy: account.id, bookedAt: new Date().toISOString() } as any,
        overrideAccess: true,
        req,
      })
      return json({ slot: updated }, { status: 201 })
    }),
  },
  {
    path: '/member/cp-calls/mine/cancel',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = verifiedAccount(req)
      const b = ((await req.json?.()) || {}) as any
      const id = String(b.slotId || '')
      const slot = (await req.payload.findByID({
        collection: 'cp-call-slots',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!slot) throw fail.notFound()
      const bookedById =
        typeof slot.bookedBy === 'object' ? slot.bookedBy.id : slot.bookedBy
      if (String(bookedById) !== String(account.id)) throw fail.forbidden()
      const released = await req.payload.update({
        collection: 'cp-call-slots',
        id,
        data: { bookedBy: null, bookedAt: null } as any,
        overrideAccess: true,
        req,
      })
      return json({ released })
    }),
  },
  {
    path: '/member/admin/cp-calls',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireAdmin(req)
      const { docs } = await req.payload.find({
        collection: 'cp-call-slots',
        sort: 'startsAt',
        limit: 200,
        overrideAccess: true,
        depth: 1,
      })
      return json({ slots: (docs as any[]).map(publicSlot) })
    }),
  },
  {
    path: '/member/admin/cp-calls/mine',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = await requireAdmin(req)
      const { docs } = await req.payload.find({
        collection: 'cp-call-slots',
        where: { host: { equals: account.id } },
        sort: 'startsAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({ slots: (docs as any[]).map(publicSlot) })
    }),
  },
  {
    path: '/member/admin/cp-calls',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = await requireAdmin(req)
      const b = ((await req.json?.()) || {}) as any
      const slots = Array.isArray(b.slots) ? b.slots : [b]
      const created: any[] = []
      for (const s of slots) {
        const startsAt = Date.parse(s.startsAt)
        const duration = Number(s.durationMinutes || 30)
        if (!Number.isFinite(startsAt) || startsAt < Date.now())
          throw fail.validation({ startsAt: 'Each slot needs a future start time.' })
        if (duration < 10 || duration > 240)
          throw fail.validation({ durationMinutes: 'Duration must be 10–240 minutes.' })
        created.push(
          await req.payload.create({
            collection: 'cp-call-slots',
            data: {
              startsAt: new Date(startsAt).toISOString(),
              durationMinutes: duration,
              host: account.id,
              meetUrl: String(s.meetUrl || '').slice(0, 500) || null,
            } as any,
            overrideAccess: true,
            req,
          }),
        )
      }
      return json({ slots: created }, { status: 201 })
    }),
  },
  {
    path: '/member/admin/cp-calls/:id/cancel',
    method: 'post',
    handler: endpoint(async (req) => {
      await requireAdmin(req)
      const id = String(req.routeParams?.id)
      const slot = (await req.payload.findByID({
        collection: 'cp-call-slots',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!slot) throw fail.notFound()
      await req.payload.delete({
        collection: 'cp-call-slots',
        id,
        overrideAccess: true,
        req,
      })
      return json({ cancelled: true })
    }),
  },
]

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

const publicCycleView = (row: any) =>
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

const publicContributionView = (row: any) => ({
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
  reviewerId:
    typeof row.reviewer === 'object' ? row.reviewer?.id : row.reviewer,
  status: row.status,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

async function getGysWorkflow(req: PayloadRequest): Promise<{
  cycle: NonNullable<ReturnType<typeof publicCycleView>>
  contributions: any[]
  statuses: string[]
  synthesis: any
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
      } as any,
      overrideAccess: true,
      req,
    })
    docs = [created]
  }
  const cycle = docs[0] as any
  const { docs: contributions } = await req.payload.find({
    collection: 'gys-tracked-contributions',
    where: { cycle: { equals: cycle.id } },
    sort: '-updatedAt',
    limit: 1000,
    overrideAccess: true,
    depth: 1,
  })
  const items = (contributions as any[]).map(publicContributionView)
  return {
    cycle: publicCycleView(cycle)!,
    contributions: items,
    statuses: GYS_STATUSES,
    synthesis: synthesizeGysContributions(items),
  }
}

function publicSlot(s: any) {
  return {
    id: s.id,
    startsAt: s.startsAt,
    durationMinutes: s.durationMinutes,
    meetUrl: s.meetUrl || null,
    host:
      s.host && typeof s.host === 'object'
        ? { id: s.host.id, name: s.host.name, email: s.host.email }
        : null,
    bookedBy:
      s.bookedBy && typeof s.bookedBy === 'object'
        ? { id: s.bookedBy.id, name: s.bookedBy.name, email: s.bookedBy.email }
        : null,
    bookedAt: s.bookedAt || null,
  }
}
