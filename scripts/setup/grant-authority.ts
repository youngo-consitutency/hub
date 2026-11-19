/**
 * Out-of-band authority recovery: writes one authority-record row directly; a dry run unless --apply is passed.
 * Needs ACCOUNT_ID, ROLE, SCOPE_TYPE, SCOPE_ID; bypasses assign(), so provenance is stamped as manual recovery.
 */
import type { AnyValue } from '../../src/lib/domain'
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

// Env must load before payload.config is evaluated.
loadEnv({ path: '.env.local' })
loadEnv()
const { AUTHORITY_ROLES, recordKind, councilSeatFor } = await import('../../src/lib/authority')
const { isCwActive } = await import('../../src/lib/accountStatus')
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

  // A requiresCw role is ignored while the holder's Constituency Work membership is inactive: restore CW first.
  if (spec.requiresCw && !isCwActive(account)) {
    console.error(
      `Account ${accountId} has no active Constituency Work, and ${role} ` +
        'requires it — restore CW first, then re-run this grant.',
    )
    process.exit(1)
  }

  if (!process.argv.includes('--apply')) {
    console.log(
      `Would grant ${role} on ${scopeType}:${scopeId} to account ${accountId}. ` +
        'Dry run, nothing written (pass --apply).',
    )
    process.exit(0)
  }

  const created = await payload.create({
    collection: 'authority-records',
    data: {
      account: accountId,
      role,
      kind: recordKind(scopeType, role),
      scopeType: scopeType as AnyValue,
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
