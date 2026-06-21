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
})

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Zero Zero | Save Money and Carbon',
    template: '%s | Zero Zero',
  },
  description:
    'Track your carbon impact and financial waste. Practical tips to save £10k and 10.7t CO2/year.',
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
    title: 'Zero Zero | Save Money and Carbon',
    description:
      'Track your carbon impact and financial waste. Practical tips to save £10k and 10.7t CO2/year.',
    type: 'website',
    siteName: 'Zero Zero',
    locale: 'en_GB',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zero Zero | Save Money and Carbon',
    description:
      'Track your carbon impact and financial waste. Practical tips to save £10k and 10.7t CO2/year.',
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
      'Track your carbon impact and financial waste. Practical tips to save £10k and 10.7t CO2/year.',
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
        <link
          rel="preload"
          href="/assets/Marvin%20Visions%20Bold.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
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
