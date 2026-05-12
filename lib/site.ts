/**
 * Canonical site origin for metadata, sitemap, and Open Graph.
 * Production: set NEXT_PUBLIC_SITE_URL (e.g. https://www.yourdomain.com).
 * Vercel: VERCEL_URL is used as fallback when the public URL is unset.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (explicit) return explicit
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
  return 'http://localhost:3000'
}
