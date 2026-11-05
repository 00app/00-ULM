'use client'

import Link from 'next/link'
import { FixedViewportPortal } from '@/app/components/FixedViewportPortal'
import { CloseXOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'
import { ROUTES } from '@/lib/routes'
import { useSmartBack } from '@/lib/nav/useSmartBack'

type ZoneModalCloseLinkProps = {
  ariaLabel?: string
  className?: string
  /** Fires before navigation — e.g. dispatch Zone refresh after Zai audit. */
  onClose?: () => void
  /** Where to go when there is no in-app page to go back to. @default Zone */
  fallbackHref?: string
}

/** Fixed top-right close (Zai / Likes): back to where you came from, else `fallbackHref`. */
export default function ZoneModalCloseLink({
  ariaLabel = 'Close',
  className,
  onClose,
  fallbackHref = ROUTES.ZONE,
}: ZoneModalCloseLinkProps) {
  const goBack = useSmartBack(fallbackHref)
  return (
    <FixedViewportPortal>
      <Link
        href={fallbackHref}
        className={['zz-back-btn zz-back-btn--viewport-lock zz-modal-close-btn', className]
          .filter(Boolean)
          .join(' ')}
        aria-label={ariaLabel}
        onClick={(e) => {
          onClose?.()
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          goBack()
        }}
      >
        <span className="zz-back-arrow" aria-hidden>
          <CloseXOutlineIcon size={18} />
        </span>
      </Link>
    </FixedViewportPortal>
  )
}
