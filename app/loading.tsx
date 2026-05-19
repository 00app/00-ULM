'use client'

import { AppBootGlitch } from '@/app/components/AppBootGlitch'

/**
 * Segment loading — glitch logo at route transitions (avoids empty suspense + stale chunk flash).
 */
export default function Loading() {
  return <AppBootGlitch />
}
