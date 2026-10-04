'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { familyProfileStepProps, FAMILY_TRANSITION_ATOMIC } from '@/lib/motion-family'

/**
 * Shared frame for the entry flow screens (splash, postcode, first result): same single-viewport
 * shell and step motion the profile steps use, so nothing here introduces a new visual style.
 */
export default function EntryShell({
  children,
  maxWidth = 520,
  gap = 40,
}: {
  children: ReactNode
  maxWidth?: number
  gap?: number
}) {
  const reduceMotion = useHydrationSafeReducedMotion()
  const stepMotion = familyProfileStepProps(reduceMotion)
  return (
    <main
      className="zz-profile-page"
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        padding: 'clamp(20px, 3vw, 40px)',
        paddingTop: 'max(clamp(20px, 3vw, 40px), env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 40,
      }}
    >
      <motion.div
        className="profile-step-slam w-full flex flex-col items-center"
        style={{ gap, maxWidth }}
        initial={stepMotion.initial}
        animate={stepMotion.animate}
        transition={FAMILY_TRANSITION_ATOMIC}
      >
        {children}
      </motion.div>
    </main>
  )
}
