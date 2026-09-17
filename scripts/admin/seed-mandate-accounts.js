/**
 * Create Hub accounts for every 2026 Contact Point / Focal Point on the
 * official WG/OT roster. One account per email; dual mandates share it.
 *
 * Usage:
 *   DATABASE_URL=... MANDATE_PASSWORD='...' node scripts/admin/seed-mandate-accounts.js
 *   railway run --service youngo-hub --environment production npm run seed-mandate-accounts
 *
 * Required:
 *   MANDATE_PASSWORD           shared password (min 10 chars)
 *   MANDATE_CONFIRM_PRODUCTION=1  when NODE_ENV=production
 *
 * Optional:
 *   MANDATE_EMAILS=a@x,b@y     only these roster emails (default: whole roster)
 */
import { createAccount, findAccountByEmail } from '../../server/lib/accounts.js'
import { hashPassword } from '../../server/lib/password.js'
import { setAccountFields } from '../../server/lib/lifecycle.js'
import { applyMandateFromRoster } from '../../server/lib/applyMandate.js'
import { loadMandateRoster } from '../../server/lib/mandateRoster.js'
import { getPool } from '../../server/lib/db.js'
import { POLICY_VERSION } from '../../src/content/membershipPolicy.js'
import {
  PRIVACY_VERSION,
  CONSENT_STATEMENT,
} from '../../shared/privacyNotice.js'

const PASSWORD = String(process.env.MANDATE_PASSWORD || '')
const NOW = new Date().toISOString()

function splitName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { firstName: 'YOUNGO', lastName: 'Contact' }
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Contact' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function peopleFromRoster() {
  const byEmail = new Map()
  for (const mandate of loadMandateRoster().mandates) {
    const email = String(mandate.email).trim().toLowerCase()
    const current = byEmail.get(email) || {
      email,
      name: mandate.name,
      wgSlugs: [],
      kinds: new Set(),
    }
    current.name = current.name || mandate.name
    if (mandate.wgSlug && !current.wgSlugs.includes(mandate.wgSlug)) {
      current.wgSlugs.push(mandate.wgSlug)
    }
    current.kinds.add(mandate.kind)
    byEmail.set(email, current)
  }
  return [...byEmail.values()]
}

function peopleForRun() {
  const people = peopleFromRoster()
  const raw = String(process.env.MANDATE_EMAILS || '').trim()
  if (!raw) return people
  const wanted = new Set(
    raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )
  if (!wanted.size) {
    throw new Error('MANDATE_EMAILS is set but empty.')
  }
  const selected = people.filter((person) => wanted.has(person.email))
  const missing = [...wanted].filter(
    (email) => !selected.some((person) => person.email === email),
  )
  if (missing.length) {
    throw new Error(`MANDATE_EMAILS not on roster: ${missing.join(', ')}`)
  }
  return selected
}

function registrationData(person, index) {
  const { firstName, lastName } = splitName(person.name)
  const phone = `+254 700 ${String(200 + index).padStart(3, '0')} ${String(
    100 + index,
  ).padStart(3, '0')}`
  return {
    entityType: 'individual',
    membershipTrack: 'constituency_work',
    email: person.email,
    password: PASSWORD,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    phone,
    gender: 'Prefer not to say',
    ageBand: '18_35',
    dateOfBirth: '2000-01-15',
    minorityGroups: [],
    minorityOther: null,
    region: 'Africa',
    nationality: 'Kenyan',
    country: 'Kenya',
    motivation:
      'Seeded from the official 2026 YOUNGO Working Groups and Operational Teams roster so the Contact Point can sign in and change this password.',
    organizationName: null,
    organizationType: null,
    isUnfcccAdmitted: false,
    dcpName: null,
    under18: false,
    guardianName: null,
    guardianEmail: null,
    guardianConsent: false,
    coiDeclared: true,
    coiDetails: null,
    policiesAccepted: true,
    membershipPolicyVersion: POLICY_VERSION,
    constituencyWorkStatus: 'pending_onboarding',
    acceptCodeOfConduct: true,
    acceptDataProtection: true,
    acceptPrinciples: true,
    acceptCoiPolicy: true,
    memberOfAccreditedNgo: false,
    youthAffiliation: null,
    orgOperateIn: null,
    orgWebsite: null,
    orgSocial: null,
    orgMission: null,
    dcpEmail: null,
    dcpPhone: null,
    ycpName: null,
    ycpEmail: null,
    ycpPhone: null,
    privacyConsent: true,
    privacyNoticeVersion: PRIVACY_VERSION,
    privacyConsentAt: NOW,
    privacyConsentStatement: CONSENT_STATEMENT,
    memberStatus: 'pending_course',
    role: 'member',
    wgInterests: person.wgSlugs,
  }
}

async function resetPassword(accountId, password) {
  const { salt, hash } = await hashPassword(password)
  const pool = getPool()
  if (!pool) throw new Error('Postgres pool failed to initialize.')
  await pool.query(
    `UPDATE hub_accounts SET password_hash = $1, password_salt = $2 WHERE id = $3`,
    [hash, salt, accountId],
  )
}

async function markEmailVerified(accountId) {
  return setAccountFields(accountId, {
    email_verified_at: NOW,
    must_change_password: true,
  })
}

async function ensurePerson(person, index) {
  const existing = await findAccountByEmail(person.email)
  let created = false
  let account = existing
  if (!account) {
    await createAccount(registrationData(person, index))
    account = await findAccountByEmail(person.email)
    created = true
  } else {
    await resetPassword(account.id, PASSWORD)
  }
  await markEmailVerified(account.id)
  const mandate = await applyMandateFromRoster(account.id)
  const refreshed = await findAccountByEmail(person.email)
  return {
    email: person.email,
    name: person.name,
    created,
    accountId: refreshed?.id || account.id,
    role: refreshed?.role || mandate?.account?.role || null,
    wgSlugs: person.wgSlugs,
    mandateApplied: Boolean(mandate?.applied),
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.')
  }
  if (PASSWORD.length < 10) {
    throw new Error('MANDATE_PASSWORD must be at least 10 characters.')
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.MANDATE_CONFIRM_PRODUCTION !== '1'
  ) {
    throw new Error(
      'Refusing to seed production without MANDATE_CONFIRM_PRODUCTION=1.',
    )
  }

  const pool = getPool()
  if (!pool) throw new Error('Postgres pool failed to initialize.')

  const people = peopleForRun()
  const accounts = []
  try {
    for (const [index, person] of people.entries()) {
      accounts.push(await ensurePerson(person, index))
    }
  } finally {
    await pool.end()
  }

  console.log(
    JSON.stringify(
      {
        event: 'mandate_accounts_seeded',
        count: accounts.length,
        created: accounts.filter((item) => item.created).length,
        updated: accounts.filter((item) => !item.created).length,
        accounts: accounts.map(({ email, name, created, role, wgSlugs }) => ({
          email,
          name,
          created,
          role,
          wgSlugs,
        })),
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(`seed-mandate-accounts: ${err.message}`)
  process.exit(1)
})
