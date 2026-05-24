'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  HeartOutlineIcon,
  ProfileOutlineIcon,
  ZaiSparkIcon,
} from '@/app/components/ui/MonoStrokeIcons'

interface FloatingNavProps {
  active: 'likes' | 'zone' | 'summary' | 'chat'
  onNavigate: (key: 'likes' | 'zone' | 'summary' | 'chat') => void
  /** Reserved for future badge / tip signal (no motion in nav). */
  hasNewTipForZai?: boolean
  /** Zone desktop: hero rail owns nav — keep bottom dock + Ask Zai only. */
  className?: string
}

const ICON_SIZE = 18

/**
 * Floating Nav — 40×40px circles (no button padding), 18px icons, 12px gap.
 * Order: Likes · Zai (centre) · Settings. Portaled to `document.body`.
 */
export default function FloatingNav({
  active,
  onNavigate,
  hasNewTipForZai: _hasNewTipForZai = false,
  className,
}: FloatingNavProps) {
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
            <ZaiSparkIcon size={ICON_SIZE} style={{ color: 'var(--color-purple)' }} />
          </span>
        ) : (
          <span className="nav-item-circle-icon">{children}</span>
        )}
      </span>
    </button>
  )

  const nav = (
    <div
      className={['floating-nav', className].filter(Boolean).join(' ')}
      role="navigation"
      aria-label="Main"
    >
      {navButton(
        'likes',
        active === 'likes',
        <HeartOutlineIcon size={ICON_SIZE} />,
      )}
      {navButton('chat', active === 'chat', null, 'zai')}
      {navButton(
        'summary',
        active === 'summary',
        <ProfileOutlineIcon size={ICON_SIZE} />,
      )}
    </div>
  )

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(nav, document.body)
}
