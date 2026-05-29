'use client'

import { motion } from 'framer-motion'
import { FixedViewportPortal } from '@/app/components/FixedViewportPortal'
import BackArrowDownLeft from '@/app/components/BackArrowDownLeft'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'

type SoloFocusViewportUtilityStripProps = {
  onClose: () => void
}

/** Close — portaled top-right (matches Likes / Zai / Settings modal close). */
export function SoloFocusViewportUtilityStrip({ onClose }: SoloFocusViewportUtilityStripProps) {
  return (
    <FixedViewportPortal>
      <div
        className="solo-focus-utility-strip solo-focus-utility-strip--viewport-lock flex flex-col items-end"
        aria-label="Solo focus actions"
      >
        <motion.button
          type="button"
          aria-label="Close"
          className="solo-focus-close-circle"
          onClick={onClose}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={INDUSTRIAL_OPACITY_SNAP}
          style={{ transformOrigin: 'top right' }}
        >
          <BackArrowDownLeft size={24} />
        </motion.button>
      </div>
    </FixedViewportPortal>
  )
}
