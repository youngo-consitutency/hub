/* eslint-disable no-console */
/**
 * Provision throwaway accounts + demo workflow content for local
 * development and manual testing.
 *
 *   DEMO_EMAIL_DOMAIN=example.invalid DEMO_PASSWORD=... \
 *     DATABASE_URL=... npx tsx scripts/demo-accounts.ts
 *
 * Both environment variables are required; nothing is invented by the
 * script itself. Emails are derived as <key>@<domain> and printed once.
 * Use only against a disposable database.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { applyAccountSpec, type AccountSpec } from './lib/accountSpec'
import { provisionDemoContent } from './lib/demoContent'

// The roles exercised during local development — a permission matrix, not
// a cast of characters. Each key doubles as the email local part.
const MATRIX: Record<string, Omit<AccountSpec, 'email' | 'password' | 'name'>> = {
  'console-admin': { role: 'admin' },
  member: {},
  'member-pending': { verified: false },
  'cw-finance-member': {
    membershipTrack: 'constituency_work',
    wg: { slug: 'finance', role: 'member' },
  },
  'cw-finance-contact': {
    membershipTrack: 'constituency_work',
    wg: { slug: 'finance', role: 'contact' },
  },
  'cw-ace-contact': {
    membershipTrack: 'constituency_work',
    wg: { slug: 'ace', role: 'contact' },
  },
  facilitator: {
    membershipTrack: 'constituency_work',
    teams: ['election_facilitation'],
  },
  'focal-point': { role: 'focal_point', membershipTrack: 'constituency_work' },
  'membership-team': { teams: ['membership_team'] },
  'content-editor': { teams: ['content_editor'] },
  'content-publisher': { teams: ['content_publisher'] },
  'gys-team': { teams: ['gys_policy_team'] },
}

export async function provisionAccounts(
  payload: any,
  domain: string,
  password: string,
): Promise<Map<string, any>> {
  const accounts = new Map<string, any>()
  for (const [key, spec] of Object.entries(MATRIX)) {
    const email = `${key}@${domain}`
    accounts.set(
      key,
      await applyAccountSpec(payload, { ...spec, email, password, name: key }),
    )
  }
  return accounts
}

async function main() {
  const domain = process.env.DEMO_EMAIL_DOMAIN
  const password = process.env.DEMO_PASSWORD
  if (!domain || !password) {
    console.error(
      'Set DEMO_EMAIL_DOMAIN and DEMO_PASSWORD in the environment first.',
    )
    process.exit(1)
  }

  const payload = await getPayload({ config })
  const accounts = await provisionAccounts(payload, domain, password)
  console.log(`provisioned ${accounts.size} accounts:`)
  for (const key of accounts.keys()) console.log(`  ${key}@${domain}`)

  const summary = await provisionDemoContent(payload, accounts)
  console.log(
    `demo content: ${summary.decisions.length} proposals, ` +
      `1 election, 1 selection, 1 handover, 6 ops filings`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
