/**
 * Loads the fictional demo dataset (docs/Hub-demo/dataset.json) into a LOCAL, empty development
 * database so the Hub can be reviewed with realistic content. Never run it against a database
 * that holds member data.
 *
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5440/youngo_design \
 *   DEMO_DOCUMENTS=<dir of {slug,title,body}.json public documents, optional> \
 *   PAYLOAD_SECRET=... DEMO_DATASET=../docs/Hub-demo/dataset.json \
 *     npx tsx scripts/setup/seed-demo.ts
 *
 * Refuses to run unless DATABASE_URL points at localhost and the accounts table is empty.
 */
import type { AnyValue } from '../../src/lib/domain'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { getPayload, type CollectionSlug } from 'payload'

loadEnv({ path: '.env.local' })
loadEnv()
const { default: config } = await import('../../src/payload.config')
const { applyAccountSpec } = await import('../lib/accountSpec')

const url = process.env.DATABASE_URL || ''
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusing to seed: DATABASE_URL must point at localhost.')
  process.exit(1)
}

const dataset = JSON.parse(readFileSync(process.env.DEMO_DATASET || '', 'utf8'))
const payload = await getPayload({ config })

const existing = await payload.count({ collection: 'accounts', overrideAccess: true })
if (existing.totalDocs > 0) {
  console.error(`Refusing to seed: accounts already holds ${existing.totalDocs} rows.`)
  process.exit(1)
}

// the dataset points at other records as { "$ref": key }; swap in the ids created so far
const ids = new Map<string, number | string>()
const resolve = (v: AnyValue): AnyValue =>
  Array.isArray(v)
    ? v.map(resolve)
    : v && typeof v === 'object'
      ? '$ref' in v
        ? ids.get(v.$ref)
        : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]))
      : v

const create = async (collection: string, key: string, data: AnyValue, failures: string[]) => {
  try {
    const doc = await payload.create({
      collection: collection as CollectionSlug,
      data: resolve(data),
      overrideAccess: true,
      context: { seed: true },
    })
    ids.set(key, doc.id)
  } catch (err) {
    failures.push(`${collection}/${key}: ${(err as Error).message.slice(0, 160)}`)
  }
}

const failures: string[] = []
const records = dataset.records as AnyValue[]
// groups first: account specs point at them by slug
for (const r of records.filter((x) => x.collection === 'working-groups'))
  await create(r.collection, r.key, r.data, failures)

for (const account of dataset.accounts) {
  // the dataset predates authority records: its legacy `role` no longer exists on accounts
  const { key, role: _legacyRole, ...spec } = account
  const doc = await applyAccountSpec(payload, spec)
  if (doc?.id) ids.set(key, doc.id)
}
console.log(`accounts: ${dataset.accounts.length}`)

for (const r of records.filter((x) => x.collection !== 'working-groups'))
  await create(r.collection, r.key, r.data, failures)
// optional: public CMS documents (the copy behind the site pages), one {slug,title,body} JSON each
const docsDir = process.env.DEMO_DOCUMENTS
if (docsDir) {
  for (const file of readdirSync(docsDir).filter((f) => f.endsWith('.json'))) {
    const { slug, title, body } = JSON.parse(readFileSync(join(docsDir, file), 'utf8'))
    await create('content-documents', slug, { slug, title, body }, failures)
  }
}
console.log(`records: ${records.length - failures.length}/${records.length}`)
failures.forEach((f) => console.warn('  failed', f))
process.exit(0)
