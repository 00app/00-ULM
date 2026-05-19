'use client'

import { useRouter } from 'next/navigation'
import FloatingNav from '@/app/components/FloatingNav'
import { ROUTES } from '@/lib/routes'

export type AppFloatingNavActive = 'likes' | 'zone' | 'summary' | 'chat'

/** Portaled nav — Likes · Zai · Settings wired to `ROUTES`. */
export default function AppFloatingNav({ active }: { active: AppFloatingNavActive }) {
  const router = useRouter()
  return (
    <FloatingNav
      active={active}
      onNavigate={(key) => {
        const dest =
          key === 'likes'
            ? ROUTES.LIKES
            : key === 'chat'
              ? ROUTES.ZAI
              : key === 'summary'
                ? ROUTES.SETTINGS
                : ROUTES.ZONE
        router.push(dest)
      }}
    />
  )
}
