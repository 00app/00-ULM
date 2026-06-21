/**
 * Session ledger — each Solo Focus card gets distinct prose (no repeated openers across the wall).
 */

import type { JourneyId } from '@/lib/journeys'
import { formatCarbonValue, formatMoneyValue } from '@/lib/format'
import {
  buildAuditorNarrativeParagraphs,
  payoffSentence,
  proofSentenceVariant,
} from '@/lib/zone/auditorNarrative'

const LEDGER_KEY = 'zz_sf_prose_ledger'
const LEDGER_MAX = 64

function proseFingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 14)
    .join(' ')
}

function readLedger(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(LEDGER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeLedger(entries: string[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(LEDGER_KEY, JSON.stringify(entries.slice(-LEDGER_MAX)))
  } catch {
    /* quota */
  }
}

export function isSessionProseDuplicate(text: string): boolean {
  const fp = proseFingerprint(text)
  if (fp.length < 12) return false
  return readLedger().some((prev) => {
    const p = proseFingerprint(prev)
    const n = Math.min(48, fp.length, p.length)
    return n >= 12 && (fp.slice(0, n) === p.slice(0, n) || fp.includes(p) || p.includes(fp))
  })
}

export function rememberSessionProse(text: string): void {
  const fp = proseFingerprint(text)
  if (fp.length < 12) return
  const ledger = readLedger()
  if (ledger.some((prev) => proseFingerprint(prev) === fp)) return
  writeLedger([...ledger, text.trim()])
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export type SessionProseVarietyContext = {
  cardId?: string | null
  journeyId: JourneyId
  headline: string
  moneyGbp: number
  carbonKg: number
  userPostcode?: string | null
  sourceDisplayName?: string | null
  auditHeaderLocality?: string | null
}

function freshNarrativeBeat(ctx: SessionProseVarietyContext, beatIndex: number): string {
  const seed = hashSeed(`${ctx.cardId ?? ctx.headline}:${beatIndex}`)
  const src = (ctx.sourceDisplayName ?? '').trim() || 'UK Government'
  const pc = (ctx.userPostcode ?? '').trim() || 'your postcode'
  const narrative = buildAuditorNarrativeParagraphs({
    userPostcode: pc,
    sourceName: src,
    journey: ctx.journeyId,
    moneyGbp: ctx.moneyGbp,
    carbonKg: ctx.carbonKg,
    locality: ctx.auditHeaderLocality ?? '',
    cardId: ctx.cardId ?? undefined,
    proofVariant: seed % 3,
  })
  if (beatIndex === 2) {
    const m = Math.max(0, Math.round(ctx.moneyGbp))
    const c = Math.max(0, Math.round(ctx.carbonKg))
    const topic = ctx.journeyId.replace(/-/g, ' ')
    const variants = [
      payoffSentence(ctx.journeyId, ctx.moneyGbp, ctx.carbonKg),
      `Your audit row carries about £${formatMoneyValue(m)} a year and ${formatCarbonValue(c)} on ${topic} — numbers from your profile, not a template.`,
      proofSentenceVariant(ctx.journeyId, src, pc, seed + 1),
    ]
    return variants[seed % variants.length] ?? narrative[beatIndex] ?? narrative[0]!
  }
  return narrative[beatIndex] ?? narrative[0]!
}

/** Replace session-duplicated paragraphs so each card reads fresh in Forensic Mate voice. */
export function applySessionProseVariety(prose: string, ctx: SessionProseVarietyContext): string {
  const trimmed = prose.trim()
  if (!trimmed) return trimmed

  const blocks = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const out: string[] = []
  for (let i = 0; i < blocks.length; i++) {
    let block = blocks[i]!
    if (isSessionProseDuplicate(block)) {
      let alt = freshNarrativeBeat(ctx, i)
      let guard = 0
      while (isSessionProseDuplicate(alt) && guard < 4) {
        alt = freshNarrativeBeat(ctx, i + guard + 1)
        guard++
      }
      block = alt
    }
    if (block.trim()) {
      out.push(block)
      rememberSessionProse(block)
    }
  }

  if (out.length === 0) {
    const fallback = buildAuditorNarrativeParagraphs({
      userPostcode: ctx.userPostcode?.trim() || 'your postcode',
      sourceName: (ctx.sourceDisplayName ?? '').trim() || 'UK Government',
      journey: ctx.journeyId,
      moneyGbp: ctx.moneyGbp,
      carbonKg: ctx.carbonKg,
      locality: ctx.auditHeaderLocality ?? '',
      cardId: ctx.cardId ?? undefined,
    }).join('\n\n')
    rememberSessionProse(fallback)
    return fallback
  }

  return out.join('\n\n')
}
