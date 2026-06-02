'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { preloadAppFonts } from '@/lib/architecturalPulse'
import { ROUTES } from '@/lib/routes'

/** Routes that render Marvin before first paint (ticker / zone welcome). */
function routeNeedsMarvinWarmup(path: string): boolean {
  if (path === ROUTES.HOME || path === ROUTES.INTRO) return true
  if (path === ROUTES.PROFILE_SUMMARY) return true
  if (path === ROUTES.ZONE || path.startsWith(`${ROUTES.ZONE}/`)) return true
  if (path === ROUTES.PROFILE) return true
  return false
}

/**
 * Load Marvin only on routes that use it immediately — avoids global layout preload warnings on /profile etc.
 */
export default function RouteFontWarmup() {
  const pathname = usePathname() ?? '/'

  useEffect(() => {
    if (!routeNeedsMarvinWarmup(pathname)) return
    void preloadAppFonts()
  }, [pathname])

  return null
}
