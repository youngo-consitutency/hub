import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { testUser } from '../helpers/seedUser'

test.describe('Payload console', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test('can navigate to dashboard', async () => {
    await page.goto('http://localhost:3000/console')
    await expect(page).toHaveURL('http://localhost:3000/console')
    await expect(page.locator('body')).toContainText('Dashboard')
  })

  test('can navigate to accounts list', async () => {
    await page.goto('http://localhost:3000/console/collections/accounts')
    await expect(page).toHaveURL(
      'http://localhost:3000/console/collections/accounts',
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
