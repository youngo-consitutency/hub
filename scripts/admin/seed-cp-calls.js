/**
 * Create Jalo's admin account and publish Genn's Wednesday/Friday call slots
 * from the Google Calendar busy times on genaro.gg@unmgcy.org.
 *
 *   DATABASE_URL=... MANDATE_PASSWORD=... MANDATE_CONFIRM_PRODUCTION=1 \
 *     node scripts/admin/seed-cp-calls.js
 */
import { createAccount, findAccountByEmail } from '../../server/lib/accounts.js'
import { hashPassword } from '../../server/lib/password.js'
import { setAccountFields } from '../../server/lib/lifecycle.js'
import { createSlot } from '../../server/lib/cpCalls.js'
import { getPool } from '../../server/lib/db.js'
import { POLICY_VERSION } from '../../src/content/membershipPolicy.js'
import {
  PRIVACY_VERSION,
  CONSENT_STATEMENT,
} from '../../shared/privacyNotice.js'

const PASSWORD = String(process.env.MANDATE_PASSWORD || '')
const NOW = new Date().toISOString()
const JALO_EMAIL = 'jaloliddin.ismailov@eyengineers.eu'
const GENN_EMAILS = ['genaro.gg@unmgcy.org', 'ggodoyg@fen.uchile.cl']

const BUSY = [
  ['2026-09-16T11:00:00+02:00', '2026-09-16T11:45:00+02:00'],
  ['2026-09-16T12:00:00+02:00', '2026-09-16T12:30:00+02:00'],
  ['2026-09-16T14:00:00+02:00', '2026-09-16T15:30:00+02:00'],
  ['2026-09-16T16:00:00+02:00', '2026-09-16T17:00:00+02:00'],
  ['2026-09-16T18:30:00+02:00', '2026-09-16T20:30:00+02:00'],
]

const DAYS = [
  '2026-09-16',
  '2026-09-18',
  '2026-09-23',
  '2026-09-25',
  '2026-09-30',
  '2026-10-02',
  '2026-10-07',
  '2026-10-09',
]
const HOURS = [10, 12, 14, 16]

function overlaps(start, end, busyStart, busyEnd) {
  return start < new Date(busyEnd) && end > new Date(busyStart)
}

function gennSlots() {
  const out = []
  for (const day of DAYS) {
    for (const hour of HOURS) {
      const start = new Date(
        `${day}T${String(hour).padStart(2, '0')}:00:00+02:00`,
      )
      const end = new Date(start.getTime() + 45 * 60 * 1000)
      if (start <= new Date()) continue
      const clash = BUSY.some(([busyStart, busyEnd]) =>
        overlaps(start, end, busyStart, busyEnd),
      )
      if (!clash)
        out.push({ startsAt: start.toISOString(), endsAt: end.toISOString() })
    }
  }
  return out
}

async function ensureJalo() {
  let row = await findAccountByEmail(JALO_EMAIL)
  let created = false
  if (!row) {
    await createAccount({
      entityType: 'individual',
      membershipTrack: 'constituency_work',
      email: JALO_EMAIL,
      password: PASSWORD,
      firstName: 'Jaloliddin',
      lastName: 'Ismailov',
      name: 'Jaloliddin Ismailov',
      phone: '+41 78 000 00 00',
      gender: 'Prefer not to say',
      ageBand: '18_35',
      dateOfBirth: '1998-01-15',
      minorityGroups: [],
      region: 'Eastern Europe',
      nationality: 'Uzbek',
      country: 'Switzerland',
      motivation:
        'Hub launcher account so Jalo can publish WG-section call times.',
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
      memberStatus: 'verified',
      role: 'member',
      wgInterests: [],
      mustChangePassword: true,
    })
    row = await findAccountByEmail(JALO_EMAIL)
    created = true
  } else {
    const { salt, hash } = await hashPassword(PASSWORD)
    const pool = getPool()
    await pool.query(
      `UPDATE hub_accounts SET password_hash = $1, password_salt = $2 WHERE id = $3`,
      [hash, salt, row.id],
    )
  }
  await setAccountFields(row.id, {
    role: 'admin',
    member_status: 'verified',
    hub_access_status: 'active',
    membership_status: 'active',
    email_verified_at: NOW,
    must_change_password: true,
    verified_by: 'explicit_admin_bootstrap',
    verified_at: NOW,
  })
  return { created, id: row.id, email: JALO_EMAIL }
}

async function findGenn() {
  for (const email of GENN_EMAILS) {
    const row = await findAccountByEmail(email)
    if (row) return row
  }
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT * FROM hub_accounts WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`,
  )
  return rows[0] || null
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
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
  try {
    const jalo = await ensureJalo()
    const genn = await findGenn()
    if (!genn) throw new Error('No Genn admin account found to host slots.')
    const published = []
    for (const slot of gennSlots()) {
      try {
        published.push(
          await createSlot({
            hostAccountId: genn.id,
            hostLabel: 'Genn',
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          }),
        )
      } catch (error) {
        if (error.code !== 'conflict') throw error
      }
    }
    console.log(
      JSON.stringify(
        {
          event: 'cp_calls_seeded',
          jalo,
          genn: { id: genn.id, email: genn.email },
          slots: published.length,
        },
        null,
        2,
      ),
    )
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(`seed-cp-calls: ${err.message}`)
  process.exit(1)
})
