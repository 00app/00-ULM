'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Logo } from '@/app/components/Logo'

export function ZeroGateShutter({ show = true }: { show?: boolean }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="zz-route-gate"
          className="zz-route-gate-shutter"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08 }}
          transition={{ duration: 0.45, ease: 'linear' }}
          aria-live="polite"
          aria-busy
          aria-label="Zero Zero gate"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [1, 0.72, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Logo width={132} className="zz-gate-logo" />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
