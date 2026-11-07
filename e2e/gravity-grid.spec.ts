import { test, expect, type Page } from '@playwright/test'

/**
 * Gravity Grid (app/components/brand/GravityGrid.tsx): the brand background field.
 * - Reduced motion: the front door and the workspace render as before (baseline screenshots).
 * - Motion on: a drag leaves blue dots along its path, and nothing logs a console error.
 * - Input is untouched: horizontal rails still scroll with the grid on.
 *
 * Baselines live in e2e/gravity-grid.spec.ts-snapshots/. Refresh them after an intended visual
 * change with: npx playwright test e2e/gravity-grid.spec.ts --update-snapshots
 */

type GridWindow = Window & { __gravityGrid?: { getStats(): { awake: boolean; maxOffset: number; tinted: number } } }

/** Guests without a session get a 401 from /api/answers on every page; that is not the grid. */
const KNOWN_NOISE = [/Failed to load resource: the server responded with a status of 401/]

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !KNOWN_NOISE.some((re) => re.test(m.text()))) errors.push(m.text())
  })
  return errors
}

async function waitForGrid(page: Page) {
  await page.waitForFunction(() => Boolean((window as GridWindow).__gravityGrid), null, { timeout: 60000 })
  await page.waitForFunction(() => (window as GridWindow).__gravityGrid?.getStats().awake === false, null, {
    timeout: 10000,
  })
}

/**
 * Reads the canvas itself (so it works under cards and text too). A point counts when a dot near it
 * has moved off the rest colour toward blue: R < 205 (rest is 217; even the 0.12 cap over quiet text
 * is 188). `blue` counts strongly tinted dots (R < 150) anywhere on the path.
 */
async function bluePixelsAlong(page: Page, y: number, x0: number, x1: number): Promise<{ hits: number; points: number; blue: number }> {
  return page.evaluate(
    ({ y, x0, x1 }) => {
      const c = document.querySelector<HTMLCanvasElement>('canvas.zz-gravity-grid')!
      const s = c.width / c.clientWidth
      const ctx = c.getContext('2d')!
      let hits = 0
      let points = 0
      let blue = 0
      for (let x = x0; x <= x1; x += 24) {
        points++
        const d = ctx.getImageData(Math.round((x - 12) * s), Math.round((y - 12) * s), Math.round(24 * s), Math.round(24 * s)).data
        let hit = false
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 128 && d[i + 2] > 200) {
            if (d[i] < 205) hit = true
            if (d[i] < 150) blue++
          }
        }
        if (hit) hits++
      }
      return { hits, points, blue }
    },
    { y, x0, x1 },
  )
}

/** The Zone greeting changes with the time of day. */
// Vercel Analytics' debug script is refused (403) to WebKit by its CDN; it is not part of the grid.
test.beforeEach(async ({ page }) => {
  await page.route('https://va.vercel-scripts.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  )
})

const MASK = (page: Page) => [page.locator('.zone-hero-copy')]
/** The Next.js dev badge lives in a shadow root whose host has no box, so it can't be masked. */
const HIDE_DEV_OVERLAY = 'nextjs-portal { display: none !important; }'

test.describe('Gravity Grid — reduced motion matches baseline', () => {
  test.use({ viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: 'reduce' } })
  test.describe.configure({ timeout: 120000 })

  for (const path of ['/', '/zone']) {
    test(`${path} looks as before`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      // Wait for the page itself, not just the grid: Zone shows the boot logo while it loads.
      await page.locator(path === '/' ? '.zzfd-hero' : '[data-testid="zone-section-welcome"]').waitFor({ timeout: 90000 })
      await page.locator('.app-boot-glitch').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {})
      await waitForGrid(page)
      await page.addStyleTag({ content: HIDE_DEV_OVERLAY })
      // Wait for the Typekit face so runs compare like for like.
      await page.evaluate(async () => {
        await document.fonts.ready
        await document.fonts.load('400 16px helvetica-neue-lt-pro').catch(() => [])
      })
      await page.waitForTimeout(1500)
      await expect(page).toHaveScreenshot(`reduced-${path === '/' ? 'front-door' : 'zone'}.png`, {
        animations: 'disabled',
        mask: MASK(page),
        maxDiffPixelRatio: 0.01,
      })
    })
  }
})

test.describe('Gravity Grid — motion on', () => {
  test.describe.configure({ timeout: 120000 })

  for (const [path, width, height] of [
    ['/', 1440, 900],
    ['/', 390, 844],
    ['/zone', 390, 844],
  ] as const) {
    test(`${path} @${width}: drag leaves blue along the path, no console errors`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      const errors = collectErrors(page)
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await waitForGrid(page)
      const y = Math.round(height * 0.55)
      const x0 = 40
      const x1 = width - 40
      await page.mouse.move(x0, y)
      await page.mouse.down()
      for (let k = 1; k <= 30; k++) {
        await page.mouse.move(x0 + ((x1 - x0) * k) / 30, y)
        await page.waitForTimeout(16)
      }
      const along = await bluePixelsAlong(page, y, x0 + 24, x1 - 24)
      const stats = await page.evaluate(() => (window as GridWindow).__gravityGrid!.getStats())
      await page.mouse.up()
      expect(along.hits / along.points, `tint at ${along.hits}/${along.points} points on y=${y}`).toBeGreaterThan(0.8)
      expect(along.blue, 'strongly blue dots on the path').toBeGreaterThan(0)
      expect(stats.maxOffset).toBeGreaterThan(0.5)
      expect(stats.maxOffset).toBeLessThanOrEqual(14.5)
      // Settles and stops requesting frames.
      await page.waitForFunction(() => (window as GridWindow).__gravityGrid?.getStats().awake === false, null, {
        timeout: 8000,
      })
      expect(errors).toEqual([])
    })
  }
})

test.describe('Gravity Grid — input untouched', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test.describe.configure({ timeout: 180000 })

  test('Zone rails still scroll sideways with the grid on', async ({ page }) => {
    await page.goto('/start', { waitUntil: 'domcontentloaded' })
    const postcode = page.getByPlaceholder(/postcode/i)
    await expect(async () => {
      await postcode.fill('M1 1AE')
      await postcode.press('Enter')
      await expect(page).toHaveURL(/\/start\/result/, { timeout: 4000 })
    }).toPass({ timeout: 60000 })
    await page.getByTestId('first-result').or(page.getByTestId('first-result-none')).waitFor({ timeout: 60000 })
    await page.goto('/zone', { waitUntil: 'domcontentloaded' })
    await waitForGrid(page)
    const rail = page.locator('.zone-rail-scroller').first()
    await rail.waitFor({ state: 'visible', timeout: 90000 })
    await rail.scrollIntoViewIfNeeded()
    const box = (await rail.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const before = await rail.evaluate((el) => el.scrollLeft)
    await page.mouse.wheel(300, 0)
    await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before)
  })
})
