import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'

// Provisioned by tests/e2e/global-setup.ts — generated per run.
const { consoleEmail, consolePassword } = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '.credentials.json'), 'utf8'),
)

test.describe('Payload console', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: { email: consoleEmail, password: consolePassword } })
  })

  test('can navigate to dashboard', async () => {
    await page.goto('http://localhost:3000/console')
    await expect(page).toHaveURL('http://localhost:3000/console')
    await expect(page.locator('body')).toContainText('Dashboard')
  })

  test('can navigate to accounts list', async () => {
    await page.goto('http://localhost:3000/console/collections/accounts')
    await expect(page).toHaveURL(
      (url) =>
        url.origin === 'http://localhost:3000' && url.pathname === '/console/collections/accounts',
    )
    await expect(page.locator('body')).toContainText('Account')
  })

  test('can navigate to edit view', async () => {
    await page.goto('http://localhost:3000/console/collections/accounts/create')
    await expect(page).toHaveURL(/\/console\/collections\/accounts\/create/)
    const editViewArtifact = page.locator('input[name="email"]')
    await expect(editViewArtifact).toBeVisible()
  })
})
