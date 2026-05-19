'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface FloatingNavProps {
  active: 'likes' | 'zone' | 'summary' | 'chat'
  onNavigate: (key: 'likes' | 'zone' | 'summary' | 'chat') => void
  /** Reserved for future badge / tip signal (no motion in nav). */
  hasNewTipForZai?: boolean
}

const ICON_SIZE = 18

/**
 * Floating Nav — 40×40px circles (no button padding), 18px icons, 12px gap.
 * Order: Likes · Zai (centre) · Settings. Portaled to `document.body`.
 */
export default function FloatingNav({ active, onNavigate, hasNewTipForZai: _hasNewTipForZai = false }: FloatingNavProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5)
  }

  const navLabels: Record<'likes' | 'summary' | 'chat', string> = { likes: 'Likes', summary: 'Settings', chat: 'Zai' }
  const navButton = (
    key: 'likes' | 'summary' | 'chat',
    isActive: boolean,
    children: React.ReactNode,
    variant: 'default' | 'zai' = 'default',
  ) => (
    <button
      type="button"
      className="nav-item-circle"
      aria-label={navLabels[key]}
      onClick={() => {
        triggerHaptic()
        onNavigate(key)
      }}
    >
      <span
        className={`nav-item-circle-inner floating-nav-item ${isActive ? 'floating-nav-item--active' : ''}`}
        style={
          variant === 'zai'
            ? { background: 'transparent' }
            : { background: isActive ? 'var(--color-pink)' : 'var(--color-yellow)' }
        }
      >
        {variant === 'zai' ? (
          <span className="kinetic-zai-disc" aria-hidden>
            <svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--color-purple)' }}
              aria-hidden
            >
              <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V12A8.5 8.5 0 0 1 11.5 3.5h1A8.5 8.5 0 0 1 21 12z" />
              <circle cx="9.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="12.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
            </svg>
          </span>
        ) : (
          <span className="nav-item-circle-icon">{children}</span>
        )}
      </span>
    </button>
  )

  const nav = (
    <div className="floating-nav" role="navigation" aria-label="Main">
      {navButton(
        'likes',
        active === 'likes',
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 35 32" fill="none">
          <path
            d="M9.99026 0.25C4.15156 0.25 0.25 5.11997 0.25 10.5401C0.25 15.6253 3.09299 20.0208 6.56909 23.4893C10.0452 26.9579 14.1934 29.5292 17.0399 31.0213C17.2616 31.1356 17.5242 31.1356 17.7458 31.0213C20.5923 29.5292 24.7405 26.9579 28.2166 23.4893C31.6927 20.0208 34.5357 15.6253 34.5357 10.5401C34.5357 5.11997 30.6342 0.25 24.7955 0.25C21.3536 0.25 19.067 2.03256 17.3929 4.44281C15.7187 2.03256 13.4321 0.25 9.99026 0.25ZM9.99026 1.83309C13.3281 1.83309 15.1569 3.52462 16.7231 6.18658C16.9432 6.56217 17.4217 6.68565 17.7914 6.46203C17.9029 6.39475 17.996 6.30016 18.0626 6.18658C19.6288 3.52462 21.4581 1.83309 24.7955 1.83309C29.7934 1.83309 32.9773 5.87273 32.9773 10.5401C32.9773 15.0218 30.43 19.0496 27.121 22.3515C23.9325 25.5331 20.1225 27.9528 17.3929 29.4136C14.6632 27.9532 10.8532 25.5331 7.66467 22.3515C4.35571 19.0496 1.80844 15.0218 1.80844 10.5401C1.80844 5.87273 4.99234 1.83309 9.99026 1.83309Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </svg>,
      )}
      {navButton('chat', active === 'chat', null, 'zai')}
      {navButton(
        'summary',
        active === 'summary',
        <svg
          width={ICON_SIZE}
          height={ICON_SIZE}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>,
      )}
    </div>
  )

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(nav, document.body)
}
