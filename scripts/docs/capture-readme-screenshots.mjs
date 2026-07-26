/**
 * Capture README screenshots from staging (or APP_ORIGIN).
 * Usage: npm run screenshots
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../../docs/screenshots')
const origin =
  process.env.APP_ORIGIN || 'https://web-staging-31ab.up.railway.app'
const n = Date.now()
const email = `readme-shot-${n}@youngo-hub.test`
const password = 'readme-shot-pass-99'

mkdirSync(outDir, { recursive: true })

async function api(pathname, opts = {}) {
  const res = await fetch(`${origin}${pathname}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(
      `${pathname} ${res.status}: ${data?.error?.message || res.statusText}`,
    )
  return data
}

async function main() {
  console.log('origin', origin)

  // 1) Fresh verified member
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Readme',
      lastName: 'Shot',
      email,
      password,
      passwordConfirm: password,
      entityType: 'individual',
      ageBand: '18_35',
      phone: '+56 9 1234 5678',
      gender: 'Prefer not to say',
      dateOfBirth: '2000-06-15',
      region: 'Latin America and the Caribbean',
      nationality: 'Chilean',
      countryOfResidence: 'Chile',
      acceptCodeOfConduct: true,
      acceptDataProtection: true,
      acceptPrinciples: true,
      acceptCoiPolicy: true,
      memberOfAccreditedNgo: false,
      wgInterests: ['finance', 'ace'],
      membershipPolicyVersion: 'issue-2-2025-05-04',
      membershipTrack: 'network',
    }),
  })
  const token = reg.token
  await api('/api/member/course/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      answers: { q1: 'b', q2: 'b', q3: 'b', q4: 'a', q5: 'a' },
    }),
  })
  console.log('verified member ready', email)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  })
  const page = await context.newPage()

  async function shot(name, urlPath, setup) {
    await page.goto(`${origin}${urlPath}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    })
    if (setup) await setup(page)
    await page.waitForTimeout(800)
    const file = path.join(outDir, `${name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    console.log('wrote', file)
  }

  // Policy gate (fresh browser context)
  const policyCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  })
  const policyPage = await policyCtx.newPage()
  await policyPage.goto(origin + '/', {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await policyPage.waitForTimeout(1000)
  await policyPage.screenshot({
    path: path.join(outDir, '01-membership-policy.png'),
    fullPage: false,
  })
  console.log('wrote policy')
  await policyCtx.close()

  // Authenticated shots
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ({ token, account }) => {
      localStorage.setItem(
        'youngo-hub:membership-policy-ack',
        JSON.stringify({
          version: 'issue-2-2025-05-04',
          acknowledgedAt: new Date().toISOString(),
        }),
      )
      localStorage.setItem('youngo-hub:session-token', token)
      localStorage.setItem(
        'youngo-hub:session-account',
        JSON.stringify(account),
      )
      localStorage.setItem('theme', 'dark')
    },
    { token, account: reg.account },
  )

  // Re-fetch me to get verified account
  const me = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  await page.evaluate((account) => {
    localStorage.setItem('youngo-hub:session-account', JSON.stringify(account))
  }, me.account)

  await shot('02-home', '/', async (p) => {
    await p.goto(origin + '/', { waitUntil: 'networkidle' })
    await p.waitForTimeout(1200)
  })

  await shot('03-onboarding-faq', '/onboarding', async (p) => {
    await p.goto(origin + '/onboarding', { waitUntil: 'networkidle' })
    // open first FAQ item
    const sum = p.locator('.faqItem summary').first()
    if (await sum.count()) await sum.click()
    await p.waitForTimeout(400)
  })

  await shot('04-groups', '/groups', async (p) => {
    await p.goto(origin + '/groups', { waitUntil: 'networkidle' })
    await p.waitForTimeout(800)
  })

  await shot('05-calendar', '/calendar', async (p) => {
    await p.goto(origin + '/calendar', { waitUntil: 'networkidle' })
    await p.waitForTimeout(800)
  })

  await shot('06-library', '/library', async (p) => {
    await p.goto(origin + '/library', { waitUntil: 'networkidle' })
    await p.waitForTimeout(600)
  })

  // Light theme home for variety
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light')
    document.documentElement.setAttribute('data-theme', 'light')
  })
  await shot('07-home-light', '/', async (p) => {
    await p.goto(origin + '/', { waitUntil: 'networkidle' })
    await p.waitForTimeout(1000)
  })

  // Sign-in / join UI (clear session, keep policy)
  await page.evaluate(() => {
    localStorage.removeItem('youngo-hub:session-token')
    localStorage.removeItem('youngo-hub:session-account')
    localStorage.setItem('theme', 'dark')
  })
  await shot('08-join-signin', '/', async (p) => {
    await p.goto(origin + '/', { waitUntil: 'networkidle' })
    // click Sign in tab if present
    const tab = p.getByRole('tab', { name: /sign in/i })
    if (await tab.count()) await tab.click()
    await p.waitForTimeout(500)
  })

  await browser.close()

  // Write a simple index for the README
  const index = {
    capturedAt: new Date().toISOString(),
    origin,
    files: [
      '01-membership-policy.png',
      '02-home.png',
      '03-onboarding-faq.png',
      '04-groups.png',
      '05-calendar.png',
      '06-library.png',
      '07-home-light.png',
      '08-join-signin.png',
    ],
  }
  writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(index, null, 2),
  )
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
