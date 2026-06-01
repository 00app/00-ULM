'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AtomicLogo } from '@/app/components/Logo'

type AppBootGlitchProps = {
  label?: string
  className?: string
}

/**
 * App-wide segment loading — Atomic Assembly power-on (same material as intro).
 * Portaled to `document.body` so `perspective` on `.zz-main-perspective-shell`
 * does not trap `position: fixed` or clip the logo at the viewport top.
 */
export function AppBootGlitch({
  label = 'Loading Zero Zero',
  className = 'app-boot-glitch app-boot-atomic',
}: AppBootGlitchProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className={className} role="status" aria-live="polite" aria-label={label}>
      <AtomicLogo loop width={100} />
    </div>,
    document.body
  )
}
