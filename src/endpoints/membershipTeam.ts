import type { Endpoint } from 'payload'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import { accountView, requireTeam } from '../lib/accounts'
import { audit } from '../lib/audit'
import {
  updateMembershipLifecycle,
  setAccountFields,
  sendMembershipActivatedEmail,
  findAccountRowById,
} from '../lib/membership'
import { listMembershipReviewItems, listMemberProfileSummaries } from '../lib/membershipReview'
import type { Doc } from '../lib/domain'
import {
  listLatestAppealsForAccounts,
  readAppealProof,
  reviewAppeal,
} from '../lib/membershipAppeals'

export const membershipTeamEndpoints: Endpoint[] = [
  // ── Membership team ───────────────────────────────────────────────
  {
    path: '/member/team/membership/overview',
    method: 'get',
    handler: endpoint(async (req) => {
      await requireTeam(req, 'membership_team')
      const items = await listMembershipReviewItems()
      const profiles = await listMemberProfileSummaries(items)
      const appeals = await listLatestAppealsForAccounts(items.map((item) => item.id))
      return json({
        items: items.map((item) => ({
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
      const id = param(req, 'id')
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
        verifyBody = await readBody(req)
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
      const id = param(req, 'id')
      const b = await readBody(req)
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
      const proof = await readAppealProof(param(req, 'id'))
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
      const b = await readBody(req)
      const appeal = await reviewAppeal({
        id: param(req, 'id'),
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
          appeal.status === 'granted' ? 'membership.appeal_granted' : 'membership.appeal_upheld',
        targetType: 'membership_appeal',
        targetId: String(appeal.id),
        after: { status: appeal.status, accountId: appeal.accountId },
        reason: b.note,
      })
      return json({ appeal, account: updated, emailSent })
    }),
  },
]
