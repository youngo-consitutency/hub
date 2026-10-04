/**
 * Bootstrap a freshly migrated database. The repository carries no content
 * or account data — working groups, events, documents, resources and demo
 * accounts all live in the database (the member flows or
 * direct provisioning for deployments). This script only creates the
 * Payload console login when credentials are supplied:
 *
 *   CONSOLE_EMAIL=... CONSOLE_PASSWORD=... DATABASE_URL=... npx tsx scripts/seed.ts
 *
 * Idempotent: the console user is upserted by email.
 */
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

// Env must load before payload.config is evaluated.
loadEnv({ path: '.env.local' })
loadEnv()
const { default: config } = await import('../src/payload.config')

/**
 * Initialise Payload, upsert a staff user by email when CONSOLE_EMAIL and
 * CONSOLE_PASSWORD are supplied, then exit after bootstrap completes.
 */
async function main() {
  const payload = await getPayload({ config })

  if (process.env.CONSOLE_EMAIL && process.env.CONSOLE_PASSWORD) {
    const where = { email: { equals: process.env.CONSOLE_EMAIL } }
    const data = {
      email: process.env.CONSOLE_EMAIL,
      password: process.env.CONSOLE_PASSWORD,
    }
    const existing = await payload.find({
      collection: 'users',
      where,
      limit: 1,
      overrideAccess: true,
      pagination: false,
    })
    if (existing.docs[0]) {
      await payload.update({
        collection: 'users',
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })
    } else {
      await payload.create({ collection: 'users', data, overrideAccess: true })
    }
    console.log('staff user: provisioned')
  }

  console.log('Bootstrap complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
