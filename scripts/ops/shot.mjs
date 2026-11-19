/**
 * Screenshot a LOCAL Hub route at exact widths: node scripts/ops/shot.mjs <path> <out-prefix> [widths...]
 * DIR=rtl flips the document direction. Set A11Y_EMAIL / A11Y_PASSWORD to sign in first. Local hosts only.
 */
import { chromium } from '@playwright/test'

const [path = '/', prefix = 'shot', ...w] = process.argv.slice(2)
const base = process.env.A11Y_BASE || 'http://localhost:3000'
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(base)) process.exit(1)
const widths = (w.length ? w : ['390', '820', '1280']).map(Number)
const browser = await chromium.launch({ channel: 'chrome' })
const page = await (await browser.newContext()).newPage()
if (process.env.A11Y_EMAIL) {
  await page.goto(base + '/signin')
  await page.getByLabel(/email/i).fill(process.env.A11Y_EMAIL)
  await page.getByLabel(/password/i).fill(process.env.A11Y_PASSWORD || '')
  await page
    .getByRole('button', { name: /sign in/i })
    .last()
    .click()
  await page.waitForURL(/\/hub/)
}
for (const width of widths) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(base + path, { waitUntil: 'load', timeout: 90000 })
  await page.waitForTimeout(2500)
  if (process.env.DIR)
    await page.evaluate((d) => (document.documentElement.dir = d), process.env.DIR)
  await page.screenshot({ path: `${prefix}-${width}.png`, fullPage: !process.env.SHOT_VIEWPORT })
}
await browser.close()
