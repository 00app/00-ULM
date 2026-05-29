/**
 * Ask Zai (/zai) UI + turn-taking rules — keep layout and API behaviour aligned.
 * Scrape sandbox, onboarding vs Zone ownership: `lib/zai/chatBoundaries.ts`.
 * Persona + read-only truth: `lib/brains/zai/prompts.ts`.
 * Full matrix: `docs/ZAI-AND-QUESTIONS-RULES.md`.
 */

export type ZaiChatTurn = {
  role: 'user' | 'zai'
  text: string
}

/** ULM chat chrome — yellow field, dark ink (see `app/globals.css` --zai-* tokens). */
export const ZAI_CHAT_VISUAL_RULES = {
  bubbleBackground: '#FFD700',
  bubbleText: '#1A1A1A',
  noGradients: true,
} as const

/**
 * Zai = forensic read-only layer (Warm Auditor's digital twin).
 * Zone cards stay editorial; Zai proves why/how from stored genome + research_results.
 */
export const ZAI_ANALYTICAL_MATE_RULES = {
  voice: 'direct, evidence-based, slightly dry uk mate',
  samplePhrases: [
    'the math checks out because',
    'your stored row shows',
    'for your home in',
  ],
  /** Zai explains mechanism — never rewrites the card's 3-beat "what". */
  noRepeatCardThreeBeat: true,
  /** Only interpret User Summary + research_results + journey answers + buildUserImpact. */
  readOnlyData: true,
  noInventedSavings: true,
} as const

/** Intro copy is always shown; thread messages are appended after it. */
export const ZAI_CHAT_LAYOUT_RULES = {
  introAlwaysVisible: true,
  pillsAfterLastZaiTurn: true,
  pillsAfterIntroWhenNoZaiReplies: true,
  pillsHiddenWhileLoading: true,
  connectingIndicatorInFixedDock: true,
  inputFixedInDock: true,
  closeButtonViewportLocked: true,
} as const

export function lastZaiMessageIndex(messages: ZaiChatTurn[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role === 'zai' && m.text.trim().length > 0) return i
  }
  return -1
}

/** Quick prompts sit under the latest finished Zai bubble, not under user sends. */
export function shouldShowZaiSuggestedPills(messages: ZaiChatTurn[], loading: boolean): boolean {
  if (loading) return false
  const last = messages[messages.length - 1]
  if (!last) return true
  if (last.role === 'user') return false
  return last.role === 'zai' && last.text.trim().length > 0
}

/** Pills attach below intro when there is no non-empty Zai reply in the thread yet. */
export function zaiPillsBelongAfterIntro(messages: ZaiChatTurn[]): boolean {
  return lastZaiMessageIndex(messages) < 0
}
