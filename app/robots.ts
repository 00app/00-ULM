import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Personal pages are not blocked here on purpose: they carry `noindex`, and a crawler has
        // to be allowed to fetch a page to see that. Only machine endpoints are disallowed.
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
