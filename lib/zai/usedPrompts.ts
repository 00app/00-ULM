/**
 * Remembers which suggested questions someone has already asked Zai, so the pills stop offering
 * them: on /zai, on later visits, and in a card's Ask Zai sheet. Anything sent counts, typed or
 * tapped, so typing a pill's exact words removes that pill too. Local only (per device); the
 * thread itself lives in zai_messages and is also checked, so a restored thread hides its pills.
 */

export const ZAI_USED_PROMPTS_KEY = 'zz_zai_used_prompts_v1'
const MAX_REMEMBERED = 200

/** Case, spacing and trailing punctuation do not make a question different. */
export function normalisePrompt(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?.!]+$/, '')
}

export function readUsedPrompts(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(ZAI_USED_PROMPTS_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function markPromptUsed(text: string): void {
  if (typeof window === 'undefined') return
  const key = normalisePrompt(text)
  if (!key) return
  try {
    const used = readUsedPrompts()
    if (used.has(key)) return
    const next = [...used, key].slice(-MAX_REMEMBERED)
    window.localStorage.setItem(ZAI_USED_PROMPTS_KEY, JSON.stringify(next))
  } catch {
    /* storage blocked: pills still drop within this thread via `askedInThread` */
  }
}

/** Prompts not yet asked: neither remembered on this device nor already in the visible thread. */
export function remainingPrompts(
  prompts: readonly string[],
  used: ReadonlySet<string>,
  askedInThread: readonly string[] = []
): string[] {
  const asked = new Set(askedInThread.map(normalisePrompt))
  return prompts.filter((p) => {
    const k = normalisePrompt(p)
    return !used.has(k) && !asked.has(k)
  })
}
