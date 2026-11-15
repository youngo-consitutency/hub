// one-off provisioning: focal point directory rows hold the focal_point role on the platform scope
// a dry run unless told to apply:
//   npx tsx scripts/setup/map-directory-roles.ts           # shows the rows
//   npx tsx scripts/setup/map-directory-roles.ts --apply   # writes them
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

// env must load before payload.config is evaluated
loadEnv({ path: '.env.local' })
loadEnv()
const { default: config } = await import('../../src/payload.config')

const apply = process.argv.includes('--apply')

async function main() {
  const payload = await getPayload({ config })
  const rows = await payload.find({
    collection: 'directory-contacts',
    where: { group: { equals: 'focal_points' }, role: { exists: false } },
    limit: 500,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  for (const row of apply ? rows.docs : []) {
    await payload.update({
      collection: 'directory-contacts',
      id: row.id,
      data: { role: 'focal_point', scopeId: 'platform' },
      overrideAccess: true,
    })
  }
  console.log(
    apply
      ? `Mapped ${rows.docs.length} focal point rows.`
      : `${rows.docs.length} focal point rows to map. Dry run, nothing written (pass --apply).`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
