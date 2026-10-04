/**
 * Zero Zero — Zone + Solo Focus smoke (v27.0 Unit Brain)
 * Run: npx playwright test e2e/zone-funky-stress.spec.ts
 * Requires: `npm run dev` on PLAYWRIGHT_BASE_URL (default http://localhost:3000)
 */

import { test, expect, type Page } from '@playwright/test'

/**
 * Zone is now horizontal rails of one card anatomy (ZoneRecCard); the legacy bento wall stays
 * mounted but hidden (it owns Solo Focus expansion for journey cards). Journey cards are opened
 * from the rails, not from the hidden wall.
 */
function journeyCard(page: Page) {
  const home = page.locator('[data-rec-card="journey-home"]').first()
  return home.or(page.locator('[data-rec-card^="journey-"]').first()).first()
}
async function openJourneyCard(page: Page) {
  await journeyCard(page).scrollIntoViewIfNeeded()
  await journeyCard(page).locator('.zone-rec-cta').first().click()
}

test.describe('Zone — Groovy Grid + Solo Focus', () => {
  test.describe.configure({ mode: 'serial', timeout: 150000 })
  test.beforeEach(async ({ page }) => {
    // Cards only render when they can say why they're for you, so enter Zone the way a guest
    // does: postcode in the entry flow, then "Skip for now".
    await page.goto('/start', { waitUntil: 'domcontentloaded' })
    const postcode = page.getByPlaceholder(/postcode/i)
    await expect(async () => {
      await postcode.fill('M1 1AE')
      await postcode.press('Enter')
      await expect(page).toHaveURL(/\/start\/result/, { timeout: 4000 })
    }).toPass({ timeout: 60000 })
    await page.getByRole('button', { name: /skip for now/i }).click({ timeout: 60000 })
    await expect(page).toHaveURL(/\/zone/, { timeout: 30000 })
    // Rails render once the wall is ready; the legacy grid stays attached (hidden) underneath.
    await page.getByTestId('zone-rails').waitFor({ state: 'visible', timeout: 45000 })
    await page.getByTestId('zone-grid-mounted').waitFor({ state: 'attached', timeout: 30000 })
    await page.getByTestId('zone-hero-card').waitFor({ state: 'visible', timeout: 30000 })
  })

  test('Groovy Grid: hero card and stats copy render', async ({ page }) => {
    await expect(page.getByTestId('zone-rails')).toBeVisible()
    await expect(page.getByText('Check out your stats')).toBeVisible()
    await expect(page.getByText('Potential').first()).toBeVisible()
    await expect(page.getByText('Carbon').first()).toBeVisible()
  })

  test('Tap HOME opens Solo Focus portal overlay', async ({ page }) => {
    await expect(page.locator('.expanded-solo-focus')).toHaveCount(0)
    await openJourneyCard(page)
    await page.waitForTimeout(900)
    await expect(page.locator('.expanded-solo-focus').first()).toBeVisible()
  })

  test('Solo Focus: dynamic CTA + social controls when expanded', async ({ page }) => {
    await openJourneyCard(page)
    await page.waitForTimeout(900)
    const primaryCta = page.getByRole('button', {
      name: /^(Get|Claim|Buy|Zai)$/i,
    })
    await expect(primaryCta).toBeVisible()
    await primaryCta.click()
    await expect(page.getByRole('button', { name: /LIKE/i }).or(page.getByLabel('Like'))).toBeVisible()
    await expect(page.getByRole('button', { name: /ASK/i })).toBeVisible()
  })

  test('Solo Focus: CTA opens partner handoff URL in new tab', async ({ page, context }) => {
    await openJourneyCard(page)
    await page.waitForTimeout(900)
    const primaryCta = page.getByRole('button', {
      name: /^(Get|Claim|Buy|Zai)$/i,
    })
    await expect(primaryCta).toBeVisible()
    const popupPromise = context.waitForEvent('page')
    await primaryCta.click()
    const popup = await popupPromise
    await popup.waitForLoadState('domcontentloaded')
    const url = popup.url()
    expect(url).toMatch(/^https?:\/\//)
    await popup.close()
  })

  test('Solo Focus: grounded narrative + source contract visible', async ({ page }) => {
    await openJourneyCard(page)
    await page.waitForTimeout(900)
    const narrativeParagraphs = page.locator('.solo-focus-insight.solo-focus-description')
    await expect(narrativeParagraphs.first()).toBeVisible()
    await expect(narrativeParagraphs).toHaveCount(3)
    await expect(
      page
        .locator('.solo-focus-verified-source')
        .filter({ hasText: /Source:\s+.+\s+April\s+2026/i })
        .first()
    ).toBeVisible()
  })

  test('Answer options: circular buttons (high border-radius)', async ({ page }) => {
    await openJourneyCard(page)
    await page.waitForTimeout(900)
    const option = page.locator('.solo-focus-answer-option').first()
    if ((await option.count()) > 0) {
      const borderRadius = await option.evaluate((el) => getComputedStyle(el).borderRadius)
      expect(borderRadius).toMatch(/9999px|50%/)
    }
  })

  test('Close hides Solo Focus overlay', async ({ page }) => {
    await openJourneyCard(page)
    let overlayVisible = await page.locator('.expanded-solo-focus').first().isVisible().catch(() => false)
    if (!overlayVisible) {
      await page.waitForTimeout(450)
      await openJourneyCard(page)
      overlayVisible = await page.locator('.expanded-solo-focus').first().isVisible().catch(() => false)
    }
    expect(overlayVisible).toBeTruthy()
    await page.getByRole('button', { name: 'Close' }).click()
    await page.waitForTimeout(900)
    await expect(page.locator('.expanded-solo-focus')).toHaveCount(0)
  })

  test('No explore-more footer', async ({ page }) => {
    await expect(page.getByTestId('zone-rails')).toBeVisible()
    await expect(page.getByText('explore more.')).not.toBeVisible()
  })

  test('Compact audit value appears in hero or solo focus stack', async ({ page }) => {
    await expect(page.getByText('Potential').first()).toBeVisible()
    const compactInHero = page.getByText(/£\d+(\.\d+)?k\b/).first()
    if (await compactInHero.count()) {
      await expect(compactInHero).toBeVisible()
      return
    }
    await openJourneyCard(page)
    await page.waitForTimeout(900)
    await expect(page.getByText(/£\d+(\.\d+)?k\b|\b\d+(\.\d+)?t\b/).first()).toBeVisible()
  })

  test('Postcode mutation triggers zone sync within 500ms', async ({ page }) => {
    const grid = page.getByTestId('zone-grid-mounted')
    const beforeSync = await grid.getAttribute('data-vm-sync')
    await page.evaluate(() => {
      localStorage.setItem('profile_postcode', 'SW1A 1AA')
      window.dispatchEvent(new StorageEvent('storage', { key: 'profile_postcode', newValue: 'SW1A 1AA' }))
    })
    await expect(grid).toHaveAttribute('data-profile-postcode', /SW1A1AA/i, { timeout: 500 })
    await expect
      .poll(async () => await grid.getAttribute('data-vm-sync'), { timeout: 500 })
      .not.toBe(beforeSync)
  })
})

test.describe('Profile → Local hook', () => {
  test('Profile page accepts postcode', async ({ page }) => {
    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
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
