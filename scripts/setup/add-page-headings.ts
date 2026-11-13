/**
 * Adds the About and Our work page headings to the `site` document so editors can change them.
 * Only fills fields that are missing. A dry run unless told to apply:
 *
 *   npx tsx scripts/setup/add-page-headings.ts           # shows the change
 *   npx tsx scripts/setup/add-page-headings.ts --apply   # writes it
 *
 * Reads DATABASE_URL from .env.local, so check which database it names first.
 */
import type { AnyValue } from '../../src/lib/domain'
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

// env must load before payload.config is evaluated
loadEnv({ path: '.env.local' })
loadEnv()
const { default: config } = await import('../../src/payload.config')

const apply = process.argv.includes('--apply')

const HEADINGS = {
  about: {
    title: 'About YOUNGO',
    lead: 'How the constituency is organised, answers to common questions, and where to get in touch.',
  },
  work: {
    title: 'Our work',
    lead: 'Working groups, conferences and the Global Youth Statement: how young people shape climate policy together.',
  },
}

async function main() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'content-documents',
    where: { slug: { equals: 'site' } },
    limit: 1,
    overrideAccess: true,
  })
  const site = docs[0]
  if (!site) throw new Error('no site document')
  const body = { ...((site.body || {}) as AnyValue) }
  const missing = Object.keys(HEADINGS).filter((key) => !body[key])
  for (const key of missing) body[key] = HEADINGS[key as keyof typeof HEADINGS]
  console.log(missing.length ? `adding: ${missing.join(', ')}` : 'already present')
  if (apply && missing.length)
    await payload.update({
      collection: 'content-documents',
      id: site.id,
      data: { body },
      overrideAccess: true,
    })
  console.log(apply ? 'applied' : 'dry run, nothing written (pass --apply)')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
