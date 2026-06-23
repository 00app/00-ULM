'use client'

import { useEffect, useRef } from 'react'
import { turnstileSiteKey } from '@/lib/security/botGuard'

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        }
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true })
    })
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.id = SCRIPT_ID
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('turnstile script failed'))
    document.head.appendChild(s)
  })
}

type Props = {
  onToken: (token: string | null) => void
  className?: string
}

/** Cloudflare Turnstile — only mounts when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. */
export function HumanCheckTurnstile({ onToken, className }: Props) {
  const siteKey = turnstileSiteKey()
  const hostRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!siteKey || !hostRef.current) return
    let cancelled = false

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => onToken(null))

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          /* ignore */
        }
      }
      widgetIdRef.current = null
    }
  }, [onToken, siteKey])

  if (!siteKey) return null

  return (
    <div
      ref={hostRef}
      className={className}
      aria-label="Confirm you are human"
      data-testid="human-check-turnstile"
    />
  )
}
