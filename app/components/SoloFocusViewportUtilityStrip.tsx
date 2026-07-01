'use client'

import { FixedViewportPortal } from '@/app/components/FixedViewportPortal'
import { CloseXOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'

type SoloFocusViewportUtilityStripProps = {
  onClose: () => void
  hidden?: boolean
}

/** Close — same viewport lock + X glyph as Likes / Zai / Settings (.zz-back-btn--viewport-lock). */
export function SoloFocusViewportUtilityStrip({ onClose, hidden }: SoloFocusViewportUtilityStripProps) {
  if (hidden) return null
  return (
    <FixedViewportPortal>
      <button
        type="button"
        className="zz-back-btn zz-back-btn--viewport-lock zz-modal-close-btn"
        aria-label="Close"
        onClick={onClose}
      >
        <span className="zz-back-arrow" aria-hidden>
          <CloseXOutlineIcon size={18} />
        </span>
      </button>
    </FixedViewportPortal>
  )
}
