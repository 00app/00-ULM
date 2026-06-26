/**
 * Production env hardening — fail fast on missing or weak service secrets.
 */

const MIN_SECRET_LEN = 16

function secretLen(name: string): number {
  return (process.env[name] ?? '').trim().length
}

/** Called from `instrumentation.ts` on server boot. */
export function assertProductionSecurityEnv(): void {
  if (process.env.NODE_ENV !== 'production') return

  const missing: string[] = []
  if (secretLen('SESSION_SECRET') < MIN_SECRET_LEN) missing.push('SESSION_SECRET (≥16 chars)')
  if (secretLen('CRON_SECRET') < MIN_SECRET_LEN) missing.push('CRON_SECRET (≥16 chars)')

  if (secretLen('SCRAPER_SECRET') < MIN_SECRET_LEN) {
    console.error(
      '[security] SCRAPER_SECRET unset — POST /api/scrape-sync triggers require a distinct SCRAPER_SECRET (CRON_SECRET is cron-only).'
    )
  }

  const cron = process.env.CRON_SECRET?.trim() ?? ''
  const scraper = process.env.SCRAPER_SECRET?.trim() ?? ''
  if (cron.length >= MIN_SECRET_LEN && scraper.length >= MIN_SECRET_LEN && cron === scraper) {
    console.error(
      '[security] CRON_SECRET and SCRAPER_SECRET must differ in production — use separate values.'
    )
  }

  const admin = process.env.ADMIN_PASSWORD?.trim() ?? ''
  if (admin && admin.length < MIN_SECRET_LEN) {
    console.error('[security] ADMIN_PASSWORD should be ≥16 characters in production.')
  }

  if (missing.length > 0) {
    throw new Error(`Production security env missing: ${missing.join(', ')}`)
  }
}
