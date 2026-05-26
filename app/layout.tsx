import { Analytics } from '@vercel/analytics/next'
import { AppProvider } from '@/app/context/AppContext'
import { GlobalAppShell } from '@/app/global-layout'
import InteractiveBackground from '@/app/components/ui/InteractiveBackground'
import { getSiteUrl } from '@/lib/site'
import './globals.css'

import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'

const roboto = Roboto({
  weight: ['400', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
  preload: true,
})

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Zero Zero — UK energy, carbon & money savings',
    template: '%s | Zero Zero',
  },
  description:
    'Zero Zero is a UK-first web app that turns your profile and postcode into clearer savings and lower carbon: home energy, travel, food, and habits — with local context and 2026 price-cap-aware guidance. Cut bills, cut CO₂, stay on one lane per journey.',
  keywords: [
    'UK energy savings',
    'lower electricity bill UK',
    'gas bill UK',
    'Ofgem price cap',
    'home energy Scotland',
    'postcode carbon footprint',
    'reduce carbon footprint UK',
    'save money energy UK',
    'household emissions UK',
    'energy habits',
    'sustainability app UK',
    'Zero Zero',
  ],
  authors: [{ name: 'Zero Zero', url: siteUrl }],
  creator: 'Zero Zero',
  publisher: 'Zero Zero',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'Zero Zero — UK energy, carbon & money savings',
    description:
      'Personalised UK dashboard for savings and carbon: journeys, local context, and clear next steps — built for 2026 household energy reality.',
    type: 'website',
    siteName: 'Zero Zero',
    locale: 'en_GB',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zero Zero — UK energy, carbon & money savings',
    description:
      'Cut bills and carbon with a UK-first journey dashboard — local context, savings stamps, and habit wins.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: '/',
  },
  category: 'technology',
}

/** Mobile-first: layout and touch targets designed for 320px viewport */
export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Zero Zero',
    description:
      'UK-first web app for household energy savings, carbon reduction, and journey-based guidance with local postcode context.',
    url: siteUrl,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    inLanguage: 'en-GB',
  }

  return (
    <html
      lang="en-GB"
      className={roboto.variable}
      style={{ backgroundColor: '#2a004a' }}
      suppressHydrationWarning
    >
      <head>
        {/* Marvin: `@font-face` in globals.css. Body: Roboto via next/font. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body
        className={roboto.className}
        suppressHydrationWarning
        style={{
          backgroundColor: 'transparent',
          minHeight: '100vh',
          margin: 0,
          position: 'relative',
        }}
      >
        {/* Liquid mesh + grain — always mounted (no ClientOnly gate); see .zz-background-env in globals.css */}
        <InteractiveBackground />
        <AppProvider>
          <GlobalAppShell>{children}</GlobalAppShell>
        </AppProvider>
        <Analytics />
      </body>
    </html>
  )
}
