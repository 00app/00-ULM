'use client'

/**
 * Single shell for every route: session → page transition wrapper → pulse widget.
 * Registry below maps each App Router `page.tsx` (audit / spec sync — no page imports).
 */
import { useEffect } from 'react'
import SessionStateRehydrate from '@/app/components/SessionStateRehydrate'
import PulseWidget from '@/app/components/debug/PulseWidget'
import { PulseExpandedDiagnosticsProvider } from '@/app/context/PulseExpandedDiagnosticsContext'
import { ROUTES } from '@/lib/routes'
import { usePathname } from 'next/navigation'

export function GlobalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hidePulse =
    pathname === ROUTES.SETTINGS ||
    pathname?.startsWith(`${ROUTES.SETTINGS}/`) ||
    pathname === ROUTES.HOME ||
    pathname === ROUTES.INTRO ||
    pathname === ROUTES.PROFILE_SUMMARY ||
    pathname?.startsWith(`${ROUTES.PROFILE_SUMMARY}/`) ||
    pathname?.startsWith('/admin')

  const introStage =
    pathname === ROUTES.HOME || pathname === ROUTES.INTRO

  /** Intro is a fixed-stage sequence — lock viewport (global body padding otherwise exceeds 100vh). Zone is the long wall. */
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const onIntro = pathname === ROUTES.HOME || pathname === ROUTES.INTRO
    const onZone = pathname === ROUTES.ZONE || pathname?.startsWith(`${ROUTES.ZONE}/`)

    if (onIntro) {
      html.classList.add('zz-intro-document-lock')
      html.style.overflowY = 'hidden'
      body.style.overflowY = 'hidden'
      html.classList.remove('zz-zone-document')
    } else if (onZone) {
      html.style.overflowY = 'auto'
      body.style.overflowY = 'auto'
      html.classList.add('zz-zone-document')
    } else {
      html.classList.remove('zz-intro-document-lock')
      html.style.overflowY = ''
      body.style.overflowY = ''
      html.classList.remove('zz-zone-document')
    }

    return () => {
      html.classList.remove('zz-intro-document-lock')
      html.style.overflowY = ''
      body.style.overflowY = ''
      html.classList.remove('zz-zone-document')
    }
  }, [pathname])

  return (
    <PulseExpandedDiagnosticsProvider>
      <SessionStateRehydrate />
      <div
        className={`zz-main-perspective-shell${introStage ? ' zz-intro-stage-lock' : ''}`}
        style={{ position: 'relative', width: '100%', minHeight: introStage ? undefined : '100vh' }}
      >
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
