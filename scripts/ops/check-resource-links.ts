/**
 * Probes every live resource URL and files a "broken" issue for dead ones. It never marks
 * anything verified: that stays a Content Publisher decision. A dry run unless told to apply:
 *
 *   npx tsx scripts/ops/check-resource-links.ts           # prints the report
 *   npx tsx scripts/ops/check-resource-links.ts --apply   # files issues for dead links
 *
 * Reads DATABASE_URL from .env.local, so check which database it names first.
 */
import dns from 'node:dns/promises'
import net from 'node:net'
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

// env must load before payload.config is evaluated
loadEnv({ path: '.env.local' })
loadEnv()
const { default: config } = await import('../../src/payload.config')

const apply = process.argv.includes('--apply')
const MARKER = '[link probe]'

// loopback, link-local and private ranges: a catalogue link must not point the probe at our own network
const isPrivate = (ip: string) => {
  if (net.isIPv6(ip)) {
    const v6 = ip.toLowerCase()
    if (v6.startsWith('::ffff:')) return isPrivate(v6.slice(7))
    return v6 === '::1' || v6 === '::' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)
  }
  const [a = 0, b = 0] = ip.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

const assertPublic = async (url: URL) => {
  if (!/^https?:$/.test(url.protocol)) throw new Error('UNSUPPORTED_PROTOCOL')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true })
  if (addresses.some(({ address }) => isPrivate(address))) throw new Error('PRIVATE_ADDRESS')
}

// follows redirects by hand so every hop is vetted before we connect to it
const fetchHop = async (start: string, method: 'HEAD' | 'GET') => {
  let url = new URL(start)
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(url)
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; HubLinkProbe/1.0)' },
    })
    // we only want the status, so release the connection right away
    await res.body?.cancel()
    const location = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !location) return { status: res.status, url }
    url = new URL(location, url)
  }
  throw new Error('TOO_MANY_REDIRECTS')
}

// 404/410 and dead hosts are broken; 403/429/5xx are often bot walls, so they only get reported
const verdict = async (start: string) => {
  try {
    let res = await fetchHop(start, 'HEAD')
    // plenty of servers reject HEAD, so retry once with GET
    if (res.status >= 400) res = await fetchHop(start, 'GET')
    const moved = res.url.href !== new URL(start).href ? ` -> ${res.url.href}` : ''
    if (res.status === 404 || res.status === 410)
      return { broken: true, note: `HTTP ${res.status}${moved}` }
    const ok = res.status < 400
    return { broken: false, note: ok ? `ok${moved}` : `HTTP ${res.status} (not filed)${moved}` }
  } catch (error) {
    // dns.lookup puts the code on the error, fetch puts it on the cause
    const e = error as { code?: string; cause?: { code?: string }; message: string }
    const code = e.code ?? e.cause?.code ?? e.message
    const dead = ['ENOTFOUND', 'ECONNREFUSED'].includes(String(code))
    return { broken: dead, note: `${dead ? '' : 'unreachable, not filed: '}${code}` }
  }
}

async function main() {
  const payload = await getPayload({ config })
  const { docs: resources } = await payload.find({
    collection: 'catalogue-resources',
    where: { retiredAt: { exists: false } },
    limit: 0,
    pagination: false,
    overrideAccess: true,
  })
  const { docs: open } = await payload.find({
    collection: 'resource-issues',
    where: { resolvedAt: { exists: false } },
    limit: 0,
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
