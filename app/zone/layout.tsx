/**
 * Parallel `@modal` slot backs the intercepted /zone/card/[journeyKey] route (see
 * app/zone/@modal) — gives an open Solo Focus card a real, addressable URL without
 * changing how the card itself renders. See app/zone/page.tsx's expandedCardId <-> URL
 * sync effect for the other half of this.
 */
import type { Metadata } from 'next'

/** Personal dashboard: kept out of search results (empty to a crawler without a profile). */
export const metadata: Metadata = {
  title: 'Your Zone',
  description: 'Your savings, actions and agents in one place.',
  robots: { index: false, follow: true },
}

export default function ZoneLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
