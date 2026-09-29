import { Analytics } from '@vercel/analytics/next'
import { AppProvider } from '@/app/context/AppContext'
import { GlobalAppShell } from '@/app/global-layout'
import InteractiveBackground from '@/app/components/ui/InteractiveBackground'
import CtaClickBurst from '@/app/components/ui/CtaClickBurst'
import SentenceCase from '@/app/components/ui/SentenceCase'
import { buildSiteJsonLd, buildSiteMetadata } from '@/lib/seo/siteMetadata'
import { getSiteUrl } from '@/lib/site'
import './globals.css'

import type { Metadata } from 'next'

const siteUrl = getSiteUrl()

export const metadata: Metadata = buildSiteMetadata()

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
  const jsonLd = buildSiteJsonLd(siteUrl)

  return (
    <html
      lang="en-GB"
      style={{ backgroundColor: '#FCFCFF' }}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        {/* Helvetica Neue LT Pro — Adobe Fonts / Typekit kit, not a next/font Google font */}
        <link rel="stylesheet" href="https://use.typekit.net/nfy2mes.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Abril Fatface — numerals only, see 'Abril Fatface Numerals' unicode-range face in globals.css.
            Not next/font, matching the Typekit link above — intentional, so disabling the lint rule. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap" rel="stylesheet" />
        {jsonLd.map((block, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
          />
        ))}
      </head>
      <body
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
        <CtaClickBurst />
        <SentenceCase />
        <AppProvider>
          <GlobalAppShell>{children}</GlobalAppShell>
        </AppProvider>
        <Analytics />
      </body>
    </html>
  )
}
