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
 * The script embeds no records: everything comes from DATABASE_URL.
 *
 *   DATABASE_URL=... npx tsx scripts/appointments-preview.ts          # preview
 *   DATABASE_URL=... npx tsx scripts/appointments-preview.ts --write  # backfill
 *
 * --write is idempotent: rows already migrated are matched by stable source
 * identity (`appointedVia.assignmentId`), historical status is preserved
 * (an inactive source never becomes live), and canonical rows written by
 * anything else are never overwritten — including ones revoked since a
 * previous run. Source assignments stay untouched; history is preserved.
 */
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv()

const WRITE = process.argv.includes('--write')

const { default: config } = await import('../src/payload.config')
const { getPayload } = await import('payload')
const { planMigration, writeMigration } = await import('../src/lib/appointmentMigration')

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
    `  focal_point titles:     ${plan.focalAccounts.length} to migrate, ${plan.focalExisting} already appointed`,
  )

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

  const result = await writeMigration(payload, plan)
  console.log(`\nAppointments created: ${result.created}`)
  console.log(`Focal-point appointments created: ${result.focalCreated}`)
  console.log(`Conflicting duplicates skipped: ${result.conflicts}`)
  process.exit(plan.unmapped.length ? 2 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
