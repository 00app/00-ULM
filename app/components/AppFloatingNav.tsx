'use client'

import { usePathname } from 'next/navigation'
import FloatingNav from '@/app/components/FloatingNav'
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
  const path = normalizeAppPath(usePathname())
  if (isFloatingNavExcludedRoute(path)) return null

  return <FloatingNav active={active} className={className} />
}
