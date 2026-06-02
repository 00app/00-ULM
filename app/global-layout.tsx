'use client'

/**
 * Single shell for every route: session → page transition wrapper.
 * Registry below maps each App Router `page.tsx` (audit / spec sync — no page imports).
 */
import { useEffect, useMemo } from 'react'
import SessionStateRehydrate from '@/app/components/SessionStateRehydrate'
import RouteFontWarmup from '@/app/components/RouteFontWarmup'
import NeonWakePing from '@/app/components/NeonWakePing'
import { PulseExpandedDiagnosticsProvider } from '@/app/context/PulseExpandedDiagnosticsContext'
import { ROUTES } from '@/lib/routes'
import { usePathname } from 'next/navigation'

function normalizeAppPath(p: string | null): string {
  const raw = (p ?? '').trim()
  if (!raw || raw === '/') return '/'
  return raw.replace(/\/+$/, '') || '/'
}

export function GlobalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const path = normalizeAppPath(pathname)

  /** Intro, onboarding, summary — single viewport, no page scroll (same shell lock as intro). */
  const fixedViewportStage = useMemo(
    () =>
      path === ROUTES.HOME ||
      path === ROUTES.INTRO ||
      path === ROUTES.PROFILE ||
      path === ROUTES.PROFILE_SUMMARY,
    [path]
  )

  /** Intro is a fixed-stage sequence — lock viewport (global body padding otherwise exceeds 100vh). Zone is the long wall. */
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const onZone = path === ROUTES.ZONE || path.startsWith(`${ROUTES.ZONE}/`)
    const onZai = path === ROUTES.ZAI || path.startsWith(`${ROUTES.ZAI}/`)

    if (fixedViewportStage) {
      html.classList.add('zz-intro-document-lock')
      html.style.overflowY = 'hidden'
      body.style.overflowY = 'hidden'
      html.classList.remove('zz-zone-document')
      html.classList.remove('zz-zai-document')
    } else if (onZone) {
      html.style.overflowY = 'auto'
      body.style.overflowY = 'auto'
      html.classList.add('zz-zone-document')
      html.classList.remove('zz-zai-document')
    } else if (onZai) {
      html.style.overflowY = 'auto'
      body.style.overflowY = 'auto'
      html.classList.add('zz-zai-document')
      html.classList.remove('zz-zone-document')
      html.classList.remove('zz-intro-document-lock')
    } else {
      html.classList.remove('zz-intro-document-lock')
      html.style.overflowY = ''
      body.style.overflowY = ''
      html.classList.remove('zz-zone-document')
      html.classList.remove('zz-zai-document')
    }

    return () => {
      html.classList.remove('zz-intro-document-lock')
      html.style.overflowY = ''
      body.style.overflowY = ''
      html.classList.remove('zz-zone-document')
      html.classList.remove('zz-zai-document')
    }
  }, [path, fixedViewportStage])

  return (
    <PulseExpandedDiagnosticsProvider>
      <NeonWakePing />
      <SessionStateRehydrate />
      <RouteFontWarmup />
      <div
        className={`zz-main-perspective-shell${fixedViewportStage ? ' zz-intro-stage-lock' : ''}`}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          minHeight: fixedViewportStage ? '100dvh' : '100vh',
        }}
      >
        {children}
      </div>
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
