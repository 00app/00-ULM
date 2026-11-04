'use client'

import { FixedViewportPortal } from '@/app/components/FixedViewportPortal'
import { CloseXOutlineIcon } from '@/app/components/ui/MonoStrokeIcons'

type SoloFocusViewportUtilityStripProps = {
  onClose: () => void
  hidden?: boolean
  /** 44px round tint icon button (docs/BRAND-LANGUAGE.md); same position and behaviour. */
  brand?: boolean
}

/** Close — same viewport lock + X glyph as Likes / Zai / Settings (.zz-back-btn--viewport-lock). */
export function SoloFocusViewportUtilityStrip({ onClose, hidden, brand = false }: SoloFocusViewportUtilityStripProps) {
  if (hidden) return null
  if (brand) {
    return (
      <FixedViewportPortal>
        <span className="zz-brand">
          <button
            type="button"
            className="zz-back-btn zz-back-btn--viewport-lock zz-modal-close-btn zzb-icon-btn zzb-close-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <CloseXOutlineIcon size={18} />
          </button>
        </span>
      </FixedViewportPortal>
    )
  }
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
