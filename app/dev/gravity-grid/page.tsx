import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import GravityGridDev from './GravityGridDev'

/** Dev-only playground for the Gravity Grid. 404 in production builds. */
export const metadata: Metadata = {
  title: 'Gravity Grid (dev)',
  robots: { index: false, follow: false },
}

export default function GravityGridDevPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <GravityGridDev />
}
