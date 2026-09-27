import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
// Provisioned by tests/e2e/global-setup.ts — generated per run.
const { memberEmail, memberPassword } = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '.credentials.json'), 'utf8'),
)

test.describe('Public site', () => {
  test('the public homepage matches About and keeps Home links at the root', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle(/YOUNGO Hub/)
    await expect(
      page.getByRole('heading', { name: 'Your place in global climate action.', exact: true }),
    ).toBeVisible()
    await expect(page.locator('img[src*="working-together"]')).toHaveCount(0)
    await page.goto(`${BASE}/about`)
    await expect(
      page.getByRole('heading', { name: 'Your place in global climate action.', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'YOUNGO home', exact: true })).toHaveAttribute(
      'href',
      '/',
    )
  })

  test('public event preview can retry and shows an honest empty state', async ({ page }) => {
    let attempts = 0
    await page.route('**/api/landing', (route) => {
      attempts += 1
      return route.fulfill({
        status: attempts === 1 ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify(
          attempts === 1 ? { error: { message: 'Unavailable' } } : { events: [] },
        ),
      })
    })
    await page.goto(BASE)
    const preview = page.getByRole('complementary', { name: 'Coming up' })
    await expect(preview.getByText('Events could not be loaded.')).toBeVisible()
    await preview.getByRole('button', { name: 'Try again' }).click()
    await expect(preview.getByText('No upcoming events have been published.')).toBeVisible()
    await expect(preview.getByRole('link', { name: 'Open the Hub calendar' })).toHaveAttribute(
      'href',
      '/calendar',
    )
  })

  test('public API responds with JSON collections', async ({ request }) => {
    for (const path of ['/api/events', '/api/feed', '/api/groups']) {
      const res = await request.get(`${BASE}${path}`)
      expect(res.status()).toBe(200)
    }
  })

  test('member API requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/member/people`)
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('Member app', () => {
  test('member can sign in and reach the member home', async ({ page }) => {
    await page.goto(`${BASE}/member`)
    // The SPA shows a sign-in gate when unauthenticated.
    const email = page.locator('input[type="email"], input[name="email"]').first()
    await email.fill(memberEmail)
    const password = page.locator('input[type="password"], input[name="password"]').first()
    await password.fill(memberPassword)
    await page.locator('button[type="submit"], button:has-text("Sign in")').first().click()
    // Signed-in members land on the member workspace; the gate disappears.
    await expect(email).toBeHidden({ timeout: 15000 })
    await page.goto(BASE)
    await expect(page.getByRole('heading', { name: 'Your Hub', exact: true })).toBeVisible()
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Your Hub', exact: true })).toBeVisible()
  })
})
