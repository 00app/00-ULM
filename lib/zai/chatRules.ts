/**
 * Ask Zai (/zai) UI + turn-taking rules — keep layout and API behaviour aligned.
 * Scrape sandbox, onboarding vs Zone ownership: `lib/zai/chatBoundaries.ts`.
 * Full matrix: `docs/ZAI-AND-QUESTIONS-RULES.md`.
 */

export type ZaiChatTurn = {
  role: 'user' | 'zai'
  text: string
}

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
