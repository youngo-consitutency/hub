import { findAccountById } from './accounts.js'
import { syncWgAssignment } from './access.js'
import { recordAudit } from './audit.js'
import { setAccountFields, upsertWgProgress } from './lifecycle.js'
import { plannedMandateActions } from './mandateRoster.js'

export async function applyMandateFromRoster(accountId, { requestId } = {}) {
  const row = await findAccountById(accountId)
  if (!row) return { matched: false, applied: false }
  const plan = plannedMandateActions(row)
  if (!plan.matched) return { matched: false, applied: false, claims: [] }
  if (!plan.fields) {
    return {
      matched: true,
      applied: false,
      blocked: plan.blocked,
      emailVerified: plan.emailVerified,
      claims: plan.claims,
    }
  }

  const updated = await setAccountFields(accountId, plan.fields)
  for (const assignment of plan.wgAssignments) {
    await upsertWgProgress(accountId, assignment.wgSlug, {
      presentation_ok: true,
      rules_ok: true,
      status: 'active',
      role_in_wg: 'contact',
    })
    await syncWgAssignment({
      accountId,
      wgSlug: assignment.wgSlug,
      role: 'contact',
      status: 'active',
      assignedBy: accountId,
    })
  }

  await recordAudit({
    actorId: accountId,
    action: 'account.mandate_self_verified',
    targetType: 'account',
    targetId: accountId,
    before: { role: row.role || row.role },
    after: {
      role: plan.fields.role,
      wgAssignments: plan.wgAssignments,
      verifiedBy: 'mandate_roster_2026',
    },
    reason:
      'Official 2026 WG/OT roster email match after the account holder confirmed the inbox.',
    requestId: requestId || null,
  })

  return {
    matched: true,
    applied: true,
    account: updated,
    claims: plan.claims,
    wgAssignments: plan.wgAssignments,
  }
}
