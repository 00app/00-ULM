'use client'

import { usePathname, useRouter } from 'next/navigation'
import FloatingNav from '@/app/components/FloatingNav'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { ROUTES } from '@/lib/routes'

function normalizeAppPath(p: string | null): string {
  const raw = (p ?? '').trim()
  if (!raw || raw === '/') return '/'
  return raw.replace(/\/+$/, '') || '/'
}

/** Modal-style routes — close × only; no portaled pink nav. */
function isFloatingNavExcludedRoute(path: string): boolean {
  return (
    path === ROUTES.ZAI ||
    path === ROUTES.LIKES ||
    path === ROUTES.SETTINGS ||
    path.startsWith(`${ROUTES.ZAI}/`) ||
    path.startsWith(`${ROUTES.LIKES}/`) ||
    path.startsWith(`${ROUTES.SETTINGS}/`)
  )
}

export type AppFloatingNavActive = 'likes' | 'zone' | 'summary' | 'chat'

/** Portaled nav — Likes · Zai · Settings wired to `ROUTES`. */
export default function AppFloatingNav({
  active,
  className,
}: {
  active: AppFloatingNavActive
  className?: string
}) {
  const router = useRouter()
  const path = normalizeAppPath(usePathname())
  if (isFloatingNavExcludedRoute(path)) return null

  return (
    <FloatingNav
      active={active}
      className={className}
      onNavigate={(key) => {
        const dest =
          key === 'likes'
            ? ROUTES.LIKES
            : key === 'chat'
              ? ROUTES.ZAI
              : key === 'summary'
                ? ROUTES.SETTINGS
                : ROUTES.ZONE
        trackFunnelEvent('nav_click', { page: path, nav_key: key, target_url: dest })
        router.push(dest)
      }}
    />
  )
}
