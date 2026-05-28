'use client'

/**
 * Route-level fussy snap.
 * Re-mounts on navigation; pairs with FloatingNav moves between Zone / Zai / Likes / Settings.
 */
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { familyPageEnterProps, FAMILY_TRANSITION_ATOMIC } from '@/lib/motion-family'
import { ROUTES } from '@/lib/routes'

function normalizeAppPath(p: string | null): string {
  const raw = (p ?? '').trim()
  if (!raw || raw === '/') return '/'
  return raw.replace(/\/+$/, '') || '/'
}

/** Intro stack runs its own atomic sequence — skip route enter (opacity 0) or the shell stays blank. */
function isFixedViewportIntroPath(path: string): boolean {
  return (
    path === ROUTES.HOME ||
    path === ROUTES.INTRO ||
    path === ROUTES.PROFILE ||
    path === ROUTES.PROFILE_SUMMARY
  )
}

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const path = normalizeAppPath(pathname)
  const reduceMotion = useHydrationSafeReducedMotion()

  if (isFixedViewportIntroPath(path)) {
    return <div style={{ minHeight: '100%' }}>{children}</div>
  }

  const pageEnter = familyPageEnterProps(reduceMotion)
  return (
    <motion.div
      initial={pageEnter.initial}
      animate={pageEnter.animate}
      exit={pageEnter.exit}
      transition={pageEnter.transition ?? FAMILY_TRANSITION_ATOMIC}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  )
}
