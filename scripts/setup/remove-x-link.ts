/**
 * One-off content cleanup: drops the X (Twitter) link from the `connect` document, which feeds
 * the public footer and contact page. Idempotent, and a dry run unless told to apply:
 *
 *   npx tsx scripts/setup/remove-x-link.ts           # shows the change
 *   npx tsx scripts/setup/remove-x-link.ts --apply   # writes it
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
const isX = ({ key, url }: AnyValue) => key === 'x' || /(^|\.)(x|twitter)\.com\b/.test(String(url))

async function main() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'content-documents',
    where: { slug: { equals: 'connect' } },
    limit: 1,
    overrideAccess: true,
  })
  const doc = docs[0]
  const links: AnyValue[] = (doc?.body as AnyValue)?.SOCIAL_LINKS ?? []
  const kept = links.filter((link) => !isX(link))
  console.log(
    doc ? `connect: ${links.length - kept.length} X link(s) to remove` : 'connect: not found',
  )
  if (apply && doc && kept.length !== links.length)
    await payload.update({
      collection: 'content-documents',
      id: doc.id,
      data: { body: { ...(doc.body as AnyValue), SOCIAL_LINKS: kept } },
      overrideAccess: true,
    })
  console.log(apply ? 'applied' : 'dry run, nothing written (pass --apply)')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
