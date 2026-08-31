import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dir = fileURLToPath(
  new URL('../../docs/design-qa/2026-08-30-member-landing/', import.meta.url),
)
await mkdir(dir, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const findings = []

async function capture({ width, height, theme, name, fullPage = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  })
  await context.addInitScript((value) => {
    localStorage.setItem('youngo-hub:theme-override', value)
  }, theme)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Your YOUNGO workspace.' }).waitFor()
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
  await page.evaluate((value) => {
    localStorage.setItem('youngo-hub:theme-override', value)
    document.documentElement.dataset.theme = value
  }, theme)
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  if (overflow > 0) findings.push(`${name}: horizontal overflow ${overflow}px`)
  if (errors.length) findings.push(`${name}: ${errors.join(' | ')}`)
  await page.screenshot({
    path: join(dir, `${name}.png`),
    fullPage,
  })
  await context.close()
}

await capture({
  width: 1440,
  height: 900,
  theme: 'light',
  name: 'desktop-light',
})
await capture({
  width: 1440,
  height: 900,
  theme: 'dark',
  name: 'desktop-dark',
})
await capture({
  width: 390,
  height: 844,
  theme: 'light',
  name: 'mobile-light',
})
await capture({
  width: 390,
  height: 844,
  theme: 'dark',
  name: 'mobile-dark',
})
await capture({
  width: 768,
  height: 1024,
  theme: 'light',
  name: 'tablet-light',
})
await capture({
  width: 1440,
  height: 900,
  theme: 'light',
  name: 'desktop-light-full',
  fullPage: true,
})
await capture({
  width: 390,
  height: 844,
  theme: 'light',
  name: 'mobile-light-full',
  fullPage: true,
})

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
await page.getByRole('button', { name: 'Forgot password?' }).click()
await page.getByRole('heading', { name: 'Reset password' }).waitFor()
await page.screenshot({ path: join(dir, 'desktop-forgot.png') })
await page.getByRole('button', { name: 'Back to sign in' }).click()
await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
await page.getByRole('textbox', { name: /Email/ }).fill('member@example.org')
await page.screenshot({ path: join(dir, 'desktop-typed.png') })
await page.locator('.platformAuthJoin a').click()
await page.waitForURL('**/join')
await page.screenshot({ path: join(dir, 'join-path.png') })
await page.close()

await browser.close()
if (findings.length) {
  console.error(findings.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    'captured member landing screenshots with no overflow or page errors',
  )
}
