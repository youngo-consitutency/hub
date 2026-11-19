/**
 * axe-core + reflow audit of a LOCAL Hub across every route and four widths.
 * Needs A11Y_BASE, A11Y_EMAIL, A11Y_PASSWORD; refuses non-local hosts because it signs in.
 */
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const base = process.env.A11Y_BASE || 'http://localhost:3000'
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(base)) {
  console.error('Refusing: A11Y_BASE must be a local development host.')
  process.exit(1)
}
const ONLY = process.env.A11Y_ONLY
const keep = (list) => (ONLY ? list.filter((p) => p === ONLY) : list)
const PUBLIC = ['/', '/our-work', '/about', '/join', '/signin', '/privacy']
const MEMBER = ['/hub', '/hub#/calendar', '/hub#/groups', '/hub#/resources', '/hub#/opportunities']
const WIDTHS = [320, 390, 820, 1280]
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext()
const page = await context.newPage()
const out = []

async function audit(path, width) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(base + path, { waitUntil: 'load', timeout: 90000 })
  await page.waitForTimeout(2500)
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  out.push({
    path,
    width,
    overflow,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      count: v.nodes.length,
      sample: v.nodes[0].target.join(' ').slice(0, 80),
      ...(process.env.A11Y_DETAIL
        ? {
            nodes: v.nodes.slice(0, 3).map((n) => ({
              html: n.html.slice(0, 160),
              why: (n.any[0]?.message || n.failureSummary || '').slice(0, 240),
            })),
          }
        : {}),
    })),
  })
}

for (const p of keep(PUBLIC)) for (const w of WIDTHS) await audit(p, w)

if (process.env.A11Y_EMAIL && process.env.A11Y_PASSWORD) {
  await page.goto(base + '/signin')
  await page.getByLabel(/email/i).fill(process.env.A11Y_EMAIL)
  await page.getByLabel(/password/i).fill(process.env.A11Y_PASSWORD)
  await page
    .getByRole('button', { name: /sign in/i })
    .last()
    .click()
  await page.waitForURL(/\/hub/)
  for (const p of keep(MEMBER)) for (const w of WIDTHS) await audit(p, w)
}
await browser.close()

if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1))
else {
  const byRule = new Map()
  for (const r of out) {
    if (r.overflow > 0) console.log(`OVERFLOW ${r.overflow}px  ${r.path} @${r.width}`)
    for (const v of r.violations) {
      const k = `${v.impact?.padEnd(8)} ${v.id}`
      const e = byRule.get(k) || { pages: new Set(), sample: v.sample, n: 0 }
      e.pages.add(`${r.path}@${r.width}`)
      e.n += v.count
      byRule.set(k, e)
    }
  }
  for (const [k, e] of [...byRule].sort())
    console.log(`${k}  ×${e.n} on ${e.pages.size} views  e.g. ${e.sample}`)
  if (!byRule.size) console.log('No axe violations.')
}
