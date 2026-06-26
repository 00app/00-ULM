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
  'Where should I start?',
  'Cut home energy bills',
  'Travel without the guilt',
  'What grant fits me?',
  'One change this week',
] as const

export const ZAI_INTRO_LINES = [
  'I read your zone — money, carbon, and what you actually do at home.',
  'Pick a prompt or ask your own. One UK move, this week.',
] as const
