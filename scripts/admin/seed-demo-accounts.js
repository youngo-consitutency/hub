/**
 * Seed demo accounts covering every platform / team / NGO persona.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/admin/seed-demo-accounts.js
 *   railway run --service youngo-hub --environment production npm run seed-demo-accounts
 *
 * Optional:
 *   DEMO_PASSWORD=...          shared password (min 10 chars; default DemoPass123!)
 *   DEMO_EMAIL_DOMAIN=...      email domain (default youngo.demo)
 *   DEMO_CONFIRM_PRODUCTION=1  required when NODE_ENV=production
 */
import { createAccount, findAccountByEmail } from '../../server/lib/accounts.js'
import { hashPassword } from '../../server/lib/password.js'
import {
  ensureOwnerSeat,
  setAccountFields,
  upsertWgProgress,
} from '../../server/lib/lifecycle.js'
import { setTeamAssignment, syncWgAssignment } from '../../server/lib/access.js'
import { getPool } from '../../server/lib/db.js'
import { POLICY_VERSION } from '../../src/content/membershipPolicy.js'
import {
  PRIVACY_VERSION,
  CONSENT_STATEMENT,
} from '../../shared/privacyNotice.js'

const DOMAIN = String(process.env.DEMO_EMAIL_DOMAIN || 'youngo.demo')
  .trim()
  .toLowerCase()
const PASSWORD = String(process.env.DEMO_PASSWORD || 'DemoPass123!')
const NOW = new Date().toISOString()

function email(local) {
  return `${local}@${DOMAIN}`
}

function baseIndividual(overrides = {}) {
  return {
    entityType: 'individual',
    membershipTrack: 'network',
    password: PASSWORD,
    phone: '+254 700 000 001',
    gender: 'Prefer not to say',
    ageBand: '18_35',
    dateOfBirth: '2000-01-15',
    minorityGroups: [],
    minorityOther: null,
    region: 'Africa',
    nationality: 'Kenyan',
    country: 'Kenya',
    motivation: 'YOUNGO Hub demo account.',
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
    wgInterests: [],
    ...overrides,
  }
}

function baseOrganization(overrides = {}) {
  const organizationName =
    overrides.organizationName || 'YOUNGO Demo Youth Network'
  return baseIndividual({
    entityType: 'organization',
    membershipTrack: 'network',
    firstName: 'Demo',
    lastName: 'Org Contact',
    name: 'Demo Org Contact',
    phone: '+254 700 000 099',
    organizationName,
    organizationType: 'non_admitted',
    isUnfcccAdmitted: false,
    orgOperateIn: 'Kenya; East Africa',
    orgWebsite: 'https://example.org/youngo-demo',
    orgMission: 'Demo organisation for Hub persona testing.',
    ycpName: 'Demo Org Contact',
    ycpEmail: overrides.email,
    ycpPhone: '+254 700 000 099',
    memberOfAccreditedNgo: false,
    ...overrides,
  })
}

const PERSONAS = [
  {
    key: 'admin',
    label: 'Platform admin',
    data: baseIndividual({
      email: email('demo-admin'),
      firstName: 'Demo',
      lastName: 'Admin',
      name: 'Demo Admin',
    }),
    after: { role: 'admin', verified: true },
  },
  {
    key: 'member',
    label: 'Ordinary verified member',
    data: baseIndividual({
      email: email('demo-member'),
      firstName: 'Demo',
      lastName: 'Member',
      name: 'Demo Member',
      phone: '+254 700 000 002',
    }),
    after: { role: 'member', verified: true },
  },
  {
    key: 'pending',
    label: 'Pending course (gated)',
    data: baseIndividual({
      email: email('demo-pending'),
      firstName: 'Demo',
      lastName: 'Pending',
      name: 'Demo Pending',
      phone: '+254 700 000 003',
    }),
    after: { role: 'member', verified: false },
  },
  {
    key: 'focal',
    label: 'Focal point',
    data: baseIndividual({
      email: email('demo-focal'),
      firstName: 'Demo',
      lastName: 'Focal',
      name: 'Demo Focal',
      phone: '+254 700 000 004',
      membershipTrack: 'constituency_work',
    }),
    after: { role: 'focal_point', verified: true },
  },
  {
    key: 'wg_contact',
    label: 'WG contact (Finance)',
    data: baseIndividual({
      email: email('demo-wg-contact'),
      firstName: 'Demo',
      lastName: 'WgContact',
      name: 'Demo WgContact',
      phone: '+254 700 000 005',
      wgInterests: ['finance'],
    }),
    after: {
      role: 'member',
      verified: true,
      wg: { slug: 'finance', role: 'contact' },
    },
  },
  {
    key: 'wg_lead',
    label: 'WG lead (ACE)',
    data: baseIndividual({
      email: email('demo-wg-lead'),
      firstName: 'Demo',
      lastName: 'WgLead',
      name: 'Demo WgLead',
      phone: '+254 700 000 006',
      wgInterests: ['ace'],
    }),
    after: {
      role: 'member',
      verified: true,
      wg: { slug: 'ace', role: 'lead' },
    },
  },
  {
    key: 'membership_team',
    label: 'Membership team',
    data: baseIndividual({
      email: email('demo-membership'),
      firstName: 'Demo',
      lastName: 'Membership',
      name: 'Demo Membership',
      phone: '+254 700 000 007',
    }),
    after: {
      role: 'member',
      verified: true,
      teamRoles: ['membership_team'],
    },
  },
  {
    key: 'gys_policy_team',
    label: 'GYS policy team',
    data: baseIndividual({
      email: email('demo-gys'),
      firstName: 'Demo',
      lastName: 'Gys',
      name: 'Demo Gys',
      phone: '+254 700 000 008',
    }),
    after: {
      role: 'member',
      verified: true,
      teamRoles: ['gys_policy_team'],
    },
  },
  {
    key: 'content_editor',
    label: 'Content editor',
    data: baseIndividual({
      email: email('demo-editor'),
      firstName: 'Demo',
      lastName: 'Editor',
      name: 'Demo Editor',
      phone: '+254 700 000 009',
    }),
    after: {
      role: 'member',
      verified: true,
      teamRoles: ['content_editor'],
    },
  },
  {
    key: 'content_publisher',
    label: 'Content publisher',
    data: baseIndividual({
      email: email('demo-publisher'),
      firstName: 'Demo',
      lastName: 'Publisher',
      name: 'Demo Publisher',
      phone: '+254 700 000 010',
    }),
    after: {
      role: 'member',
      verified: true,
      teamRoles: ['content_publisher'],
    },
  },
  {
    key: 'ngo_admin',
    label: 'NGO organisation admin',
    data: baseOrganization({
      email: email('demo-org'),
      firstName: 'Demo',
      lastName: 'OrgAdmin',
      name: 'Demo OrgAdmin',
      organizationName: 'YOUNGO Demo Youth Network',
      ycpEmail: email('demo-org'),
    }),
    after: { role: 'ngo_admin', verified: true, ensureOwner: true },
  },
  {
    key: 'ngo_representative',
    label: 'NGO seat representative',
    data: baseIndividual({
      email: email('demo-ngo-rep'),
      firstName: 'Demo',
      lastName: 'NgoRep',
      name: 'Demo NgoRep',
      phone: '+254 700 000 011',
      memberOfAccreditedNgo: true,
    }),
    after: {
      role: 'member',
      verified: true,
      ngoSeat: {
        orgEmail: email('demo-org'),
        seatRole: 'representative',
      },
    },
  },
]

async function resetPassword(accountId, password) {
  const { salt, hash } = await hashPassword(password)
  const pool = getPool()
  await pool.query(
    `UPDATE hub_accounts SET password_hash = $1, password_salt = $2 WHERE id = $3`,
    [hash, salt, accountId],
  )
}

async function ensureAccount(persona) {
  const existing = await findAccountByEmail(persona.data.email)
  if (existing) {
    await resetPassword(existing.id, PASSWORD)
    return { account: existing, created: false }
  }
  const created = await createAccount(persona.data)
  const row = await findAccountByEmail(persona.data.email)
  return { account: row || created, created: true }
}

async function applyVerified(accountId, verified) {
  if (!verified) {
    return setAccountFields(accountId, {
      member_status: 'pending_course',
      hub_access_status: 'pending_course',
      membership_status: 'registered',
      verified_at: null,
      verified_by: null,
      course_passed_at: null,
      course_score: null,
    })
  }
  return setAccountFields(accountId, {
    member_status: 'verified',
    hub_access_status: 'active',
    membership_status: 'active',
    verified_at: NOW,
    verified_by: 'demo_seed',
    course_passed_at: NOW,
    course_score: 100,
  })
}

async function applyTeamRoles(accountId, teamRoles = []) {
  const updated = await setAccountFields(accountId, {
    team_roles: teamRoles,
  })
  for (const teamRole of [
    'membership_team',
    'gys_policy_team',
    'content_editor',
    'content_publisher',
  ]) {
    await setTeamAssignment({
      accountId,
      teamRole,
      enabled: teamRoles.includes(teamRole),
      assignedBy: accountId,
    })
  }
  return updated
}

async function applyWg(accountId, wg) {
  if (!wg) return
  await upsertWgProgress(accountId, wg.slug, {
    presentation_ok: true,
    rules_ok: true,
    status: 'active',
    role_in_wg: wg.role,
  })
  await syncWgAssignment({
    accountId,
    wgSlug: wg.slug,
    role: wg.role,
    status: 'active',
    assignedBy: accountId,
  })
}

async function ensureActiveSeat({ orgAccountId, memberAccount, seatRole }) {
  const pool = getPool()
  const { rows } = await pool.query(
    `INSERT INTO ngo_seats (
       org_account_id, member_account_id, email, name, seat_role, status, accepted_at
     ) VALUES ($1,$2,$3,$4,$5,'active', now())
     ON CONFLICT (org_account_id, email) DO UPDATE SET
       member_account_id = EXCLUDED.member_account_id,
       name = EXCLUDED.name,
       seat_role = EXCLUDED.seat_role,
       status = 'active',
       accepted_at = now(),
       invite_token = NULL,
       invite_token_hash = NULL,
       invite_expires_at = NULL
     RETURNING *`,
    [
      orgAccountId,
      memberAccount.id,
      memberAccount.email,
      memberAccount.name,
      seatRole,
    ],
  )
  return rows[0]
}

async function seedPersona(persona, orgByEmail) {
  const { account, created } = await ensureAccount(persona)
  const accountId = account.id
  await applyVerified(accountId, Boolean(persona.after.verified))
  await setAccountFields(accountId, {
    role: persona.after.role || 'member',
  })
  await applyTeamRoles(accountId, persona.after.teamRoles || [])
  await applyWg(accountId, persona.after.wg)

  let refreshed = await findAccountByEmail(persona.data.email)
  if (persona.after.ensureOwner) {
    const publicLike = {
      id: refreshed.id,
      entityType: refreshed.entity_type || refreshed.entityType,
      isVerified: true,
      role: persona.after.role,
      email: refreshed.email,
      name: refreshed.name,
    }
    await ensureOwnerSeat(publicLike)
    refreshed = await findAccountByEmail(persona.data.email)
  }

  if (persona.after.ngoSeat) {
    const org = orgByEmail.get(persona.after.ngoSeat.orgEmail)
    if (!org) {
      throw new Error(
        `NGO seat org missing for ${persona.data.email}: ${persona.after.ngoSeat.orgEmail}`,
      )
    }
    await ensureActiveSeat({
      orgAccountId: org.id,
      memberAccount: refreshed,
      seatRole: persona.after.ngoSeat.seatRole,
    })
  }

  orgByEmail.set(persona.data.email, refreshed)
  return {
    key: persona.key,
    label: persona.label,
    email: persona.data.email,
    role: persona.after.role,
    teamRoles: persona.after.teamRoles || [],
    wg: persona.after.wg || null,
    verified: Boolean(persona.after.verified),
    created,
    accountId,
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.')
  }
  if (PASSWORD.length < 10) {
    throw new Error('DEMO_PASSWORD must be at least 10 characters.')
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.DEMO_CONFIRM_PRODUCTION !== '1'
  ) {
    throw new Error(
      'Refusing to seed production without DEMO_CONFIRM_PRODUCTION=1.',
    )
  }

  const pool = getPool()
  if (!pool) throw new Error('Postgres pool failed to initialize.')

  const orgByEmail = new Map()
  const results = []
  try {
    // Seed org before the representative seat account.
    const ordered = [
      ...PERSONAS.filter((p) => p.key === 'ngo_admin'),
      ...PERSONAS.filter((p) => p.key !== 'ngo_admin'),
    ]
    for (const persona of ordered) {
      results.push(await seedPersona(persona, orgByEmail))
    }
  } finally {
    await pool.end()
  }

  console.log(
    JSON.stringify(
      {
        event: 'demo_accounts_seeded',
        domain: DOMAIN,
        password: PASSWORD,
        count: results.length,
        accounts: results,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(`seed-demo-accounts: ${err.message}`)
  process.exit(1)
})
