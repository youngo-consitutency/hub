/**
 * One-off content cleanup for the retired hub consultation: drops the site
 * banner, the footer link to the recap, and the `consultation` document.
 * Idempotent, and a dry run unless told to apply:
 *
 *   npx tsx scripts/setup/remove-consultation-content.ts           # shows the change
 *   npx tsx scripts/setup/remove-consultation-content.ts --apply   # writes it
 *
 * Reads DATABASE_URL from .env.local, so check which database it names first.
 */
import type { AnyValue } from '../../src/lib/domain'
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

// Env must load before payload.config is evaluated.
loadEnv({ path: '.env.local' })
loadEnv()
const { default: config } = await import('../../src/payload.config')

const apply = process.argv.includes('--apply')
const retired = (href?: string) => typeof href === 'string' && href.startsWith('/consultation')

async function main() {
  const payload = await getPayload({ config })
  const find = (slug: string) =>
    payload.find({
      collection: 'content-documents',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    })

  const [{ docs: sites }, { docs: consultations }] = await Promise.all([
    find('site'),
    find('consultation'),
  ])

  const site = sites[0]
  if (site) {
    const { consultBanner, ...body } = (site.body || {}) as AnyValue
    const involved = body.footer?.involved
    if (Array.isArray(involved))
      body.footer = { ...body.footer, involved: involved.filter(({ href }) => !retired(href)) }
    const changed = JSON.stringify(body) !== JSON.stringify(site.body) || consultBanner
    console.log(`site: ${changed ? 'banner and footer link to remove' : 'already clean'}`)
    if (apply && changed)
      await payload.update({
        collection: 'content-documents',
        id: site.id,
        data: { body },
        overrideAccess: true,
      })
  }

  console.log(`consultation document: ${consultations[0] ? 'present' : 'already gone'}`)
  if (apply && consultations[0])
    await payload.delete({
      collection: 'content-documents',
      id: consultations[0].id,
      overrideAccess: true,
    })

  console.log(apply ? 'applied' : 'dry run, nothing written (pass --apply)')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
