'use client'

/**
 * Single shell for every route: session → page transition wrapper → pulse widget.
 * Registry below maps each App Router `page.tsx` (audit / spec sync — no page imports).
 */
import SessionStateRehydrate from '@/app/components/SessionStateRehydrate'
import PulseWidget from '@/app/components/debug/PulseWidget'
import { PulseExpandedDiagnosticsProvider } from '@/app/context/PulseExpandedDiagnosticsContext'
import { ROUTES } from '@/lib/routes'
import { usePathname } from 'next/navigation'

export function GlobalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hidePulse =
    pathname === ROUTES.SETTINGS || pathname?.startsWith(`${ROUTES.SETTINGS}/`)

  return (
    <PulseExpandedDiagnosticsProvider>
      <SessionStateRehydrate />
      <div className="zz-main-perspective-shell" style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>
        {children}
      </div>
      {!hidePulse ? <PulseWidget /> : null}
    </PulseExpandedDiagnosticsProvider>
  )
}

/** Every built page: path, source file under `app/`, short label. */
export const APP_PAGES_REGISTRY = [
  { path: ROUTES.HOME, sourceFile: 'app/page.tsx', name: 'Home' },
  { path: ROUTES.INTRO, sourceFile: 'app/intro/page.tsx', name: 'Intro' },
  { path: ROUTES.PROFILE, sourceFile: 'app/profile/page.tsx', name: 'Profile' },
  { path: ROUTES.PROFILE_SUMMARY, sourceFile: 'app/profile/summary/page.tsx', name: 'Summary' },
  { path: ROUTES.ZONE, sourceFile: 'app/zone/page.tsx', name: 'Zone' },
  { path: ROUTES.ZAI, sourceFile: 'app/zai/page.tsx', name: 'Ask Zai' },
  { path: ROUTES.LIKES, sourceFile: 'app/likes/page.tsx', name: 'Likes' },
  { path: ROUTES.SETTINGS, sourceFile: 'app/settings/page.tsx', name: 'Settings' },
] as const

export type AppPageRegistryEntry = (typeof APP_PAGES_REGISTRY)[number]
