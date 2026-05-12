'use client'

/**
 * Route-level mechanical shove — Snap DNA (not opacity fades).
 * Re-mounts on navigation; pairs with FloatingNav moves between Zone / Zai / Likes / Settings.
 */
import { motion } from 'framer-motion'
import { MECHANICAL_SNAP_SPRING } from '@/lib/animations'

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 1, x: 10, filter: 'blur(3px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={MECHANICAL_SNAP_SPRING}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  )
}
