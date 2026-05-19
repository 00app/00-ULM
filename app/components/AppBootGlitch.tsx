'use client'

import { GlitchLogo } from '@/app/components/Logo'

/**
 * App-wide segment loading — Style A glitch (same beat as `/` intro logo).
 */
export function AppBootGlitch({ label = 'Loading Zero Zero' }: { label?: string }) {
  return (
    <div className="app-boot-glitch" role="status" aria-live="polite" aria-label={label}>
      <GlitchLogo loop width={100} />
    </div>
  )
}
