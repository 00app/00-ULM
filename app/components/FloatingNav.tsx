'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  HeartOutlineIcon,
  ProfileOutlineIcon,
  ZaiSparkIcon,
} from '@/app/components/ui/MonoStrokeIcons'
import { ROUTES } from '@/lib/routes'
import { isZaiChatEnabled } from '@/lib/featureFlags'

interface FloatingNavProps {
  active: 'likes' | 'zone' | 'summary' | 'chat'
  /** Reserved for future badge / tip signal (no motion in nav). */
  hasNewTipForZai?: boolean
  /** Zone desktop: hero rail owns nav — keep bottom dock + Ask Zai only. */
  className?: string
}

const ICON_SIZE = 18

const NAV_HREF: Record<'likes' | 'summary' | 'chat', string> = {
  likes: ROUTES.LIKES,
  summary: ROUTES.SETTINGS,
  chat: ROUTES.ZAI,
}

/**
 * Floating Nav — 40×40px circles (no button padding), 18px icons, 12px gap.
 * Order: Likes · Zai (centre) · Settings. Portaled to `document.body`.
 */
export default function FloatingNav({
  active,
  hasNewTipForZai: _hasNewTipForZai = false,
  className,
}: FloatingNavProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5)
  }

  const navLabels: Record<'likes' | 'summary' | 'chat', string> = {
    likes: 'Likes',
    summary: 'Settings',
    chat: 'Zai',
  }

  const navLink = (
    key: 'likes' | 'summary' | 'chat',
    isActive: boolean,
    children: React.ReactNode,
    variant: 'default' | 'zai' = 'default',
  ) => (
    <Link
      href={NAV_HREF[key]}
      className="nav-item-circle"
      aria-label={navLabels[key]}
      onClick={() => triggerHaptic()}
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
    </Link>
  )

  const nav = (
    <div
      className={['floating-nav', className].filter(Boolean).join(' ')}
      role="navigation"
      aria-label="Main"
    >
      {navLink('likes', active === 'likes', <HeartOutlineIcon size={ICON_SIZE} />)}
      {isZaiChatEnabled() ? navLink('chat', active === 'chat', null, 'zai') : null}
      {navLink('summary', active === 'summary', <ProfileOutlineIcon size={ICON_SIZE} />)}
    </div>
  )

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(nav, document.body)
}
