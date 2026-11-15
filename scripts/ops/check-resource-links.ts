/**
 * Probes every live resource URL and files a "broken" issue for dead ones. It never marks
 * anything verified: that stays a Content Publisher decision. A dry run unless told to apply:
 *
 *   npx tsx scripts/ops/check-resource-links.ts           # prints the report
 *   npx tsx scripts/ops/check-resource-links.ts --apply   # files issues for dead links
 *
 * Reads DATABASE_URL from .env.local, so check which database it names first.
 */
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

// env must load before payload.config is evaluated
loadEnv({ path: '.env.local' })
loadEnv()
const { default: config } = await import('../../src/payload.config')

const apply = process.argv.includes('--apply')
const MARKER = '[link probe]'

// 404/410 and dead hosts are broken; 403/429/5xx are often bot walls, so they only get reported
const verdict = async (url: string) => {
  const attempt = (method: 'HEAD' | 'GET') =>
    fetch(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; HubLinkProbe/1.0)' },
    })
  try {
    let res = await attempt('HEAD')
    // plenty of servers reject HEAD, so retry once with GET
    if (res.status >= 400) res = await attempt('GET')
    const moved = res.url !== url ? ` -> ${res.url}` : ''
    if (res.status === 404 || res.status === 410)
      return { broken: true, note: `HTTP ${res.status}${moved}` }
    return { broken: false, note: res.ok ? `ok${moved}` : `HTTP ${res.status} (not filed)${moved}` }
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause?.code ?? (error as Error).name
    const dead = ['ENOTFOUND', 'ECONNREFUSED'].includes(String(cause))
    return { broken: dead, note: `${dead ? '' : 'unreachable, not filed: '}${cause}` }
  }
}

async function main() {
  const payload = await getPayload({ config })
  const { docs: resources } = await payload.find({
    collection: 'catalogue-resources',
    where: { retiredAt: { exists: false } },
    limit: 1000,
    pagination: false,
    overrideAccess: true,
  })
  const { docs: open } = await payload.find({
    collection: 'resource-issues',
    where: { resolvedAt: { exists: false } },
    limit: 1000,
    pagination: false,
    overrideAccess: true,
  })
  const alreadyFiled = new Set(
    open.filter((i) => String(i.detail).startsWith(MARKER)).map((i) => i.resourceSlug),
  )

  let broken = 0
  let filed = 0
  // small batches keep us polite to the hosts
  for (let i = 0; i < resources.length; i += 8) {
    const batch = resources.slice(i, i + 8)
    const results = await Promise.all(batch.map((r) => verdict(String(r.url))))
    for (const [j, result] of results.entries()) {
      const r = batch[j]!
      if (result.note !== 'ok') console.log(`${r.slug}: ${result.note}`)
      if (!result.broken) continue
      broken++
      if (apply && !alreadyFiled.has(r.slug)) {
        await payload.create({
          collection: 'resource-issues',
          data: { resourceSlug: r.slug, kind: 'broken', detail: `${MARKER} ${result.note}` },
          overrideAccess: true,
        })
        filed++
      }
    }
  }
  console.log(`${resources.length} checked, ${broken} broken, ${filed} issue(s) filed`)
  console.log(apply ? 'applied' : 'dry run, nothing written (pass --apply)')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
