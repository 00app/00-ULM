'use client'

import { AtomicLogo } from '@/app/components/Logo'

/**
 * App-wide segment loading — Atomic Assembly power-on (same material as intro).
 */
export function AppBootGlitch({ label = 'Loading Zero Zero' }: { label?: string }) {
  return (
    <div className="app-boot-glitch app-boot-atomic" role="status" aria-live="polite" aria-label={label}>
      <AtomicLogo loop width={100} />
    </div>
  )
}
