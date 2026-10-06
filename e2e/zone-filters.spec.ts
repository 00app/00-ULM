import { test, expect, type Page } from '@playwright/test'

/**
 * Zone filters: the bar sits under "Start here", filters act on browsable ideas only, the heading
 * is built from the filters, and the mobile secondary filters live in a bottom sheet.
 */
async function enterZoneAsGuest(page: Page) {
  await page.goto('/start', { waitUntil: 'domcontentloaded' })
  const postcode = page.getByPlaceholder(/postcode/i)
  await expect(async () => {
    await postcode.fill('M1 1AE')
    await postcode.press('Enter')
    await expect(page).toHaveURL(/\/start\/result/, { timeout: 4000 })
  }).toPass({ timeout: 60000 })
  await page.getByRole('button', { name: /skip for now/i }).click({ timeout: 60000 })
  await page.getByTestId('zone-filterbar').waitFor({ state: 'visible', timeout: 90000 })
}

test.describe('Zone filters — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test.describe.configure({ timeout: 180000 })

  test('bar sits below the hero picks; headings follow the filters; Clear restores rails', async ({ page }) => {
    await enterZoneAsGuest(page)
    await expect(page.locator('.zone-rail--hero .zone-rail-title')).toHaveText(/start here/i)
    const heroBottom = await page.locator('.zone-rail--hero').evaluate((e) => e.getBoundingClientRect().bottom + scrollY)
    const barTop = await page.getByTestId('zone-filterbar').evaluate((e) => e.getBoundingClientRect().top + scrollY)
    expect(barTop).toBeGreaterThanOrEqual(heroBottom - 4)

    await page.getByRole('button', { name: /^Saves money/ }).first().click()
    await expect(page.locator('[data-testid="zone-results"] .zone-rail-title')).toHaveText('Saves money')
    // Personal picks do not disappear while browsing is filtered.
    await expect(page.locator('.zone-rail--hero [data-rec-card]')).toHaveCount(3)

    // Every category lives in one dropdown, not a row of chips.
    await expect(page.locator('.zone-chip-scroller')).toHaveCount(0)
    await page.getByTestId('zone-category-menu').click()
    await expect(page.getByRole('listbox')).toBeVisible()
    expect(await page.getByRole('option').count()).toBeGreaterThanOrEqual(5)
    await page.getByRole('option', { name: /^HOME/ }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(page.locator('[data-testid="zone-results"] .zone-rail-title')).toHaveText('Home · Saves money')

    await page.getByRole('button', { name: /^Clear/ }).first().click()
    await expect(page.locator('#zone-rail-biggest')).toHaveCount(1)
    await expect(page.getByTestId('zone-results')).toHaveCount(0)
  })

  test('the category dropdown is keyboard operable: arrows move, Enter selects, Esc closes', async ({ page }) => {
    await enterZoneAsGuest(page)
    const menu = page.getByTestId('zone-category-menu')
    await menu.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(menu).toBeFocused()
    await menu.click()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(menu).not.toHaveText(/all categories/i)
  })

  test('the bar pins to the top while scrolling', async ({ page }) => {
    await enterZoneAsGuest(page)
    await page.evaluate(() => window.scrollTo(0, document.querySelector('[data-testid="zone-filterbar"]')!.getBoundingClientRect().top + scrollY + 200))
    await expect.poll(() => page.getByTestId('zone-filterbar').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(0)
  })
})

test.describe('Zone filters — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test.describe.configure({ timeout: 180000 })

  test('Filters opens a bottom sheet: Esc closes, applying shows a badge and a removable chip', async ({ page }) => {
    await enterZoneAsGuest(page)
    const trigger = page.getByTestId('zone-filters-trigger')
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'Filters' })
    await expect(sheet).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(trigger).toBeFocused()

    await trigger.click()
    await sheet.getByRole('button', { name: /^Saves money/ }).click()
    await sheet.getByRole('button', { name: /^Show \d+ result/ }).click()
    await expect(page.locator('.zone-filters-badge')).toHaveText('1')
    await expect(page.locator('.zone-chip--removable')).toBeVisible()
    await expect(page.locator('[data-testid="zone-results"] .zone-rail-title')).toHaveText('Saves money')
    // Removing the chip clears the filter.
    await page.locator('.zone-chip--removable').click()
    await expect(page.getByTestId('zone-results')).toHaveCount(0)
  })

  test('nothing overflows sideways and tap targets are at least 40px', async ({ page }) => {
    await enterZoneAsGuest(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    const h = await page.getByTestId('zone-category-menu').evaluate((e) => e.getBoundingClientRect().height)
    expect(h).toBeGreaterThanOrEqual(40)
  })
})
