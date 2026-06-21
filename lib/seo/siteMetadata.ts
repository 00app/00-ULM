import type { Metadata } from 'next'
import { CANONICAL_SITE_URL, getSiteUrl } from '@/lib/site'

const siteName = 'Zero Zero'
const defaultTitle = 'Zero Zero — save money and cut carbon at home'
const defaultDescription =
  'UK postcode-driven energy and lifestyle audit. Practical tips, verified offers, and Solo Focus actions to cut bills and household CO₂ — built for April 2026 tariffs and local grants.'

const ogImagePath = '/assets/00%20brand%20mark%20yellow.svg'

export function buildSiteMetadata(): Metadata {
  const siteUrl = getSiteUrl()
  const ogImageUrl = `${CANONICAL_SITE_URL}${ogImagePath}`

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultTitle,
      template: `%s · ${siteName}`,
    },
    description: defaultDescription,
    applicationName: siteName,
    keywords: [
      'Zero Zero',
      '00-00',
      'UK energy savings',
      'lower electricity bill UK',
      'gas bill UK',
      'Ofgem price cap 2026',
      'postcode carbon footprint',
      'household emissions UK',
      'energy audit UK',
      'heat pump grant UK',
      'solar panels UK',
      'save money energy UK',
      'sustainability app UK',
      'cycle to work scheme',
      'smart tariff UK',
    ],
    authors: [{ name: siteName, url: CANONICAL_SITE_URL }],
    creator: siteName,
    publisher: siteName,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      title: defaultTitle,
      description: defaultDescription,
      type: 'website',
      siteName,
      locale: 'en_GB',
      url: CANONICAL_SITE_URL,
      images: [
        {
          url: ogImageUrl,
          alt: 'Zero Zero — save money and cut carbon',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: defaultDescription,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: CANONICAL_SITE_URL,
    },
    category: 'technology',
    other: {
      'geo.region': 'GB',
      'geo.placename': 'United Kingdom',
    },
  }
}

export function buildSiteJsonLd(siteUrl: string): Record<string, unknown>[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: siteUrl,
      description: defaultDescription,
      inLanguage: 'en-GB',
      publisher: {
        '@type': 'Organization',
        name: siteName,
        url: siteUrl,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
      logo: `${CANONICAL_SITE_URL}/assets/00%20brand%20mark%20yellow.svg`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: siteName,
      description: defaultDescription,
      url: siteUrl,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      inLanguage: 'en-GB',
      audience: {
        '@type': 'Audience',
        geographicArea: {
          '@type': 'Country',
          name: 'United Kingdom',
        },
      },
    },
  ]
}
