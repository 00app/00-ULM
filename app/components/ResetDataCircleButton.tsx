'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'
import { clearAllAppUserData } from '@/lib/utils/migrate'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { FAMILY_DUR_SHORT, FAMILY_EASE } from '@/lib/motion-family'

/** Factory reset — same behaviour as Settings → RESET DATA. */
export function ResetDataCircleButton() {
  const router = useRouter()
  const reduceMotion = useHydrationSafeReducedMotion()

  const handleReset = () => {
    const ok = window.confirm(
      'Reset all data on this device? Your profile, Zone wall, and session will be cleared. This cannot be undone.'
    )
    if (!ok) return
    clearAllAppUserData()
    router.push(ROUTES.INTRO)
    window.location.href = ROUTES.INTRO
  }

  return (
    <motion.button
      type="button"
      onClick={handleReset}
      className="settings-circle-cta settings-circle-cta--pink"
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={{ duration: FAMILY_DUR_SHORT, ease: FAMILY_EASE }}
      aria-label="Reset all data"
    >
      <span className="settings-circle-cta__label zz-h4">
        RESET
        <br />
        DATA
      </span>
    </motion.button>
  )
}
