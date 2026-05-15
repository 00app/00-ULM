'use client'

import { motion } from 'framer-motion'
import { Logo } from '@/app/components/Logo'

export function ZeroGateShutter({ show = true }: { show?: boolean }) {
  return (
    <>
      {show ? (
        <motion.div
          key="zz-route-gate"
          className="zz-route-gate-shutter"
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 2 }}
          transition={{ duration: 0.12, ease: 'linear' }}
          aria-live="polite"
          aria-busy
          aria-label="Zero Zero gate"
        >
          <motion.div
            animate={{ opacity: [1, 0.72, 1] }}
            transition={{ duration: 0.36, repeat: Infinity, ease: 'linear' }}
          >
            <Logo width={132} className="zz-gate-logo" />
          </motion.div>
        </motion.div>
      ) : null}
    </>
  )
}
