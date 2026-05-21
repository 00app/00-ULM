'use client'

import { ZAI_CHAT_SUGGESTED_PROMPTS } from '@/lib/zai/chatPrompts'
import { INDUSTRIAL_OPACITY_SNAP } from '@/lib/animations'
import { motion } from 'framer-motion'

type ZaiSuggestPillsProps = {
  disabled?: boolean
  onPick: (prompt: string) => void
}

export default function ZaiSuggestPills({ disabled, onPick }: ZaiSuggestPillsProps) {
  return (
    <motion.div
      className="zai-suggest-row zai-suggest-row--inline"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={INDUSTRIAL_OPACITY_SNAP}
      role="group"
      aria-label="Suggested prompts"
    >
      {ZAI_CHAT_SUGGESTED_PROMPTS.map((prompt) => (
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
