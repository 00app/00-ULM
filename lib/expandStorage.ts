/**
 * Session storage for Zone ↔ Zai handoff.
 * Solo Focus Q&A + recommendations live in `JourneyBentoCard` only.
 * `setExpandCard` stores the selected card snapshot for optional telemetry / Ask Zai context.
 */

const KEY = 'zz_expand_card'
const FROM_KEY = 'zz_expand_from'
const ASK_ZAI_CONTEXT_KEY = 'zz_ask_zai_context'

export type ExpandFrom = 'zone' | 'zai' | 'summary'

export interface StoredExpandCard {
  id: string
  title: string
  journey_key: string
  data?: { money?: string; carbon?: string }
  explanation?: string[]
  localCouncilTip?: string
  source?: string
  sourceLabel?: string
  actions?: { actionType?: string; learnUrl?: string; actionUrl?: string }
  /** Dynamic CTA from True Card schema (e.g. "Get this Saving", "Check My Eligibility") */
  cta?: { label: string; url: string }
  /** Card-to-question loop: when answered, update memory and trigger research refresh */
  followUp?: { question: string; options: string[]; targetField: string }
}

/** Context sent to Zai when user asks from Expanded View (category expert + Saving Gap). */
export interface AskZaiContext {
  category: string
  personalSpend: string
  regionalAvg: string
  question: string
  /** Solo Focus / bento headline — Zai must not repeat this as editorial copy. */
  shift_title?: string
  /** Active card id when user taps Ask / Like from Solo Focus. */
  card_id?: string
  card_title?: string
  source_url?: string
  /** Active Solo Focus embedded question (e.g. DEVICE COUNT?) when user taps Ask */
  journey_question_label?: string | null
  userContext?: any
  scraped_source?: string
  journey_answers_jsonb?: any
}

/** Zai handoff copy: prefer the live journey question label when the embed chamber is open. */
export function buildSoloFocusAskZaiQuestion(cardTitle: string, journeyQuestionLabel: string | null | undefined): string {
  const t = String(cardTitle || '').trim() || 'this card'
  const q = String(journeyQuestionLabel ?? '').trim()
  if (q) return `${q} — I'm on "${t}" in Zero Zero. Help me save or cut carbon for this.`
  return `I want to know more about "${t}" and how I can save. Can you help?`
}

export function setExpandCard(card: StoredExpandCard, from: ExpandFrom) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(card))
    sessionStorage.setItem(FROM_KEY, from)
  } catch {
    // ignore
  }
}

export function getExpandCard(): StoredExpandCard | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredExpandCard
  } catch {
    return null
  }
}

export function getExpandFrom(): ExpandFrom | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(FROM_KEY)
    if (v === 'zone' || v === 'zai' || v === 'summary') return v
    return null
  } catch {
    return null
  }
}

/** Store context + question when user submits from Expanded View Ask Zai input; Zai page consumes and sends to API. */
export function setAskZaiContext(ctx: AskZaiContext) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(ASK_ZAI_CONTEXT_KEY, JSON.stringify(ctx))
  } catch {
    // ignore
  }
}

export function getAskZaiContext(): AskZaiContext | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(ASK_ZAI_CONTEXT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AskZaiContext
  } catch {
    return null
  }
}

export function clearAskZaiContext() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(ASK_ZAI_CONTEXT_KEY)
  } catch {
    // ignore
  }
}

/** Placeholder for Ask XI: "Ask XI about {category topic}" */
export const ASK_XI_TOPIC: Record<string, string> = {
  home: 'your energy tariffs',
  travel: 'travel',
  food: 'food',
  shopping: 'shopping',
  money: 'money',
  carbon: 'carbon',
  tech: 'tech',
  waste: 'waste',
  holidays: 'holidays',
}

export function getAskXiPlaceholder(category: string): string {
  const topic = ASK_XI_TOPIC[category] ?? category
  return `Ask XI about ${topic}...`
}
