'use client'

import Link from 'next/link'
import { FixedViewportPortal } from '@/app/components/FixedViewportPortal'
import { CloseXOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'
import { ROUTES } from '@/lib/routes'

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
    <FixedViewportPortal>
      <Link
        href={ROUTES.ZONE}
        className={['zz-back-btn zz-back-btn--viewport-lock', className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
      >
        <span className="zz-back-arrow" aria-hidden>
          <CloseXOutlineIcon size={24} />
        </span>
      </Link>
    </FixedViewportPortal>
  )
}
