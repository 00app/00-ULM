'use client'

import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'
import { motion } from 'framer-motion'

type ZaiSuggestPillsProps = {
  /** Only the prompts not yet asked (see lib/zai/usedPrompts.ts). Nothing renders when empty. */
  prompts: readonly string[]
  disabled?: boolean
  onPick: (prompt: string) => void
}

export default function ZaiSuggestPills({ prompts, disabled, onPick }: ZaiSuggestPillsProps) {
  if (prompts.length === 0) return null
  return (
    <motion.div
      className="zai-suggest-row zai-suggest-row--inline"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={INDUSTRIAL_OPACITY_SNAP}
      role="group"
      aria-label="Suggested prompts"
    >
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          className="zai-suggest-pill"
          onClick={() => onPick(prompt)}
        >
          {prompt}
        </button>
      ))}
    </motion.div>
  )
}
