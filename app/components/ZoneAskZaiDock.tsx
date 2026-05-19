'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { STACCATO_TWEEN } from '@/lib/animations'

/** Portaled Ask Zai pill — viewport bottom centre, aligned with the bento grid. */
export default function ZoneAskZaiDock({ onActivate }: { onActivate: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const dock = (
    <motion.div
      className="zone-ask-zai-dock"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={STACCATO_TWEEN}
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
