'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ROUTES } from '@/lib/routes'

const ACK_KEY = 'zz_cookie_notice_v1'

/**
 * Essential-cookie transparency — session + zz_sid only (no ad/tracking opt-in matrix).
 * Copy: h4 / zz-h4 only per typographic lockdown.
 */
export function CookieEssentialNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(ACK_KEY) === '1') return
      setVisible(true)
    } catch {
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

  if (!visible) return null

  return (
    <aside
      className="cookie-essential-notice"
      role="dialog"
      aria-labelledby="cookie-essential-notice-line"
      aria-describedby="cookie-essential-notice-action"
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
    </aside>
  )
}
