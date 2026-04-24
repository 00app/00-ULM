import type { JourneyId } from '@/lib/journeys'
import type { ContentArchitectCardInput } from '@/lib/agents/contentArchitect'
import type { ZoneViewModel } from '@/lib/zone/buildZoneViewModel'

/** Build POST body for `/api/zone/content-architect` from the current Zone view model (nine category rows). */
export function buildContentArchitectCardPayload(args: {
  vm: ZoneViewModel
  journeyAnswers: Record<JourneyId, Record<string, string>>
  localCouncil?: string
}): ContentArchitectCardInput[] {
  const nine = args.vm.journeys.filter((j) => j.id.startsWith('journey-'))
  return nine.map((j) => ({
    journey_key: j.journey_key,
    money_gbp: Math.round(j.moneyGbp ?? 0),
    carbon_kg: Math.round(j.carbonKg ?? 0),
    baseline_title: j.title,
    baseline_insight: j.insightLabel,
    source_hint: j.sourceLabel?.replace(/^source\.\s*/i, '').trim(),
    journey_answers: args.journeyAnswers[j.journey_key] ?? {},
    flags: [
      ...(j.journey_key === 'home' && args.localCouncil ? (['has_council'] as const) : []),
      ...(j.journey_key === 'home' && (j.moneyGbp ?? 0) >= 6500 ? (['bus_eligible_hint'] as const) : []),
    ],
  }))
}
