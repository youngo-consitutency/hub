// Ensure admin accounts exist. Reset URLs are opt-in for newly created accounts
// so routine deploy logs never become a credential channel.
// Usage: node scripts/bootstrap-admin.js
// Env: ADMIN_EMAILS (first email is bootstrapped), APP_ORIGIN, DATABASE_URL
import { randomBytes } from 'node:crypto'
import { findAccountByEmail, createAccount, publicAccount } from '../server/lib/accounts.js'
import { setAccountFields } from '../server/lib/lifecycle.js'
import { createPasswordResetToken, resetLink } from '../server/lib/passwordReset.js'
import { getPool } from '../server/lib/db.js'
import { POLICY_VERSION } from '../src/content/membershipPolicy.js'

const emails = String(process.env.ADMIN_EMAILS || 'genaro.gg@unmgcy.org')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

const origin = process.env.APP_ORIGIN || 'https://web-staging-31ab.up.railway.app'
const printResetUrls = process.env.PRINT_ADMIN_RESET_URLS === 'true'

async function ensureAccount(email) {
  let row = await findAccountByEmail(email)
  if (row) {
    const account = publicAccount(row)
    await setAccountFields(account.id, {
      role: 'admin',
      member_status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: 'bootstrap',
    })
    return { account: publicAccount({ ...row, role: 'admin', member_status: 'verified' }), created: false }
  }

  // Minimal individual registration shape for createAccount
  const tempPassword = randomBytes(24).toString('base64url')
  const account = await createAccount({
    email,
    password: tempPassword,
    firstName: 'Genaro',
    lastName: 'Admin',
    name: 'Genaro Admin',
    entityType: 'individual',
    membershipTrack: 'network',
    phone: '+00 000 000 0000',
    gender: 'Prefer not to say',
    genderOther: null,
    ageBand: '18_35',
    dateOfBirth: '1995-01-01',
    minorityGroups: [],
    minorityOther: null,
    region: 'Latin America and the Caribbean',
    nationality: '—',
    country: '—',
    motivation: 'Platform admin',
    organizationName: null,
    organizationType: null,
    isUnfcccAdmitted: false,
    youthAffiliation: null,
    orgOperateIn: null,
    orgWebsite: null,
    orgSocial: null,
    orgMission: null,
    dcpName: null,
    dcpEmail: null,
    dcpPhone: null,
    ycpName: null,
    ycpEmail: null,
    ycpPhone: null,
    under18: false,
    guardianName: null,
    guardianEmail: null,
    guardianConsent: false,
    acceptCodeOfConduct: true,
    acceptDataProtection: true,
    acceptPrinciples: true,
    acceptCoiPolicy: true,
    coiDeclared: true,
    coiDetails: null,
    policiesAccepted: true,
    memberOfAccreditedNgo: false,
    membershipPolicyVersion: POLICY_VERSION,
    constituencyWorkStatus: 'pending_onboarding',
    memberStatus: 'verified',
    role: 'admin',
    wgInterests: [],
  })
  await setAccountFields(account.id, {
    role: 'admin',
    member_status: 'verified',
    verified_at: new Date().toISOString(),
    verified_by: 'bootstrap',
  })
  return { account, created: true }
}

async function main() {
  if (!emails.length) {
    console.log('bootstrap-admin: no ADMIN_EMAILS set — skip')
    return
  }
  for (const email of emails) {
    console.log(`bootstrap-admin: ensuring ${email}`)
    const { account, created } = await ensureAccount(email)
    const event = {
      event: 'admin_bootstrap',
      email,
      accountId: account.id,
      role: 'admin',
      memberStatus: 'verified',
      created,
      resetUrlEmitted: false,
    }
    if (created && printResetUrls) {
      const reset = await createPasswordResetToken(email)
      if (!reset) console.error(`bootstrap-admin: could not create reset token for ${email}`)
      else {
        event.resetUrl = resetLink(origin, reset.rawToken)
        event.expiresAt = reset.expiresAt
        event.resetUrlEmitted = true
      }
    }
    console.log(JSON.stringify(event))
  }
  const pool = getPool()
  if (pool) await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
