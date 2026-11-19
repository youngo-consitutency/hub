/**
 * Loads the fictional demo dataset into a LOCAL, empty development database; never run it against member data.
 * Refuses unless DATABASE_URL points at localhost and the accounts table is empty.
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

// pg lets a `?host=` or `?hostaddr=` query parameter override the host in the URL, so the URL's
// own hostname proves nothing unless those are absent
function isLocalDatabase(value: string) {
  try {
    const parsed = new URL(value)
    const overridden = parsed.searchParams.has('host') || parsed.searchParams.has('hostaddr')
    return !overridden && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  } catch {
    return false
  }
}

const url = process.env.DATABASE_URL || ''
if (!isLocalDatabase(url)) {
  console.error('Refusing to seed: DATABASE_URL must point at localhost, with no host override.')
  process.exit(1)
}

const dataset = JSON.parse(readFileSync(process.env.DEMO_DATASET || '', 'utf8'))
const payload = await getPayload({ config })

const existing = await payload.count({ collection: 'accounts', overrideAccess: true })
if (existing.totalDocs > 0) {
  console.error(`Refusing to seed: accounts already holds ${existing.totalDocs} rows.`)
  process.exit(1)
}

// data scripts are dry runs unless given --apply
if (!process.argv.includes('--apply')) {
  const kinds = (dataset.records as { collection: string }[]).reduce<Record<string, number>>(
    (n, r) => ({ ...n, [r.collection]: (n[r.collection] ?? 0) + 1 }),
    {},
  )
  console.log(
    `Dry run: would create ${dataset.accounts.length} accounts and`,
    JSON.stringify(kinds),
    '\nRe-run with --apply to write them.',
  )
  process.exit(0)
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
