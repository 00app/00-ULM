'use client'

import { useRouter } from 'next/navigation'
import { FixedViewportPortal } from '@/app/components/FixedViewportPortal'
import { CloseXOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'
import { ROUTES } from '@/lib/routes'

type ZoneModalCloseLinkProps = {
  ariaLabel?: string
  className?: string
  /** Fires before navigation — e.g. dispatch Zone refresh after Zai audit. */
  onClose?: () => void
}

/** Fixed top-right close — modal exit back to Zone (Zai / Likes / Settings). */
export default function ZoneModalCloseLink({
  ariaLabel = 'Close and return to Zone',
  className,
  onClose,
}: ZoneModalCloseLinkProps) {
  const router = useRouter()

  return (
    <FixedViewportPortal>
      <button
        type="button"
        className={['zz-back-btn zz-back-btn--viewport-lock zz-modal-close-btn', className]
          .filter(Boolean)
          .join(' ')}
        aria-label={ariaLabel}
        onClick={() => {
          onClose?.()
          router.push(ROUTES.ZONE)
        }}
      >
        <span className="zz-back-arrow" aria-hidden>
          <CloseXOutlineIcon size={18} />
        </span>
      </button>
    </FixedViewportPortal>
  )
}
