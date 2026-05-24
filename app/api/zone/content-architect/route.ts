import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { requireAiRouteAuth } from '@/lib/requestAuth'
import { getJourneyAnswersForUser } from '@/lib/db/neon'
import { generateCardContextsBatch, type ContentArchitectCardInput } from '@/lib/agents/contentArchitect'
import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import { trustedUrlForJourney, isHttpsUrl } from '@/lib/zone/trustedJourneyUrls'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'
import { getLatestResearchUnitRates } from '@/lib/db/neon'
import pool from '@/lib/db'
import {
  normaliseVisitedJourneyKeys,
  resolveGuestSessionId,
} from '@/lib/zone/guestSession'

export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED = new Set<JourneyId>(JOURNEY_ORDER)

function resolveAppBaseUrl(req: Request): string | null {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  if (configured) return configured.replace(/\/+$/, '')
  try {
    const u = new URL(req.url)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

async function triggerImmediateScrapeFallback(req: Request, postcode: string): Promise<void> {
  const base = resolveAppBaseUrl(req)
  if (!base) return
  const url = `${base}/api/scrape-sync?postcode=${encodeURIComponent(postcode)}`
  try {
    await fetch(url, { method: 'GET', cache: 'no-store' })
  } catch {
    // keep request non-blocking
  }
}

function sanitiseCard(raw: unknown): ContentArchitectCardInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const journey_key = o.journey_key
  if (typeof journey_key !== 'string' || !ALLOWED.has(journey_key as JourneyId)) return null
  const jk = journey_key as JourneyId
  const money_gbp = Number(o.money_gbp)
  const carbon_kg = Number(o.carbon_kg)
  const money_compact = typeof o.money_compact === 'string' ? o.money_compact.slice(0, 16) : undefined
  const carbon_compact = typeof o.carbon_compact === 'string' ? o.carbon_compact.slice(0, 16) : undefined
  const local_grid_g_per_kwh = Number(o.local_grid_g_per_kwh)
  const price_cap_gbp = Number(o.price_cap_gbp)
  const baseline_title = typeof o.baseline_title === 'string' ? o.baseline_title.slice(0, 200) : ''
  const baseline_insight =
    typeof o.baseline_insight === 'string' ? o.baseline_insight.slice(0, 400) : undefined
  const source_hint = typeof o.source_hint === 'string' ? o.source_hint.slice(0, 120) : undefined
  const source_url = typeof o.source_url === 'string' ? o.source_url.slice(0, 300) : undefined
  const deep_link_url = typeof o.deep_link_url === 'string' ? o.deep_link_url.slice(0, 300) : undefined
  const offer_expiry_date =
    typeof o.offer_expiry_date === 'string' ? o.offer_expiry_date.slice(0, 32) : undefined
  const verified_saving_value = Number(o.verified_saving_value)
  const postcode = typeof o.postcode === 'string' ? o.postcode.slice(0, 16) : undefined
  const home_type = typeof o.home_type === 'string' ? o.home_type.slice(0, 32) : undefined
  const tenure = typeof o.tenure === 'string' ? o.tenure.slice(0, 32) : undefined
  const age = typeof o.age === 'string' ? o.age.slice(0, 32) : undefined
  const household_size = Number(o.household_size)
  const locality = typeof o.locality === 'string' ? o.locality.slice(0, 64) : undefined
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
  const live_elec_gbp_per_kwh = Number(o.live_elec_gbp_per_kwh)
  const live_gas_gbp_per_kwh = Number(o.live_gas_gbp_per_kwh)
  const rates_citation_url =
    typeof o.rates_citation_url === 'string' ? o.rates_citation_url.slice(0, 300) : undefined

  return {
    journey_key: jk,
    money_gbp: Number.isFinite(money_gbp) ? Math.max(0, Math.round(money_gbp)) : 0,
    carbon_kg: Number.isFinite(carbon_kg) ? Math.max(0, Math.round(carbon_kg)) : 0,
    money_compact,
    carbon_compact,
    baseline_title,
    baseline_insight,
    source_hint,
    source_url,
    deep_link_url,
    offer_expiry_date,
    verified_saving_value: Number.isFinite(verified_saving_value) ? Math.max(0, Math.round(verified_saving_value)) : undefined,
    postcode,
    home_type,
    tenure,
    age,
    household_size: Number.isFinite(household_size) ? Math.max(1, Math.round(household_size)) : undefined,
    locality,
    local_grid_g_per_kwh: Number.isFinite(local_grid_g_per_kwh) ? local_grid_g_per_kwh : undefined,
    price_cap_gbp: Number.isFinite(price_cap_gbp) ? price_cap_gbp : undefined,
    journey_answers,
    flags,
    live_elec_gbp_per_kwh:
      Number.isFinite(live_elec_gbp_per_kwh) && live_elec_gbp_per_kwh > 0
        ? live_elec_gbp_per_kwh
        : undefined,
    live_gas_gbp_per_kwh:
      Number.isFinite(live_gas_gbp_per_kwh) && live_gas_gbp_per_kwh > 0
        ? live_gas_gbp_per_kwh
        : undefined,
    rates_citation_url,
  }
}

/**
 * POST { cards: ContentArchitectCardInput[] } → { byJourney: Partial<Record<JourneyId, …>> }
 */
export async function POST(req: NextRequest) {
  const authDenied = await requireAiRouteAuth(req)
  if (authDenied) return authDenied

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

  const guestSid = resolveGuestSessionId(req)
  const visitedSkip = new Set<string>()
  try {
    const g = await pool.query<{ visited_journey_keys: unknown }>(
      `SELECT visited_journey_keys FROM guest_sessions WHERE session_id = $1`,
      [guestSid]
    )
    for (const j of normaliseVisitedJourneyKeys(g.rows[0]?.visited_journey_keys)) {
      visitedSkip.add(j)
    }
  } catch {
    /* migration */
  }

  const session = await getSessionFromRequest().catch(() => null)
  const serverAnswers = session ? await getJourneyAnswersForUser(session.userId) : null
  if (serverAnswers) {
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]
      const mergedJourney = serverAnswers[c.journey_key] ?? {}
      const fromClient = c.journey_answers ?? {}
      cards[i] = {
        ...c,
        journey_answers: { ...mergedJourney, ...fromClient },
      }
    }
  }

  const cardsToEnrich = cards.filter((c) => !visitedSkip.has(c.journey_key))
  if (cardsToEnrich.length === 0) {
    return NextResponse.json({ byJourney: {}, resolvedLinks: {}, skippedVisited: [...visitedSkip] })
  }

  const cardsWithLiveSource = await Promise.all(
    cardsToEnrich.map(async (c) => {
      if (c.journey_key === 'home' && !visitedSkip.has('home')) {
        const pc = c.postcode?.replace(/\s+/g, '').trim()
        if (pc && (!c.live_elec_gbp_per_kwh || !c.live_gas_gbp_per_kwh)) {
          const row = await getLatestResearchUnitRates(pc, session?.userId)
          if (row?.elec_unit_rate_gbp_per_kwh && row?.gas_unit_rate_gbp_per_kwh) {
            c = {
              ...c,
              live_elec_gbp_per_kwh: row.elec_unit_rate_gbp_per_kwh,
              live_gas_gbp_per_kwh: row.gas_unit_rate_gbp_per_kwh,
              rates_citation_url: c.rates_citation_url ?? row.source_url ?? undefined,
            }
          } else if (!visitedSkip.has('home')) {
            await triggerImmediateScrapeFallback(req, pc)
          }
        }
      }
      const preferredDeepLink = c.deep_link_url?.trim()
      if (preferredDeepLink && isHttpsUrl(preferredDeepLink)) {
        return { ...c, source_url: sanitizeZoneOfferUrl(preferredDeepLink, c.journey_key) }
      }
      if (c.source_url?.trim() && isHttpsUrl(c.source_url)) {
        return { ...c, source_url: sanitizeZoneOfferUrl(c.source_url, c.journey_key) }
      }
      return { ...c, source_url: trustedUrlForJourney(c.journey_key) }
    })
  )

  const resolvedLinks: Partial<Record<JourneyId, string>> = {}
  for (const c of cardsWithLiveSource) {
    const u = c.source_url?.trim()
    if (u && isHttpsUrl(u)) resolvedLinks[c.journey_key] = sanitizeZoneOfferUrl(u, c.journey_key)
  }

  const byJourney = await generateCardContextsBatch(cardsWithLiveSource)
  return NextResponse.json({ byJourney, resolvedLinks })
}
