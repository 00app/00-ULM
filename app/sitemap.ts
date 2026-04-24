import type { MetadataRoute } from 'next'
import { ROUTES } from '@/lib/routes'
import { getSiteUrl } from '@/lib/site'

/** Public routes worth indexing; app dashboards stay discoverable but lower priority than entry points. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const now = new Date()

  const entries: { path: string; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']; priority: number }[] = [
    { path: ROUTES.HOME, changeFrequency: 'weekly', priority: 1 },
    { path: ROUTES.INTRO, changeFrequency: 'monthly', priority: 0.9 },
    { path: ROUTES.ZONE, changeFrequency: 'weekly', priority: 0.85 },
    { path: ROUTES.PROFILE, changeFrequency: 'monthly', priority: 0.6 },
    { path: ROUTES.PROFILE_SUMMARY, changeFrequency: 'monthly', priority: 0.55 },
    { path: ROUTES.ZAI, changeFrequency: 'monthly', priority: 0.55 },
    { path: ROUTES.LIKES, changeFrequency: 'monthly', priority: 0.45 },
    { path: ROUTES.SETTINGS, changeFrequency: 'monthly', priority: 0.4 },
  ]

  return entries.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))
}
