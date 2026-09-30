/* eslint-disable no-console */
/**
 * Appointment migration preview (PR1, S13/S14/S25 normalisation).
 *
 * Reads every `assignments` row from the target database and reports how the
 * explicit map in src/lib/appointments.ts classifies it:
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
 * --write inserts appointment rows idempotently (matching an existing row
 * updates term/evidence) and leaves the source assignments untouched —
 * history is preserved; the access layer treats a canonical appointment as
 * superseding its legacy row. Review the preview before writing.
 */
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv()

const WRITE = process.argv.includes('--write')

const { default: config } = await import('../src/payload.config')
const { getPayload } = await import('payload')
const { legacyAppointmentRole, appointmentState, councilSeatFor } = await import(
  '../src/lib/appointments'
)

const PARTICIPATION_SCOPES = new Set([
  'body',
  'working_group',
  'organization',
  'operational_team',
  'negotiation_track',
  'negotiation_project',
])

type Row = {
  id: number
  account: number | { id: number }
  scopeType: string
  scopeId: string
  role: string
  status: string
  startsAt?: string | null
  endsAt?: string | null
}

const classify = (row: Row) => {
  const appointmentRole = legacyAppointmentRole(row.scopeType, row.scopeId, row.role)
  if (!appointmentRole) return { kind: 'unmapped' as const }
  if (row.role === 'member' && PARTICIPATION_SCOPES.has(row.scopeType))
    return { kind: 'participation' as const, appointmentRole }
  return { kind: 'mandate' as const, appointmentRole }
}

async function main() {
  const payload = await getPayload({ config })

  const all: Row[] = []
  let page = 1
  for (;;) {
    const { docs, hasNextPage } = await payload.find({
      collection: 'assignments',
      limit: 500,
      page: page++,
      overrideAccess: true,
      pagination: true,
    })
    all.push(...(docs as any as Row[]))
    if (!hasNextPage) break
  }

  const buckets = { mandate: 0, participation: 0, unmapped: 0 }
  const states = new Map<string, number>()
  const unmapped: Row[] = []
  const mandates: { row: Row; appointmentRole: string }[] = []

  for (const row of all) {
    const state = appointmentState(row as any)
    states.set(state, (states.get(state) ?? 0) + 1)
    const c = classify(row)
    buckets[c.kind] += 1
    if (c.kind === 'unmapped') unmapped.push(row)
    if (c.kind === 'mandate') mandates.push({ row, appointmentRole: c.appointmentRole! })
  }

  console.log(`assignments rows: ${all.length}`)
  console.log(`  mandate → appointments: ${buckets.mandate}`)
  console.log(`  participation → stays:  ${buckets.participation}`)
  console.log(`  unmapped → denied:      ${buckets.unmapped}`)
  console.log(
    `  row states: ${[...states.entries()].map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`,
  )

  if (unmapped.length) {
    console.log('\nUnmapped rows (denied until the map covers them):')
    for (const r of unmapped) {
      const accountId = typeof r.account === 'object' ? r.account.id : r.account
      console.log(
        `  id=${r.id} account=${accountId} scope=${r.scopeType}:${r.scopeId} role=${r.role} status=${r.status}`,
      )
    }
  }

  if (!WRITE) {
    console.log('\nDry run. Re-run with --write to create the appointment rows.')
    process.exit(unmapped.length ? 2 : 0)
  }

  let written = 0
  for (const { row, appointmentRole } of mandates) {
    const accountId = typeof row.account === 'object' ? row.account.id : row.account
    const councilSeat = councilSeatFor(appointmentRole, row as any)
    const existing = await payload.find({
      collection: 'appointments',
      where: {
        and: [
          { account: { equals: accountId } },
          { appointmentRole: { equals: appointmentRole } },
          { scopeType: { equals: row.scopeType } },
          { scopeId: { equals: row.scopeId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    const data: any = {
      account: accountId,
      appointmentRole,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      councilSeat,
      status: 'active',
      startsAt: row.startsAt ?? new Date().toISOString(),
      endsAt: row.endsAt ?? null,
      appointedVia: { source: 'assignments_migration', assignmentId: row.id },
    }
    if (existing.docs[0]) {
      await payload.update({
        collection: 'appointments',
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })
    } else {
      await payload.create({ collection: 'appointments', data, overrideAccess: true })
    }
    written += 1
  }
  console.log(`\nAppointments written: ${written}`)
  process.exit(unmapped.length ? 2 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
