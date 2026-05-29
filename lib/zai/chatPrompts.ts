/**
 * Zai system voice — canonical export for routing docs; implementation in `lib/brains/zai/prompts.ts`.
 */
export {
  ZAI_FORENSIC_CHAT_MATRIX,
  ZAI_PERFORMANCE_AUDITOR_V3_MATRIX,
  ZAI_EDITORIAL_AUDITOR_DNA,
  buildSystemPrompt,
} from '@/lib/brains/zai/prompts'

/** Quick prompts on /zai — same beat as Solo Focus deep-dive pills. */
export const ZAI_CHAT_SUGGESTED_PROMPTS = [
  'where should i start?',
  'cut home energy bills',
  'travel without the guilt',
  'what grant fits me?',
  'one change this week',
] as const

export const ZAI_INTRO_LINES = [
  'i read your zone — money, carbon, and what you actually do at home.',
  'pick a prompt or ask your own. one uk move, this week.',
] as const
