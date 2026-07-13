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
  return `About £${spend} a year and ${carbon} kg CO₂e on this ${category} card — from your profile and live research for ${place}.`
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
  home: ['Show me the math', 'Why does this beat the April cap?', 'What do I do this week?'],
  utilities: ['Show me the math', 'How was the unit rate calculated?', 'Is this tariff still live?'],
  solar: ['Show me the math', 'How was payback calculated?', 'Does my roof answer change this?'],
  travel: ['Show me the math', 'What is the carbon trade-off?', 'Cheapest swap this month?'],
  holidays: ['Show me the math', 'Where does the kg figure come from?', 'One lower-carbon swap?'],
  food: ['Show me the math', 'What changed in the basket?', 'One habit for this week?'],
  shopping: ['Show me the math', 'Is this offer still valid?', 'What should I buy instead?'],
  money: ['Show me the math', 'What assumption moved the £?', 'Safest next step?'],
  tech: ['Show me the math', 'Standby vs upgrade — which won?', 'One device to fix first?'],
  water: ['Show me the math', 'How was litres/day used?', 'Quick win this week?'],
  waste: ['Show me the math', 'Recycling vs landfill split?', 'One bin habit to change?'],
  carbon: ['Show me the math', 'How does this compare to 1t/yr?', 'Biggest lever left?'],
}

/** Three category-specific pills — hand off to /zai (read-only chat). */
export function buildDeepDiveQuestionPills(journeyKey: string): string[] {
  const key = journeyKey as JourneyId
  const fixed = DEEP_DIVE_PILLS[key]
  if (fixed) return [...fixed]
  const label = formatZoneCategoryLabel(journeyKey).toLowerCase()
  return [
    'Show me the math',
    `How was this ${label} number calculated?`,
    'What is the next concrete step?',
  ]
}
