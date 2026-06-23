"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_INITIAL,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

export default function ZaiComposerDock({
  children,
  className,
  bodyClass = 'zai-composer-dock-active',
}: {
  children: React.ReactNode
  className?: string
  bodyClass?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!mounted || typeof document === 'undefined' || !bodyClass) return
    document.body.classList.add(bodyClass)
    return () => document.body.classList.remove(bodyClass)
  }, [mounted, bodyClass])

  const dock = (
    <motion.div
      className={['zai-composer-dock zai-composer-dock--fixed', className].filter(Boolean).join(' ')}
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
