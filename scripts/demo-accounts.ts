/* eslint-disable no-console */
/**
 * Provision throwaway accounts for local development and manual testing.
 *
 *   DEMO_EMAIL_DOMAIN=example.invalid DEMO_PASSWORD=... \
 *     DATABASE_URL=... npx tsx scripts/demo-accounts.ts
 *
 * Both environment variables are required; nothing is invented by the
 * script itself. Emails are derived as <key>@<domain> and printed once.
 * Use only against a disposable database.
 */
import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { applyAccountSpec, type AccountSpec } from './lib/accountSpec'

// The roles exercised during local development — a permission matrix, not
// a cast of characters.
const MATRIX: Omit<AccountSpec, 'email' | 'password' | 'name'>[] = [
  { role: 'admin' },
  {},
  { verified: false },
  {
    membershipTrack: 'constituency_work',
    wg: { slug: 'finance', role: 'member' },
  },
  {
    membershipTrack: 'constituency_work',
    wg: { slug: 'finance', role: 'contact' },
  },
  {
    membershipTrack: 'constituency_work',
    wg: { slug: 'ace', role: 'contact' },
  },
  {
    membershipTrack: 'constituency_work',
    teams: ['election_facilitation'],
  },
  { role: 'focal_point', membershipTrack: 'constituency_work' },
  { teams: ['membership_team'] },
  { teams: ['content_editor'] },
  { teams: ['content_publisher'] },
  { teams: ['gys_policy_team'] },
]

const KEY_FOR: Record<string, string> = {
  'admin': 'console-admin',
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
  const created: string[] = []
  for (const [i, spec] of MATRIX.entries()) {
    const role = spec.role ?? 'member'
    const key =
      KEY_FOR[role] ??
      [
        role,
        spec.teams?.[0],
        spec.wg && `${spec.wg.slug}-${spec.wg.role}`,
        spec.membershipTrack === 'constituency_work' ? 'cw' : null,
        spec.verified === false ? 'pending' : null,
        i,
      ]
        .filter(Boolean)
        .join('-')
    const email = `${key}@${domain}`
    await applyAccountSpec(payload, {
      ...spec,
      email,
      password,
      name: `Test ${key} ${randomUUID().slice(0, 4)}`,
    })
    created.push(email)
  }
  console.log(`provisioned ${created.length} accounts:`)
  for (const email of created) console.log(`  ${email}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
