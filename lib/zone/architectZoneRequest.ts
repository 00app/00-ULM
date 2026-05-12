import type { JourneyId } from '@/lib/journeys'
import type { ContentArchitectCardInput } from '@/lib/agents/contentArchitect'
import type { ZoneViewModel } from '@/lib/logic/zone'
import { compactAuditValue } from '@/lib/format'
import { BASELINE_2026_CAP_GBP } from '@/lib/brains/calculations'

/** Build POST body for `/api/zone/content-architect` from the current Zone view model (nine category rows). */
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
  const nine = args.vm.journeys.filter((j) => j.id.startsWith('journey-'))
  const live = args.liveUnitRates
  return nine.map((j) => {
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
    source_url: j.claimOfferUrl || j.actions?.learnUrl || j.source,
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
      ...(j.journey_key === 'home' && args.localCouncil ? (['has_council'] as const) : []),
      ...(j.journey_key === 'home' && (j.moneyGbp ?? 0) >= 6500 ? (['bus_eligible_hint'] as const) : []),
    ],
    }
  })
}
