'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  FAMILY_ATOMIC_SURFACE_ANIMATE,
  FAMILY_ATOMIC_SURFACE_INITIAL,
  FAMILY_TRANSITION_ATOMIC,
} from '@/lib/motion-family'

/** Portaled Ask Zai pill — viewport bottom centre, aligned with the bento grid. */
export default function ZoneAskZaiDock({ onActivate }: { onActivate: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return
    document.body.classList.add('zone-ask-zai-dock-active')
    return () => document.body.classList.remove('zone-ask-zai-dock-active')
  }, [mounted])

  const dock = (
    <motion.div
      className="zone-ask-zai-dock"
      data-testid="zone-ask-zai-dock"
      initial={FAMILY_ATOMIC_SURFACE_INITIAL}
      animate={FAMILY_ATOMIC_SURFACE_ANIMATE}
      transition={FAMILY_TRANSITION_ATOMIC}
    >
      <input
        type="text"
        placeholder="ASK ZAI..."
        className="zone-ask-zai-pill zone-ask-zai-pill--dock w-full rounded-full border-none outline-none focus:ring-2 focus:ring-[var(--color-yellow)] focus:ring-offset-2 focus:ring-offset-transparent caret-[var(--color-purple)]"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onActivate()
        }}
        onClick={onActivate}
        aria-label="Ask Zai — persistent brain of the Zone"
      />
    </motion.div>
  )

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(dock, document.body)
}
