import { NextResponse } from 'next/server'
import { generateCardContextsBatch, type ContentArchitectCardInput } from '@/lib/agents/contentArchitect'
import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'

export const runtime = 'nodejs'

const ALLOWED = new Set<JourneyId>(JOURNEY_ORDER)

function sanitiseCard(raw: unknown): ContentArchitectCardInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const journey_key = o.journey_key
  if (typeof journey_key !== 'string' || !ALLOWED.has(journey_key as JourneyId)) return null
  const jk = journey_key as JourneyId
  const money_gbp = Number(o.money_gbp)
  const carbon_kg = Number(o.carbon_kg)
  const baseline_title = typeof o.baseline_title === 'string' ? o.baseline_title.slice(0, 200) : ''
  const baseline_insight =
    typeof o.baseline_insight === 'string' ? o.baseline_insight.slice(0, 400) : undefined
  const source_hint = typeof o.source_hint === 'string' ? o.source_hint.slice(0, 120) : undefined
  let journey_answers: Record<string, string> | undefined
  if (o.journey_answers && typeof o.journey_answers === 'object' && !Array.isArray(o.journey_answers)) {
    journey_answers = {}
    for (const [k, v] of Object.entries(o.journey_answers as Record<string, unknown>)) {
      if (typeof v === 'string') journey_answers[k.slice(0, 64)] = v.slice(0, 500)
    }
  }
  const flags = Array.isArray(o.flags)
    ? o.flags.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 48)).slice(0, 12)
    : undefined

  return {
    journey_key: jk,
    money_gbp: Number.isFinite(money_gbp) ? Math.max(0, Math.round(money_gbp)) : 0,
    carbon_kg: Number.isFinite(carbon_kg) ? Math.max(0, Math.round(carbon_kg)) : 0,
    baseline_title,
    baseline_insight,
    source_hint,
    journey_answers,
    flags,
  }
}

/**
 * POST { cards: ContentArchitectCardInput[] } → { byJourney: Partial<Record<JourneyId, …>> }
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const cardsRaw = (body as { cards?: unknown }).cards
  if (!Array.isArray(cardsRaw) || cardsRaw.length === 0) {
    return NextResponse.json({ byJourney: {} })
  }

  const cards: ContentArchitectCardInput[] = []
  for (const item of cardsRaw.slice(0, 12)) {
    const c = sanitiseCard(item)
    if (c) cards.push(c)
  }
  if (cards.length === 0) {
    return NextResponse.json({ byJourney: {} })
  }

  const byJourney = await generateCardContextsBatch(cards)
  return NextResponse.json({ byJourney })
}
