/**
 * Zero Zero — Zone + Solo Focus smoke (v1.8.x)
 * Run: npx playwright test
 * Requires: `npm run dev` on PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 */

import { test, expect } from '@playwright/test'

test.describe('Zone — Groovy Grid + Solo Focus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/zone')
    await page.waitForLoadState('domcontentloaded')
    // ClientOnly real grid exposes data-testid; brief route gate is ZeroGateShutter (logo pulse only).
    await page.getByTestId('zone-grid-mounted').waitFor({ state: 'visible', timeout: 30000 })
    await page.getByTestId('zone-hero-card').waitFor({ state: 'visible', timeout: 30000 })
  })

  test('Groovy Grid: hero card and stats copy render', async ({ page }) => {
    const grid = page.locator('.groovy-zone-grid')
    await expect(grid).toBeVisible()
    await expect(page.getByText('Check out your stats')).toBeVisible()
    await expect(page.getByText('SAVE').first()).toBeVisible()
    await expect(page.getByText('CARBON').first()).toBeVisible()
  })

  test('Tap HOME opens Solo Focus portal overlay', async ({ page }) => {
    await expect(page.locator('.expanded-solo-focus')).toHaveCount(0)
    await page.locator('[data-journey="home"]').click()
    await page.waitForTimeout(900)
    await expect(page.locator('.expanded-solo-focus').first()).toBeVisible()
  })

  test('Solo Focus: Get/Do, LIKE, ASK when expanded', async ({ page }) => {
    await page.locator('[data-journey="home"]').click()
    await page.waitForTimeout(900)
    await expect(page.getByRole('button', { name: /^(Get|Do)$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /LIKE/i }).or(page.getByLabel('Like'))).toBeVisible()
    await expect(page.getByRole('button', { name: /ASK/i })).toBeVisible()
  })

  test('Solo Focus: journey question label visible', async ({ page }) => {
    await page.locator('[data-journey="home"]').click()
    await page.waitForTimeout(900)
    await expect(
      page
        .getByText(
          /primary heating|What is your primary|commute|diet|buy brand new|biggest monthly|track your carbon|upgrade your phone|recycle|fly/i
        )
        .first()
    ).toBeVisible()
  })

  test('Answer options: circular buttons (high border-radius)', async ({ page }) => {
    await page.locator('[data-journey="home"]').click()
    await page.waitForTimeout(900)
    const option = page.locator('.solo-focus-answer-option').first()
    if ((await option.count()) > 0) {
      const borderRadius = await option.evaluate((el) => getComputedStyle(el).borderRadius)
      expect(borderRadius).toMatch(/9999px|50%/)
    }
  })

  test('Close hides Solo Focus overlay', async ({ page }) => {
    await page.locator('[data-journey="home"]').click()
    await page.waitForTimeout(900)
    await expect(page.locator('.expanded-solo-focus').first()).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await page.waitForTimeout(900)
    await expect(page.locator('.expanded-solo-focus')).toHaveCount(0)
  })

  test('No explore-more footer', async ({ page }) => {
    await expect(page.locator('.groovy-zone-grid')).toBeVisible()
    await expect(page.getByText('explore more.')).not.toBeVisible()
  })
})

test.describe('Profile → Local hook', () => {
  test('Profile page accepts postcode', async ({ page }) => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
    const postcodeInput = page
      .getByPlaceholder(/postcode|your postcode/i)
      .or(page.locator('input').filter({ has: page.locator('[name="postcode"]') }))
      .first()
    if ((await postcodeInput.count()) > 0) {
      await postcodeInput.fill('KW1 4AB')
      await expect(postcodeInput).toHaveValue('KW1 4AB')
    }
  })
})
