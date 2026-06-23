import { JOURNEYS, type JourneyId } from '@/lib/journeys'
import { formatZoneCategoryLabel } from '@/lib/soloFocusCopy'

export type DeepDiveProfileSlice = {
  homeType?: string | null
  transport?: string | null
  livingSituation?: string | null
  postcode?: string | null
}

export type DeepDiveAuditInput = {
  journeyKey: string
  categoryLabel: string
  headline: string
  personalSpend: string
  regionalAvg: string
  scrapedSource?: string
  localityName?: string | null
  profile?: DeepDiveProfileSlice | null
  journeyAnswers?: Record<string, Record<string, string>>
}

function formatAnswerToken(raw: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  return t.replace(/_/g, ' ').toUpperCase()
}

function journeyAnswerLines(
  journeyKey: string,
  journeyAnswers?: Record<string, Record<string, string>>
): string[] {
  const row = journeyAnswers?.[journeyKey]
  if (!row) return []
  const journey = JOURNEYS[journeyKey as JourneyId]
  const lines: string[] = []
  for (const q of journey?.questions ?? []) {
    const val = row[q.id]
    if (!val?.trim()) continue
    lines.push(`${q.label}: ${formatAnswerToken(val)}`)
  }
  return lines
}

/** Read-only audit trail lines — no invented £/kg. */
export function buildDeepDiveAuditTrail(input: DeepDiveAuditInput): string[] {
  const lines: string[] = []
  const place = input.localityName?.trim() || 'your postcode area'
  const category = input.categoryLabel || formatZoneCategoryLabel(input.journeyKey)

  lines.push(`Category: ${category}`)
  lines.push(`Shift on card: ${input.headline.trim() || '—'}`)

  const homeType = input.profile?.homeType?.trim()
  const transport = input.profile?.transport?.trim()
  const household = input.profile?.livingSituation?.trim()
  if (homeType || transport || household) {
    const bits = [
      homeType ? `${formatAnswerToken(homeType)} home` : null,
      household ? formatAnswerToken(household) : null,
      transport ? formatAnswerToken(transport) : null,
    ].filter(Boolean)
    lines.push(`Profile genome (${place}): ${bits.join(' · ')}`)
  } else {
    lines.push(`Profile genome: anchored to ${place}`)
  }

  const answers = journeyAnswerLines(input.journeyKey, input.journeyAnswers)
  if (answers.length) {
    lines.push('Your answers for this category:')
    lines.push(...answers.map((a) => `  ${a}`))
  }

  const spend = String(input.personalSpend ?? '').trim() || '0'
  const carbon = String(input.regionalAvg ?? '').trim() || '0'
  lines.push(`Card signals: £${spend.replace(/^£\s*/, '')} · ${carbon} (from stored research / impact row)`)

  const src = String(input.scrapedSource ?? '').trim()
  if (src.startsWith('http')) {
    lines.push(`Source URL: ${src}`)
  } else if (src) {
    lines.push(`Source note: ${src.slice(0, 200)}`)
  }

  return lines
}

/** One-line plain-English context for the Ask sheet (no audit jargon). */
export function buildDeepDivePlainSummary(input: DeepDiveAuditInput): string {
  const place = input.localityName?.trim() || 'your area'
  const spend = String(input.personalSpend ?? '').replace(/[^\d.]/g, '') || '0'
  const carbon = String(input.regionalAvg ?? '').replace(/[^\d.]/g, '') || '0'
  const category = (input.categoryLabel || formatZoneCategoryLabel(input.journeyKey)).toLowerCase()
  return `about £${spend} a year and ${carbon} kg co₂e on this ${category} card — from your profile and live research for ${place}.`
}

export function buildDeepDiveCalculationSummary(input: DeepDiveAuditInput): string {
  const category = input.categoryLabel || formatZoneCategoryLabel(input.journeyKey)
  const place = input.localityName?.trim() || 'your area'
  const answers = journeyAnswerLines(input.journeyKey, input.journeyAnswers)
  const answerHook =
    answers.length > 0
      ? answers[answers.length - 1]!.replace(/^[^:]+:\s*/, '')
      : 'your saved profile + journey answers'

  const spend = String(input.personalSpend ?? '').replace(/[^\d.]/g, '') || '0'
  const carbon = String(input.regionalAvg ?? '').replace(/[^\d.]/g, '') || '0'

  return (
    `This ${category} figure ties ${answerHook} to the latest research row for ${place}. ` +
    `The card shows about £${spend}/yr and ${carbon} kg CO₂e — Zai only interprets these stored numbers; it does not invent new savings.`
  )
}

const DEEP_DIVE_PILLS: Partial<Record<JourneyId, [string, string, string]>> = {
  home: ['show me the math', 'why does this beat the april cap?', 'what do i do this week?'],
  utilities: ['show me the math', 'how was the unit rate calculated?', 'is this tariff still live?'],
  grants: ['show me the math', 'is this grant guaranteed?', 'what proof do i need?'],
  solar: ['show me the math', 'how was payback calculated?', 'does my roof answer change this?'],
  travel: ['show me the math', 'what is the carbon trade-off?', 'cheapest swap this month?'],
  holidays: ['show me the math', 'where does the kg figure come from?', 'one lower-carbon swap?'],
  food: ['show me the math', 'what changed in the basket?', 'one habit for this week?'],
  shopping: ['show me the math', 'is this offer still valid?', 'what should i buy instead?'],
  money: ['show me the math', 'what assumption moved the £?', 'safest next step?'],
  tech: ['show me the math', 'standby vs upgrade — which won?', 'one device to fix first?'],
  water: ['show me the math', 'how was litres/day used?', 'quick win this week?'],
  waste: ['show me the math', 'recycling vs landfill split?', 'one bin habit to change?'],
  carbon: ['show me the math', 'how does this compare to 1t/yr?', 'biggest lever left?'],
}

/** Three category-specific pills — hand off to /zai (read-only chat). */
export function buildDeepDiveQuestionPills(journeyKey: string): string[] {
  const key = journeyKey as JourneyId
  const fixed = DEEP_DIVE_PILLS[key]
  if (fixed) return [...fixed]
  const label = formatZoneCategoryLabel(journeyKey).toLowerCase()
  return [
    'show me the math',
    `how was this ${label} number calculated?`,
    'what is the next concrete step?',
  ]
}
