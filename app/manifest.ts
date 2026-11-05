import type { MetadataRoute } from 'next'
import { DEFAULT_DESCRIPTION, SITE_NAME } from '@/lib/seo/siteMetadata'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME}: stop overpaying for your home`,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#FCFCFF',
    theme_color: '#141268',
    lang: 'en-GB',
    categories: ['finance', 'lifestyle', 'utilities'],
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
