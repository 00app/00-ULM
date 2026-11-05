import type { Metadata } from 'next'
import { CANONICAL_SITE_URL, getSiteUrl } from '@/lib/site'

export const SITE_NAME = 'Zero Zero'

/** Same promise as the front door's hero and lede, so search results and link previews match it. */
export const DEFAULT_TITLE = 'Zero Zero: stop overpaying for your home'
export const DEFAULT_DESCRIPTION =
  'Your bills, subscriptions and contracts in one workspace. Zero Zero finds what you are overpaying for, shows you why and prepares the fix. Free for UK households, every figure sourced.'

/*
 * Social preview image: app/opengraph-image.tsx and app/twitter-image.tsx generate a 1200x630
 * PNG (the old SVG brand mark did not render in WhatsApp, iMessage, Facebook, LinkedIn or X).
 * Next attaches it automatically only where a page does not set its own openGraph object, so
 * pageMetadata names it explicitly.
 */
const OG_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: DEFAULT_TITLE }
const TWITTER_IMAGE = '/twitter-image'

/**
 * Site-wide defaults. Deliberately no `alternates.canonical` here: a canonical set in the root
 * layout is inherited by every page, which told search engines that every page was a duplicate
 * of the homepage. Each indexable page sets its own via `pageMetadata`.
 */
export function buildSiteMetadata(): Metadata {
  const siteUrl = getSiteUrl()

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: DEFAULT_TITLE,
      template: `%s · ${SITE_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: [
      'stop overpaying bills UK',
      'household bills UK',
      'energy price cap October 2026',
      'cheaper energy tariff UK',
      'Warm Home Discount',
      'benefits check UK',
      'social tariff broadband',
      'council tax reduction',
      'cancel unused subscriptions',
      'out of contract broadband',
      'moving house checklist UK',
      'electricity price per kWh by postcode',
      'Zero Zero',
    ],
    authors: [{ name: SITE_NAME, url: CANONICAL_SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: { email: false, address: false, telephone: false },
    openGraph: {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_GB',
      url: '/',
    },
    twitter: {
      card: 'summary_large_image',
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
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
    category: 'finance',
    other: {
      'geo.region': 'GB',
      'geo.placename': 'United Kingdom',
    },
  }
}

/**
 * Per-page metadata with matching share card and canonical. `index: false` keeps personal,
 * signed-in or answer-dependent pages out of search results (they are thin or empty to a crawler)
 * while still giving shared links a proper preview.
 */
export function pageMetadata(opts: {
  title: string
  description: string
  path: string
  index?: boolean
  /** Use the title as given, without the "· Zero Zero" template. */
  absoluteTitle?: boolean
}): Metadata {
  const index = opts.index !== false
  const fullTitle = opts.absoluteTitle ? opts.title : `${opts.title} · ${SITE_NAME}`
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: fullTitle,
      description: opts.description,
      url: opts.path,
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_GB',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: opts.description,
      images: [TWITTER_IMAGE],
    },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
  }
}

/** Personal / signed-in surfaces: never in search results, links still followed. */
export const NOINDEX: Metadata = { robots: { index: false, follow: true } }

export function buildSiteJsonLd(siteUrl: string): Record<string, unknown>[] {
  const logo = `${CANONICAL_SITE_URL}/icon.svg`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: '00-00',
      url: siteUrl,
      description: DEFAULT_DESCRIPTION,
      inLanguage: 'en-GB',
      publisher: { '@type': 'Organization', name: SITE_NAME, url: siteUrl },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      alternateName: '00-00',
      url: siteUrl,
      logo,
      email: 'privacy@00-00.online',
      areaServed: { '@type': 'Country', name: 'United Kingdom' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      url: siteUrl,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      inLanguage: 'en-GB',
      featureList: [
        'Live electricity and gas unit rates for your postcode',
        'Bills, subscriptions and contracts in one place',
        'Benefits, discounts and social tariffs you may be missing',
        'Moving house checklist from council tax to insurance',
        'Every figure linked to its source',
      ],
      audience: {
        '@type': 'Audience',
        geographicArea: { '@type': 'Country', name: 'United Kingdom' },
      },
    },
  ]
}
