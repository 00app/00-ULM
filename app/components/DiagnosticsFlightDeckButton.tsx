'use client'

import { motion } from 'framer-motion'
import { FAMILY_PULSE_TRANSITION } from '@/lib/motion-family'

type DiagnosticsFlightDeckButtonProps = {
  onClick: () => void
  active?: boolean
}

export default function DiagnosticsFlightDeckButton({
  onClick,
  active = false,
}: DiagnosticsFlightDeckButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="settings-circle-cta settings-circle-cta--yellow"
      whileTap={{ scale: 0.985 }}
      transition={FAMILY_PULSE_TRANSITION}
      aria-label="Open mechanical truth diagnostics"
      aria-pressed={active}
    >
      <span className="settings-circle-cta__label zz-h4">WIRING</span>
    </motion.button>
  )
}
