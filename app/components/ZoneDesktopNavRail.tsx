'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'
import {
  HeartOutlineIcon,
  ProfileOutlineIcon,
  ZaiSparkIcon,
} from '@/app/components/ui/MonoStrokeIcons'

const ICON_SIZE = 18

/**
 * Desktop-only vertical nav in the Zone hero gallery column (Likes · Zai · Settings).
 */
export default function ZoneDesktopNavRail() {
  const router = useRouter()

  const item = (label: string, onClick: () => void, children: ReactNode) => (
    <button
      type="button"
      className="zone-desktop-nav-item"
      aria-label={label}
      onClick={onClick}
    >
      <span className="zone-desktop-nav-item-inner">{children}</span>
    </button>
  )

  return (
    <nav className="zone-desktop-nav-rail" aria-label="Zone shortcuts">
      {item('Likes', () => router.push(ROUTES.LIKES), <HeartOutlineIcon size={ICON_SIZE} />)}
      {item('Ask Zai', () => router.push(ROUTES.ZAI), <ZaiSparkIcon size={ICON_SIZE} />)}
      {item('Settings', () => router.push(ROUTES.SETTINGS), <ProfileOutlineIcon size={ICON_SIZE} />)}
    </nav>
  )
}
