import type { Metadata, Viewport } from 'next'
import './globals.css'
import './cards.css'
import './zone.css'
import './journey-grid.css'
import './floating-nav.css'
import './sheet.css'
import './animations.css'
import { AppProvider } from './context/AppContext'

export const metadata: Metadata = {
  title: 'Zero Zero',
  description: 'Understand and reduce your everyday impact',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}
