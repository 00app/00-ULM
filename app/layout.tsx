import { Analytics } from '@vercel/analytics/next'
import { AppProvider } from '@/app/context/AppContext'
import { GlobalAppShell } from '@/app/global-layout'
import InteractiveBackground from '@/app/components/ui/InteractiveBackground'
import { buildSiteJsonLd, buildSiteMetadata } from '@/lib/seo/siteMetadata'
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
        {jsonLd.map((block, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
          />
        ))}
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
