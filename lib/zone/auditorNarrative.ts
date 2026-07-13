/**
 * True Tip narrative — three paragraphs (discovery → money/carbon → action) without UI labels.
 */

import type { JourneyId } from '@/lib/journeys'
import { PRICE_CAP_JULY_2026 } from '@/lib/brains/constants'
import { resolveSoloFocusPlaceLabel } from '@/lib/zone/localityCopy'
import { isLondonPostcode } from '@/lib/zone/verifiedRevenue'
import { formatCarbonValue, formatMoneyValue } from '@/lib/format'
import { buildFriendlyDetectionParagraph } from '@/lib/zone/plainEnglishCopy'

function auditTopicPhrase(journey: JourneyId): string {
  const m: Partial<Record<JourneyId, string>> = {
    tech: 'tech',
    home: 'home energy',
    utilities: 'gas and electricity',
    solar: 'solar',
    travel: 'travel',
    food: 'food',
    shopping: 'shopping',
    money: 'household spending',
    carbon: 'carbon',
    waste: 'waste',
    water: 'water',
    holidays: 'holiday travel',
  }
  return m[journey] ?? 'household'
}

/** Shared mechanical fallback — must never surface in Solo Focus (journey-specific proof replaces it). */
export function isGenericAuditorProofParagraph(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return false
  return (
    /point to policy and tariff pressure through april 2026/i.test(t) &&
    /stays expensive until you make one verified move/i.test(t)
  )
}

function proofSentenceBase(journey: JourneyId, sourceName: string, postcode: string | undefined, variant: number): string {
  const london = isLondonPostcode(postcode)
  const cap = PRICE_CAP_JULY_2026.toLocaleString('en-GB')
  const v = ((variant % 3) + 3) % 3
  switch (journey) {
    case 'tech':
      if (v === 1) {
        return `${sourceName} clock phantom load on routers and consoles — a few timers often trim more kWh than another smart plug advert.`
      }
      if (v === 2) {
        return `${sourceName} still see standby draw as the quiet bill leak — one weekend audit of plugs beats guessing from the statement.`
      }
      return `${sourceName} reckon standby creep is up about 8% in this April 2026 climate — dull, but very fixable with a few plug changes.`
    case 'home':
      if (v === 1) {
        return `${sourceName} rank draughts and loft gaps ahead of shiny kit — fabric fixes usually land before a boiler swap pays back.`
      }
      if (v === 2) {
        return `${sourceName} keep background heat loss on the watch list — the July 2026 cap near £${cap} means wasted warmth still hurts.`
      }
      return `${sourceName} still put heating and background draw at the top of the bill pile — the July 2026 cap sits around £${cap}, so fabric and tariff moves still matter.`
    case 'travel':
      if (london) {
        if (v === 1) {
          return `${sourceName} price ULEZ and rail against fuel for London hops — the cheaper hop is not always the car on paper.`
        }
        return `${sourceName} flag clean-air charges and fuel duty as keeping London commute costs stubborn through April 2026 — worth planning swaps before you renew anything.`
      }
      if (v === 1) {
        return `${sourceName} show season tickets and carnets beating ad-hoc fuel top-ups when your commute is fixed.`
      }
      if (v === 2) {
        return `${sourceName} still see short car hops as the expensive default — one rail day a week often moves both £ and kg.`
      }
      return `${sourceName} show fuel and fares still running hot in the April 2026 economy — small commute shifts add up faster than another loyalty card.`
    case 'utilities':
      if (v === 1) {
        return `${sourceName} still peg standing charges to the July 2026 cap — the unit rate you pick sets the real ceiling on every bill.`
      }
      if (v === 2) {
        return `${sourceName} separate gas standing from electric unit moves — dual-fuel bundles are not always the cheapest lock-in.`
      }
      return `${sourceName} tie unit rates and standing charges to the July 2026 cap near £${cap} — the tariff you are on still sets the ceiling on every kWh.`
    case 'solar':
      if (v === 1) {
        return `${sourceName} model export payments against your daytime use — oversized arrays bleed payback if you are out all day.`
      }
      if (v === 2) {
        return `${sourceName} still size arrays from roof pitch and shade — catalogue kW figures rarely match how you use power.`
      }
      return `${sourceName} size payback from export rates and daylight at your roof pitch — generic kit quotes rarely match how you actually use power.`
    case 'food':
      if (v === 1) {
        return `${sourceName} put freezer discipline and meal plans ahead of another delivery pass — waste is still the quiet kitchen leak.`
      }
      if (v === 2) {
        return `${sourceName} track packaging and spoilage together — cupboards already hold most of what shops resell.`
      }
      return `${sourceName} put food waste and packaging near the top of kitchen-table spend — meal planning beats another delivery subscription.`
    case 'shopping':
      if (v === 1) {
        return `${sourceName} favour repair cafés and spare parts — a fix often beats a same-day replacement courier.`
      }
      if (v === 2) {
        return `${sourceName} still rank longevity over flash deals — three cheap buys rarely beat one solid repair.`
      }
      return `${sourceName} show repair-first and longer-life goods beating impulse replacements — one durable buy often beats three cheap ones.`
    case 'money':
      if (v === 1) {
        return `${sourceName} watch dormant balances and rolling contracts — small switches beat another comparison site email.`
      }
      if (v === 2) {
        return `${sourceName} still treat bill drift and idle cash as paired leaks — tidy both before chasing headline rates.`
      }
      return `${sourceName} track idle cash and bill drift as the quiet leaks — small account and tariff moves compound faster than a new card.`
    case 'carbon':
      if (v === 1) {
        return `${sourceName} pair grid intensity with one habit at a time — kg moves faster than buying offsets alone.`
      }
      if (v === 2) {
        return `${sourceName} still rank demand cuts ahead of certificates — trim what you do not need before you offset.`
      }
      return `${sourceName} map grid intensity and home demand together — one habit change often moves kg faster than offsetting alone.`
    case 'waste':
      if (v === 1) {
        return `${sourceName} price extra bin lifts against compost and sort-at-source — council tonnage charges still climb.`
      }
      if (v === 2) {
        return `${sourceName} still split landfill from recycling tariffs — contamination fees undo a good sort week.`
      }
      return `${sourceName} price landfill and recycling separately — sorting and composting at home still beats paying for extra bin lifts.`
    case 'water':
      if (v === 1) {
        return `${sourceName} tie dripping taps to meter step-changes — aerators often land before arguing the standing charge.`
      }
      if (v === 2) {
        return `${sourceName} still pair shower length with sewage rises — hot water moves both £ and litres.`
      }
      return `${sourceName} link metered water and sewage rises — fixing drips and fitting aerators often beats arguing over the standing charge.`
    case 'holidays':
      if (v === 1) {
        return `${sourceName} still favour rail for short hops — domestic flights carry fuel and airport fees you see late.`
      }
      if (v === 2) {
        return `${sourceName} book off-peak trains early — April 2026 leisure fares punish last-minute car hire too.`
      }
      return `${sourceName} show short-haul rail beating domestic flights on cost and carbon — booking early still matters in the April 2026 market.`
    default:
      if (v === 1) {
        return `${sourceName} line this row to what you already told us — one small move this week still shifts the bill.`
      }
      return `${sourceName} tie this to your saved answers and the July 2026 cap near £${cap} — fabric and tariff tweaks still beat guessing from the statement.`
  }
}

function proofSentence(journey: JourneyId, sourceName: string, postcode?: string): string {
  return proofSentenceBase(journey, sourceName, postcode, 0)
}

/** Rotating proof beat — stops the same middle paragraph on every wall card. */
export function proofSentenceVariant(
  journey: JourneyId,
  sourceName: string,
  postcode: string | undefined,
  variant: number
): string {
  return proofSentenceBase(journey, sourceName, postcode, variant)
}

/** @deprecated Solo Focus no longer surfaces CTA-bridge filler — use {@link payoffSentence}. */
export function bridgeSentence(journey: JourneyId): string {
  if (journey === 'tech') {
    return `Cut standby draw via the CTA — swap plugs and timers, then record the kWh drop against your audit.`
  }
  if (journey === 'home') {
    return `Lock fabric or tariff moves via the CTA — align quotes to your postcode audit before you switch.`
  }
  return `Execute the verified step in the CTA and record the £ and CO₂e against your audit trail.`
}

/** Third True Tip beat — hands off to the stamped £ / CO₂e row (not “open the CTA”). */
export function payoffSentence(journey: JourneyId, moneyGbp: number, carbonKg: number): string {
  const m = Math.max(0, Math.round(moneyGbp))
  const c = Math.max(0, Math.round(carbonKg))
  const topic = auditTopicPhrase(journey)
  return `We've put about £${formatMoneyValue(m)} a year and around ${formatCarbonValue(c)} CO₂e against your ${topic} row — from your saved audit, not a guess.`
}

export function buildAuditorDetectionParagraph(params: {
  placeLabel: string
  moneyGbp: number
  journey: JourneyId
  /** Default false — avoid "In {town}" on every Zone card. */
  namePlace?: boolean
}): string {
  return buildFriendlyDetectionParagraph({
    ...params,
    namePlace: params.namePlace ?? false,
  })
}

function cardProofVariant(cardId: string | undefined, proofVariant: number | undefined): number {
  if (proofVariant != null) return proofVariant
  if (!cardId?.trim()) return 0
  let h = 0
  for (let i = 0; i < cardId.length; i++) h = (Math.imul(31, h) + cardId.charCodeAt(i)) | 0
  return Math.abs(h) % 3
}

export function buildAuditorNarrativeParagraphs(params: {
  userPostcode: string
  sourceName: string
  journey: JourneyId
  moneyGbp: number
  carbonKg: number
  locality: string
  cardId?: string
  proofVariant?: number
}): string[] {
  const sourceName = params.sourceName.trim() || 'UK Government'
  const placeLabel = resolveSoloFocusPlaceLabel({
    locality: params.locality,
    postcode: params.userPostcode,
  })
  const detection = buildAuditorDetectionParagraph({
    placeLabel,
    moneyGbp: params.moneyGbp,
    journey: params.journey,
    namePlace: Boolean(params.cardId && cardProofVariant(params.cardId, params.proofVariant) % 2 === 1),
  })
  const proof = proofSentenceVariant(
    params.journey,
    sourceName,
    params.userPostcode,
    cardProofVariant(params.cardId, params.proofVariant)
  )
  const payoff = payoffSentence(params.journey, params.moneyGbp, params.carbonKg)
  return [detection, proof, payoff]
}
