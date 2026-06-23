'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHydrationSafeReducedMotion } from '@/lib/hooks/useHydrationSafeReducedMotion'
import { familyAtomicProps, FAMILY_TRANSITION_ATOMIC } from '@/lib/motion-family'
import { ROUTES } from '@/lib/routes'

const ACK_KEY = 'zz_cookie_notice_v1'

/**
 * Essential-cookie transparency — session + zz_sid only (no ad/tracking opt-in matrix).
 * Shown on intro goal screen only; fades in, then out once acknowledged.
 */
export function CookieEssentialNotice() {
  const reduceMotion = useHydrationSafeReducedMotion()
  const motionProps = familyAtomicProps(reduceMotion)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(ACK_KEY) === '1') return
      setMounted(true)
      setVisible(true)
    } catch {
      setMounted(true)
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(ACK_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!mounted) return null

  return (
    <AnimatePresence onExitComplete={() => setMounted(false)}>
      {visible ? (
        <motion.aside
          key="cookie-essential-notice"
          className="cookie-essential-notice"
          role="dialog"
          aria-labelledby="cookie-essential-notice-line"
          aria-describedby="cookie-essential-notice-action"
          initial={motionProps.initial}
          animate={motionProps.animate}
          exit={motionProps.exit}
          transition={FAMILY_TRANSITION_ATOMIC}
        >
          <h4 id="cookie-essential-notice-line" className="zz-h4 m-0 cookie-essential-notice__line">
            we use essential cookies to remember your session and zone — no ad trackers.
          </h4>
          <div className="cookie-essential-notice__actions">
            <h4 className="zz-h4 m-0">
              <Link href={ROUTES.PRIVACY} className="cookie-essential-notice__link">
                privacy
              </Link>
            </h4>
            <button
              type="button"
              id="cookie-essential-notice-action"
              className="cookie-essential-notice__btn zz-h4 m-0"
              onClick={dismiss}
            >
              got it
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
