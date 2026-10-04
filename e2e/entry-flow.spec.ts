import { test, expect } from '@playwright/test'

/**
 * Entry flow: Splash → Postcode → First result → Create / Log in / Skip.
 * Mechanical truth: the result screen shows either a sourced figure or no figure at all.
 */
test.describe('Entry flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        /* ignore */
      }
    })
  })

  test('splash offers Get started and Log in, nothing else', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /pay less for your home/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible()
    // The old three-option screens are gone.
    await expect(page.getByText(/quick look, or make it yours/i)).toHaveCount(0)
    await expect(page.getByText(/save money/i)).toHaveCount(0)
  })

  test('postcode rejects a malformed postcode and does not advance', async ({ page }) => {
    await page.goto('/start', { waitUntil: 'domcontentloaded' })
    const input = page.getByPlaceholder(/postcode/i)
    // Retry until the page has hydrated and the Enter handler is attached.
    await expect(async () => {
      await input.fill('not a postcode')
      await input.press('Enter')
      await expect(page.getByTestId('postcode-error')).toContainText(/UK postcode/i, { timeout: 2000 })
    }).toPass({ timeout: 30000 })
    await expect(page).toHaveURL(/\/start$/)
  })

  test('a valid postcode reaches the result with a sourced figure or none, never an invented one', async ({ page }) => {
    await page.goto('/start', { waitUntil: 'domcontentloaded' })
    const input = page.getByPlaceholder(/postcode/i)
    await expect(async () => {
      await input.fill('M1 1AE')
      await input.press('Enter')
      await expect(page).toHaveURL(/\/start\/result\?postcode=/, { timeout: 4000 })
    }).toPass({ timeout: 60000 })
    const figure = page.getByTestId('first-result')
    const none = page.getByTestId('first-result-none')
    await expect(figure.or(none)).toBeVisible({ timeout: 30000 })
    if (await figure.count()) {
      // Any figure on screen must name its source.
      await expect(figure).toContainText(/Source:/)
    }
    await expect(page.getByRole('button', { name: /skip for now/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^log in$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /save this, create your account/i })).toBeVisible()
    // Back navigation returns to the postcode step.
    await page.goBack()
    await expect(page).toHaveURL(/\/start$/)
  })

  test('result deep link with an invalid postcode bounces to the postcode step', async ({ page }) => {
    await page.goto('/start/result?postcode=xx', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/start$/, { timeout: 15000 })
  })

  test('bare /profile with nothing stored goes back to the start of the flow', async ({ page }) => {
    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/start$/, { timeout: 15000 })
  })

  test('/profile?entry=login shows the login form', async ({ page }) => {
    await page.goto('/profile?entry=login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByPlaceholder(/mobile number/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })
})
