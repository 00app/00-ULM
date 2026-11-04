'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ROUTES } from '@/lib/routes'
import { useViewportMinWidth } from '@/lib/hooks/useViewportMinWidth'
import {
  HeartOutlineIcon,
  ProfileOutlineIcon,
  ZaiSparkIcon,
} from '@/app/components/ui/MonoStrokeIcons'
import { isZaiChatEnabled } from '@/lib/featureFlags'
import { useLikesWaitingCount } from '@/lib/hooks/useLikesWaitingCount'

const ICON_SIZE = 18

/**
 * Desktop / tablet nav — portaled to document.body so position:fixed is viewport-true
 * (perspective on .zz-main-perspective-shell breaks fixed inside main.zone).
 */
export default function ZoneDesktopNavRail({ visible = true }: { visible?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const isTabletUp = useViewportMinWidth(768)
  const likesWaiting = useLikesWaitingCount()

  useEffect(() => setMounted(true), [])

  const item = (label: string, href: string, children: ReactNode, count?: number | null) => (
    <Link
      href={href}
      className="zone-desktop-nav-item"
      aria-label={count ? `${label}, ${count} waiting` : label}
    >
      <span className="zone-desktop-nav-item-inner">{children}</span>
      {count ? (
        <span className="nav-count-badge" aria-hidden>
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  )

  const rail = (
    <nav className="zone-desktop-nav-rail" aria-label="Zone shortcuts" data-testid="zone-desktop-nav-rail">
      {item('Likes', ROUTES.LIKES, <HeartOutlineIcon size={ICON_SIZE} />, likesWaiting)}
      {isZaiChatEnabled() ? item('Ask Zai', ROUTES.ZAI, <ZaiSparkIcon size={ICON_SIZE} />) : null}
      {item('Settings', ROUTES.SETTINGS, <ProfileOutlineIcon size={ICON_SIZE} />)}
    </nav>
  )

  if (!visible || !mounted || !isTabletUp || typeof document === 'undefined') return null
  return createPortal(rail, document.body)
}
