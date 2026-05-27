import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_ORDER } from '@/lib/journeys'
import type { ContentArchitectCardInput } from '@/lib/agents/contentArchitect'
import type { ZoneViewModel } from '@/lib/logic/zone'
import { compactAuditValue } from '@/lib/format'
import { BASELINE_2026_CAP_GBP } from '@/lib/brains/calculations'
import { ensureAbsoluteHttpsUrl } from '@/lib/zone/contentProseSanitize'
import { sanitizeZoneOfferUrl } from '@/lib/zone/offerUrlGuard'

/** Build POST body for `/api/zone/content-architect` — all 13 operational journeys. */
export function buildContentArchitectCardPayload(args: {
  vm: ZoneViewModel
  journeyAnswers: Record<JourneyId, Record<string, string>>
  localCouncil?: string
  localGridGPerKwh?: number
  /** Neon or resolver fallback — grounds home journey copy in live £/kWh. */
  liveUnitRates?: { elecGbpPerKwh: number; gasGbpPerKwh: number }
  ratesCitationUrl?: string
  marketResearch?: {
    deepLinkUrl?: string
    verifiedSavingValue?: number
    offerExpiryDate?: string
  }
  profile?: {
    home_type?: string
    age?: string
    household_size?: number
    postcode?: string
  }
}): ContentArchitectCardInput[] {
  const byKey = new Map<JourneyId, (typeof args.vm.journeys)[number]>()
  for (const j of args.vm.journeys) {
    if (j.id.startsWith('journey-') && j.journey_key) {
      byKey.set(j.journey_key, j)
    }
  }
  const live = args.liveUnitRates
  return JOURNEY_ORDER.map((journey_key) => {
    const j = byKey.get(journey_key)
    if (!j) {
      return {
        journey_key,
        money_gbp: 0,
        carbon_kg: 0,
        baseline_title: journey_key.toUpperCase(),
        locality: args.localCouncil ?? args.profile?.postcode,
        price_cap_gbp: BASELINE_2026_CAP_GBP,
        journey_answers: args.journeyAnswers[journey_key] ?? {},
      } satisfies ContentArchitectCardInput
    }
    const rawSource =
      j.claimOfferUrl || j.actions?.learnUrl || j.source || undefined
    const httpsSource = rawSource
      ? sanitizeZoneOfferUrl(
          ensureAbsoluteHttpsUrl(rawSource) ?? rawSource,
          journey_key
        )
      : undefined
    const moneyCompact = compactAuditValue(Math.round(j.moneyGbp ?? 0), 'money')
    const carbonCompact = compactAuditValue(Math.round(j.carbonKg ?? 0), 'carbon')
    return {
    journey_key: j.journey_key,
    money_gbp: Math.round(j.moneyGbp ?? 0),
    carbon_kg: Math.round(j.carbonKg ?? 0),
    money_compact: `£${moneyCompact.figure}${moneyCompact.suffix ?? ''}`,
    carbon_compact: `${carbonCompact.figure}${carbonCompact.suffix ?? ''}`,
    baseline_title: j.title,
    baseline_insight: j.insightLabel,
    source_hint: j.sourceLabel?.replace(/^source\.\s*/i, '').trim(),
    source_url: httpsSource,
    deep_link_url: args.marketResearch?.deepLinkUrl,
    verified_saving_value: args.marketResearch?.verifiedSavingValue,
    offer_expiry_date: args.marketResearch?.offerExpiryDate,
    home_type: args.profile?.home_type,
    age: args.profile?.age,
    household_size: args.profile?.household_size,
    postcode: args.profile?.postcode,
    tenure: args.journeyAnswers.home?.tenure ?? args.journeyAnswers.home?.housing_tenure,
    locality: args.localCouncil ?? args.profile?.postcode,
    local_grid_g_per_kwh: args.localGridGPerKwh,
    price_cap_gbp: BASELINE_2026_CAP_GBP,
    live_elec_gbp_per_kwh: j.journey_key === 'home' && live ? live.elecGbpPerKwh : undefined,
    live_gas_gbp_per_kwh: j.journey_key === 'home' && live ? live.gasGbpPerKwh : undefined,
    rates_citation_url:
      j.journey_key === 'home' && args.ratesCitationUrl?.trim() ? args.ratesCitationUrl.trim() : undefined,
    journey_answers: args.journeyAnswers[j.journey_key] ?? {},
    flags: [
      ...(journey_key === 'grants' && args.localCouncil ? (['has_council'] as const) : []),
      ...(journey_key === 'grants' && (j.moneyGbp ?? 0) >= 6500 ? (['bus_eligible_hint'] as const) : []),
    ],
    }
  })
}
