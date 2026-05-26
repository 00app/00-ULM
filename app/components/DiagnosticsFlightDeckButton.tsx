'use client'

import { motion } from 'framer-motion'
import { FAMILY_PULSE_TRANSITION } from '@/lib/motion-family'

/** Terminal pulse — Flight Deck trigger (Settings). */
function PulseTerminalIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="4 17 10 11 14 15 20 9" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  )
}

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
      className={[
        'settings-flight-deck-btn zz-family-bloom',
        active ? 'settings-flight-deck-btn--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      whileTap={{ scale: 1.05 }}
      transition={FAMILY_PULSE_TRANSITION}
      aria-label="Open mechanical truth diagnostics"
      aria-pressed={active}
    >
      <PulseTerminalIcon />
    </motion.button>
  )
}
