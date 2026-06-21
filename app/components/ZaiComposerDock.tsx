"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_INITIAL,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

export default function ZaiComposerDock({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return
    document.body.classList.add('zai-composer-dock-active')
    return () => document.body.classList.remove('zai-composer-dock-active')
  }, [mounted])

  const dock = (
    <motion.div
      className="zai-composer-dock zai-composer-dock--fixed"
      initial={FAMILY_ATOMIC_SURFACE_INITIAL}
      animate={FAMILY_ATOMIC_SURFACE_ANIMATE}
      transition={FAMILY_TRANSITION_ATOMIC}
    >
      {children}
    </motion.div>
  )

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(dock, document.body)
}
