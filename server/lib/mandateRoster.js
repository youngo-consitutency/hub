import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rosterPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/mandate-roster.json',
)

const BLOCKED_MEMBERSHIP = new Set(['terminated', 'rejected', 'expired'])
const PROTECTED_ROLES = new Set(['admin', 'ngo_admin'])

let cached = null

export function loadMandateRoster() {
  if (cached) return cached
  if (!existsSync(rosterPath)) {
    cached = { source: { year: 2026, version: 'missing' }, mandates: [] }
    return cached
  }
  cached = JSON.parse(readFileSync(rosterPath, 'utf8'))
  return cached
}

export function normalizeMandateEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

export function mandatesForEmail(email) {
  const key = normalizeMandateEmail(email)
  if (!key) return []
  return loadMandateRoster().mandates.filter(
    (item) => normalizeMandateEmail(item.email) === key,
  )
}

function accountEmail(account) {
  return account?.email || ''
}

function accountRole(account) {
  return account?.role || 'member'
}

function membershipStatusOf(account) {
  return (
    account?.membership_status || account?.membershipStatus || 'registered'
  )
}

function emailVerifiedOf(account) {
  return Boolean(account?.email_verified_at || account?.emailVerifiedAt)
}

export function plannedMandateActions(account) {
  const mandates = mandatesForEmail(accountEmail(account))
  if (!mandates.length) {
    return {
      matched: false,
      blocked: null,
      emailVerified: emailVerifiedOf(account),
      claims: [],
      fields: null,
      wgAssignments: [],
    }
  }

  const emailVerified = emailVerifiedOf(account)
  const blockedStatus = membershipStatusOf(account)
  const blocked = BLOCKED_MEMBERSHIP.has(blockedStatus) ? blockedStatus : null
  const claims = mandates.map((item) => ({
    kind: item.kind,
    wgSlug: item.wgSlug,
    wgName: item.wgName,
    title: item.title,
    name: item.name,
    status: blocked
      ? 'blocked'
      : emailVerified
        ? 'active'
        : 'pending_email',
  }))

  if (!emailVerified || blocked) {
    return {
      matched: true,
      blocked,
      emailVerified,
      claims,
      fields: null,
      wgAssignments: [],
    }
  }

  const kinds = new Set(mandates.map((item) => item.kind))
  const currentRole = accountRole(account)
  let role = currentRole
  if (!PROTECTED_ROLES.has(currentRole)) {
    if (kinds.has('focal_point')) role = 'focal_point'
    else if (kinds.has('wg_contact') && currentRole === 'member')
      role = 'wg_contact'
  }

  const fields = {
    role,
    member_status: 'verified',
    hub_access_status: 'active',
    membership_status: 'active',
    verified_by: 'mandate_roster_2026',
  }
  if (!account?.verified_at && !account?.verifiedAt) {
    fields.verified_at = new Date().toISOString()
  }

  const seen = new Set()
  const wgAssignments = []
  for (const item of mandates) {
    if (item.kind !== 'wg_contact' || !item.wgSlug) continue
    if (seen.has(item.wgSlug)) continue
    seen.add(item.wgSlug)
    wgAssignments.push({
      wgSlug: item.wgSlug,
      role: 'contact',
      status: 'active',
    })
  }

  return {
    matched: true,
    blocked: null,
    emailVerified: true,
    claims,
    fields,
    wgAssignments,
  }
}

export function mandateSummaryForAccount(account) {
  const plan = plannedMandateActions(account)
  const source = loadMandateRoster().source || {}
  if (!plan.matched) return null
  return {
    sourceYear: source.year || 2026,
    sourceVersion: source.version || null,
    emailVerified: plan.emailVerified,
    blocked: plan.blocked,
    claims: plan.claims,
  }
}
