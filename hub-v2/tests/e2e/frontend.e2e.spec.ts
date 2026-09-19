import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test.describe('Public site', () => {
  test('homepage renders the Hub shell', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle(/YOUNGO Hub/)
    await expect(page.locator('body')).not.toBeEmpty()
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
    await email.fill('demo-member@youngo.demo')
    const password = page
      .locator('input[type="password"], input[name="password"]')
      .first()
    await password.fill('DemoPass123!')
    await page
      .locator('button[type="submit"], button:has-text("Sign in")')
      .first()
      .click()
    // Signed-in members land on the member workspace; the gate disappears.
    await expect(email).toBeHidden({ timeout: 15000 })
  })
})
