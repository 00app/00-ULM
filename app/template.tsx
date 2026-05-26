'use client'

/**
 * Route-level fussy snap.
 * Re-mounts on navigation; pairs with FloatingNav moves between Zone / Zai / Likes / Settings.
 */
import { motion } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { familyPageEnterProps, FAMILY_TRANSITION_ATOMIC } from '@/lib/motion-family'

export default function Template({ children }: { children: React.ReactNode }) {
  const reduceMotion = useHydrationSafeReducedMotion()
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
