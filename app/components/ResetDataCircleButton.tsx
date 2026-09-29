'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'
import { clearAllAppUserData } from '@/lib/utils/migrate'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { FAMILY_DUR_SHORT, FAMILY_EASE } from '@/lib/motion-family'

const ARM_TIMEOUT_MS = 4000

/**
 * Factory reset — same behaviour as Settings → RESET DATA.
 * Two-tap in-app confirm instead of window.confirm(): native confirm() silently no-ops (returns
 * false, no visible dialog) in several mobile WebView / PWA-standalone / in-app-browser contexts,
 * which made this destructive action look completely unresponsive there.
 */
export function ResetDataCircleButton() {
  const router = useRouter()
  const reduceMotion = useHydrationSafeReducedMotion()
  const [armed, setArmed] = useState(false)
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current)
    }
  }, [])

  const runReset = async () => {
    clearAllAppUserData()
    try {
      await fetch('/api/reset', { method: 'POST', credentials: 'include' })
    } catch {
      // non-fatal — localStorage already cleared
    }
    window.location.href = ROUTES.INTRO
  }

  const handleClick = () => {
    if (!armed) {
      setArmed(true)
      disarmTimer.current = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS)
      return
    }
    if (disarmTimer.current) clearTimeout(disarmTimer.current)
    setArmed(false)
    void runReset()
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      className={`settings-circle-cta settings-circle-cta--secondary${armed ? ' selected' : ''}`}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={{ duration: FAMILY_DUR_SHORT, ease: FAMILY_EASE }}
      aria-label={
        armed
          ? 'Confirm reset: your profile, Zone wall, and session will be cleared, and this cannot be undone'
          : 'Reset all data'
      }
    >
      <span className="settings-circle-cta__label zz-h4">
        {armed ? (
          <>
            TAP TO
            <br />
            CONFIRM
          </>
        ) : (
          <>
            RESET
            <br />
            DATA
          </>
        )}
      </span>
    </motion.button>
  )
}
