import type { MetadataRoute } from 'next'
import { ROUTES } from '@/lib/routes'
import { getSiteUrl } from '@/lib/site'

/**
 * Only pages a stranger can use without an account. Personal surfaces (Zone, profile, settings,
 * saved, Zai, the agents) are noindex and left out: to a crawler they are empty shells, and
 * listing them dilutes the pages that should rank.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const now = new Date()

  const entries: { path: string; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']; priority: number }[] = [
    { path: ROUTES.HOME, changeFrequency: 'weekly', priority: 1 },
    { path: ROUTES.START, changeFrequency: 'weekly', priority: 0.9 },
    { path: ROUTES.PRIVACY, changeFrequency: 'yearly', priority: 0.3 },
  ]

  return entries.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))
}
