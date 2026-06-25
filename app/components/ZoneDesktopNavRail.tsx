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

const ICON_SIZE = 18

/**
 * Desktop / tablet nav — portaled to document.body so position:fixed is viewport-true
 * (perspective on .zz-main-perspective-shell breaks fixed inside main.zone).
 */
export default function ZoneDesktopNavRail({ visible = true }: { visible?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const isTabletUp = useViewportMinWidth(768)

  useEffect(() => setMounted(true), [])

  const item = (label: string, href: string, children: ReactNode) => (
    <Link href={href} className="zone-desktop-nav-item" aria-label={label}>
      <span className="zone-desktop-nav-item-inner">{children}</span>
    </Link>
  )

  const rail = (
    <nav className="zone-desktop-nav-rail" aria-label="Zone shortcuts" data-testid="zone-desktop-nav-rail">
      {item('Likes', ROUTES.LIKES, <HeartOutlineIcon size={ICON_SIZE} />)}
      {item('Ask Zai', ROUTES.ZAI, <ZaiSparkIcon size={ICON_SIZE} />)}
      {item('Settings', ROUTES.SETTINGS, <ProfileOutlineIcon size={ICON_SIZE} />)}
    </nav>
  )

  if (!visible || !mounted || !isTabletUp || typeof document === 'undefined') return null
  return createPortal(rail, document.body)
}
