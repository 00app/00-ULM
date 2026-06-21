/** Public marketing origin — SEO metadataBase, sitemap, Open Graph. Root `00-00.online` → 308 → here. */
export const CANONICAL_SITE_URL = 'https://www.00-00.online'

/** Same as CANONICAL_SITE_URL — API smoke, Hermes, Twilio, server-side fetch defaults. */
export const PRODUCTION_APP_URL = CANONICAL_SITE_URL

/**
 * Canonical site origin for metadata, sitemap, and Open Graph.
 * Production: set NEXT_PUBLIC_SITE_URL (defaults to CANONICAL_SITE_URL on Vercel production).
 * Vercel preview: VERCEL_URL when the public URL is unset.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (explicit) return explicit
  if (process.env.VERCEL_ENV === 'production') return CANONICAL_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
  return 'http://localhost:3000'
}

/** App/API base URL — prefers NEXT_PUBLIC_APP_URL, then getSiteUrl(). */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (explicit) return explicit
  return getSiteUrl()
}
