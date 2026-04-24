'use client'

import Link from 'next/link'
import { ROUTES } from '@/lib/routes'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'

type ZoneBackToZoneLinkProps = {
  /** @default 'Back to Zone' */
  ariaLabel?: string
  className?: string
}

/**
 * Fixed top-right purple circle → Zone. Same markup on Settings, Zai, Likes
 * so the control cannot drift (glyph, target size, stacking).
 */
export default function ZoneBackToZoneLink({ ariaLabel = 'Back to Zone', className }: ZoneBackToZoneLinkProps) {
  return (
    <Link href={ROUTES.ZONE} className={['zz-back-btn', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      <span className="zz-back-arrow" aria-hidden>
        <BackArrowDownLeft size={24} />
      </span>
    </Link>
  )
}
