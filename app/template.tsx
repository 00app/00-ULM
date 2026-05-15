'use client'

/**
 * Route-level fussy snap.
 * Re-mounts on navigation; pairs with FloatingNav moves between Zone / Zai / Likes / Settings.
 */
import { motion } from 'framer-motion'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={INDUSTRIAL_OPACITY_SNAP}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  )
}
