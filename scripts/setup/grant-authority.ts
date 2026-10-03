/* eslint-disable no-console */
/**
 * Out-of-band authority recovery. When no account can sign in holding the
 * capability to grant mandates — for example every officer's Constituency
 * Work membership lapsed, so deriveAuthority skips their records and the
 * accounts console rejects them — this script writes one authority-record
 * row directly against the database and exits.
 *
 *   ACCOUNT_ID=<id> ROLE=focal_point npx tsx scripts/setup/grant-authority.ts
 *   ACCOUNT_ID=<id> ROLE=gct.internal SCOPE_TYPE=team SCOPE_ID=gct \
 *     npx tsx scripts/setup/grant-authority.ts
 *
 * Optional: ENDS_AT=<iso date>, COUNCIL_SEAT=<seat>, EVIDENCE=<text>.
 *
 * This deliberately bypasses the governed assign() path, so the record's
 * provenance is stamped as a manual recovery for the audit trail.
 */
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

// Env must load before payload.config is evaluated.
loadEnv({ path: '.env.local' })
loadEnv()
const { AUTHORITY_ROLES, recordKind, councilSeatFor } = await import('../../src/lib/authority')
const { default: config } = await import('../../src/payload.config')

async function main() {
  const accountId = Number(process.env.ACCOUNT_ID)
  const role = String(process.env.ROLE || '')
  const spec = AUTHORITY_ROLES[role]
  if (!Number.isInteger(accountId) || !spec) {
    console.error(
      'Usage: ACCOUNT_ID=<account id> ROLE=<authority role> ' +
        '[SCOPE_TYPE=...] [SCOPE_ID=...] [ENDS_AT=...]',
    )
    console.error(`Known roles: ${Object.keys(AUTHORITY_ROLES).join(', ')}`)
    process.exit(1)
  }
  const scopeType = process.env.SCOPE_TYPE || spec.scopeTypes[0]
  if (!spec.scopeTypes.includes(scopeType)) {
    console.error(`${role} cannot be scoped to ${scopeType} (${spec.scopeTypes.join(', ')})`)
    process.exit(1)
  }
  const scopeId = String(process.env.SCOPE_ID || 'platform').trim()
  const payload = await getPayload({ config })

  const account = await payload
    .findByID({ collection: 'accounts', id: accountId, overrideAccess: true })
    .catch(() => null)
  if (!account) {
    console.error(`No account with id ${accountId}.`)
    process.exit(1)
  }

  const created = await payload.create({
    collection: 'authority-records',
    data: {
      account: accountId,
      role,
      kind: recordKind(scopeType, role),
      scopeType: scopeType as any,
      scopeId,
      status: 'active',
      startsAt: new Date().toISOString(),
      endsAt: process.env.ENDS_AT || null,
      councilSeat: process.env.COUNCIL_SEAT || councilSeatFor(role, { scopeId }) || null,
      provenance: {
        source: 'manual_recovery',
        script: 'scripts/setup/grant-authority.ts',
        at: new Date().toISOString(),
      },
      evidence:
        process.env.EVIDENCE || 'Out-of-band recovery grant — see scripts/setup/grant-authority.ts',
    },
    overrideAccess: true,
  })
  console.log(
    `Granted ${role} on ${scopeType}:${scopeId} to account ${accountId} ` +
      `(record ${created.id}).`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
