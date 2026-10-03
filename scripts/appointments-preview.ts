/* eslint-disable no-console */
/**
 * Appointment migration preview (PR1, S13/S14/S25 normalisation).
 *
 * Reads every `assignments` row plus `focal_point`-titled accounts from the
 * target database and reports how the explicit map in
 * src/lib/appointments.ts classifies it:
 *
 *   mandate        → resolved to an appointment role; becomes an
 *                    `appointments` row (canonical mandate store)
 *   participation  → plain participation; stays in `assignments`
 *   unmapped       → no explicit mapping; reported and denied access —
 *                    never widened by guessing
 *
 * Focal Point titles are NEVER migrated automatically. `--write` only
 * creates a focal appointment for accounts listed in an evidence file:
 *
 *   DATABASE_URL=... npx tsx scripts/appointments-preview.ts --write \
 *     --focal-evidence focal-evidence.json
 *
 * The file is a JSON array; each entry carries the account id or email plus
 * a verifiable reference and real term dates (both ends — open-ended
 * mandates are refused):
 *
 *   [{ "accountId": 12, "electionId": 4, "startsAt": "2025-01-01",
 *      "endsAt": "2027-01-01" },
 *    { "email": "fp@example.org", "reference": "Council minutes 2024-11",
 *      "startsAt": "2024-11-15", "endsAt": "2026-11-15" }]
 *
 * `electionId` must be a completed focal_point election whose result names
 * the account as a race winner — it is verified against the database at
 * write time. `reference` records an external appointment record. Titled
 * accounts without evidence are reported for review and grant nothing.
 *
 * The script embeds no records: everything comes from DATABASE_URL plus the
 * evidence file.
 *
 * --write is idempotent: source identity is enforced by a database unique
 * index across ALL statuses and re-checked inside each write transaction,
 * so overlapping or stale runs can neither duplicate a migrated row nor
 * resurrect one a human has revoked. Historical status is preserved and
 * canonical rows written by anything else are never overwritten.
 */
import { config as loadEnv } from 'dotenv'
import { readFileSync } from 'node:fs'

loadEnv({ path: '.env.local' })
loadEnv()

const WRITE = process.argv.includes('--write')
const evidenceIdx = process.argv.findIndex(
  (a) => a === '--focal-evidence' || a.startsWith('--focal-evidence='),
)
const evidencePath =
  evidenceIdx === -1
    ? undefined
    : process.argv[evidenceIdx].includes('=')
      ? process.argv[evidenceIdx].slice('--focal-evidence='.length)
      : process.argv[evidenceIdx + 1]
if (evidenceIdx !== -1 && !evidencePath) {
  throw new Error('--focal-evidence requires a file path.')
}

const { default: config } = await import('../src/payload.config')
const { getPayload } = await import('payload')
const { planMigration, writeMigration } = await import('../src/lib/appointmentMigration')

async function loadFocalEvidence(payload: any) {
  if (!evidencePath) return undefined
  const entries = JSON.parse(readFileSync(evidencePath, 'utf8'))
  if (!Array.isArray(entries)) throw new Error('Focal evidence file must be a JSON array.')
  const map = new Map<number, any>()
  for (const entry of entries) {
    let accountId = entry.accountId
    if (accountId == null && entry.email) {
      const { docs } = await payload.find({
        collection: 'accounts',
        where: { email: { equals: entry.email } },
        limit: 1,
        overrideAccess: true,
      })
      accountId = docs[0]?.id
      if (accountId == null) throw new Error(`No account for evidence email ${entry.email}.`)
    }
    if (accountId == null) throw new Error('Every evidence entry needs accountId or email.')
    map.set(accountId, entry)
  }
  return map
}

async function main() {
  const payload = await getPayload({ config })
  const plan = await planMigration(payload)

  console.log(`assignments rows: ${plan.assignments}`)
  console.log(`  mandate → appointments: ${plan.mandate}`)
  console.log(`  participation → stays:  ${plan.participation}`)
  console.log(`  unmapped → denied:      ${plan.unmapped.length}`)
  console.log(
    `  row states: ${[...plan.states.entries()].map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`,
  )
  console.log(`  new appointment rows:   ${plan.creates.length}`)
  console.log(`  already migrated:       ${plan.alreadyMigrated}`)
  console.log(`  canonical rows kept:    ${plan.existingCanonical}`)
  console.log(
    `  focal_point titles:     ${plan.focalVerified.length} election-verified, ` +
      `${plan.focalUnverified.length} unverified (review only), ${plan.focalExisting} already appointed`,
  )

  if (plan.focalUnverified.length) {
    console.log('\nUnverified focal_point titles (no mandate recorded — review required):')
    for (const a of plan.focalUnverified) {
      console.log(`  account=${a.id} ${a.name ?? ''}`)
    }
  }

  if (plan.unmapped.length) {
    console.log('\nUnmapped rows (denied until the map covers them):')
    for (const r of plan.unmapped) {
      const accountId = typeof r.account === 'object' ? r.account.id : r.account
      console.log(
        `  id=${r.id} account=${accountId} scope=${r.scopeType}:${r.scopeId} role=${r.role} status=${r.status}`,
      )
    }
  }

  if (!WRITE) {
    console.log('\nDry run. Re-run with --write to create the appointment rows.')
    process.exit(plan.unmapped.length ? 2 : 0)
  }

  const focalEvidence = await loadFocalEvidence(payload)
  const result = await writeMigration(payload, plan, { focalEvidence })
  console.log(`\nAppointments created: ${result.created}`)
  console.log(`Focal-point appointments created: ${result.focalCreated}`)
  console.log(`Skipped as already migrated since planning: ${result.staleSkipped}`)
  console.log(`Conflicting duplicates skipped: ${result.conflicts}`)
  for (const r of result.focalRejected) {
    console.log(`Focal evidence rejected for account ${r.accountId}: ${r.reason}`)
  }
  process.exit(plan.unmapped.length ? 2 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
