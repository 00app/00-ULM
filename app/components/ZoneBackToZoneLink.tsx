'use client'

import Link from 'next/link'
import { FixedViewportPortal } from '@/app/components/FixedViewportPortal'
import { CloseXOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'
import { ROUTES } from '@/lib/routes'
import { useSmartBack } from '@/lib/nav/useSmartBack'

type ZoneBackToZoneLinkProps = {
  /** @default 'Back' */
  ariaLabel?: string
  className?: string
  /** Where to go when there is no in-app page to go back to. @default Zone */
  fallbackHref?: string
}

/**
 * Fixed top-right close circle. Goes back to the page you came from (browser history, scroll
 * restored); with no in-app page behind it, to `fallbackHref`. The href stays the fallback so
 * middle-click / open-in-new-tab still work. Same markup everywhere so the control cannot drift.
 */
export default function ZoneBackToZoneLink({
  ariaLabel = 'Back',
  className,
  fallbackHref = ROUTES.ZONE,
}: ZoneBackToZoneLinkProps) {
  const goBack = useSmartBack(fallbackHref)
  return (
    <FixedViewportPortal>
      <Link
        href={fallbackHref}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          goBack()
        }}
        className={['zz-back-btn zz-back-btn--viewport-lock', className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
      >
        <span className="zz-back-arrow" aria-hidden>
          <CloseXOutlineIcon size={18} />
        </span>
      </Link>
    </FixedViewportPortal>
  )
}
