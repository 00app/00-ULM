/**
 * Localized profile prefix for Firecrawl + Gemini — keeps scrape/synthesis tied to household context.
 */

import { isActiveEmployed, isLowIncomeBracket } from '@/lib/zone/affluenceCheck'

/** Mirrors `ResearchProfileData` — kept local to avoid circular imports with researchAgent. */
export type LocalizedProfileInput = {
  postcode?: string | null
  home_type?: string | null
  /** Profile step only — seeds utilities tile + journey answers (GAS / ELECTRIC / MIX / OTHER). */
  home_power?: string | null
  household?: string | null
  transport_baseline?: string | null
  heating?: string | null
  employment_status?: string | null
  household_income_bracket?: string | null
  tenure?: string | null
  household_size?: string | null
  goal?: string | null
  primary_goal?: string | null
}

const GENERIC_UK_RESEARCH_SEEDS = [
  'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
  'https://www.gov.uk/apply-boiler-upgrade-scheme',
  'https://energysavingtrust.org.uk/',
]

const GRANT_HEAVY_URL_MARKERS = [
  'apply-boiler-upgrade',
  'energy-company-obligation',
  'apply-warm-home',
  'apply-warm-homes',
  'find-energy-grants',
  'grants-and-loans',
  'warm-home-discount',
] as const

function isGrantHeavyUrl(url: string): boolean {
  const u = url.trim().toLowerCase()
  return GRANT_HEAVY_URL_MARKERS.some((m) => u.includes(m))
}
import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_IDS } from '@/lib/journeys'
import { trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'
import { normalizeCategoryToJourneyKey } from '@/lib/zone/trustedJourneyUrls'

const JOURNEY_FIRECRAWL_SEEDS: Partial<Record<JourneyId, string[]>> = {
  utilities: [
    'https://www.moneysavingexpert.com/cheapenergyclub/',
    'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
    'https://energysavingtrust.org.uk/',
  ],
  home: [
    'https://www.gov.uk/apply-boiler-upgrade-scheme',
    'https://energysavingtrust.org.uk/',
    'https://www.which.co.uk/money/saving-energy',
  ],
  grants: [
    'https://www.gov.uk/apply-boiler-upgrade-scheme',
    'https://www.gov.uk/energy-company-obligation',
    'https://energysavingtrust.org.uk/advice/grants-and-loans/',
  ],
  travel: [
    'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/',
    'https://www.thetrainline.com/',
    'https://www.gov.uk/guidance/rail-fares-and-season-tickets',
  ],
  holidays: [
    'https://www.eurostar.com/uk-en',
    'https://www.visitbritain.com/',
    'https://www.thetrainline.com/',
  ],
  food: [
    'https://www.lovefoodhatewaste.com/',
    'https://www.which.co.uk/reviews/food-and-drink',
  ],
  money: [
    'https://www.moneysavingexpert.com/banking/',
    'https://www.gov.uk/apply-warm-home-discount-scheme',
  ],
  shopping: ['https://www.which.co.uk/money/shopping'],
  tech: ['https://www.backmarket.co.uk/en-gb'],
  waste: ['https://www.gov.uk/recycling-collections'],
  water: ['https://www.waterwise.org.uk/'],
  solar: ['https://www.gov.uk/government/publications/solar-energy-uk'],
  carbon: ['https://www.ofgem.gov.uk/'],
}

export function buildLocalizedResearchPrefix(params: {
  postcode: string
  profileData?: LocalizedProfileInput | null
  category?: string | null
  userContext?: string | null
  loopQuestionId?: string | null
  loopAnswer?: string | null
}): string {
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  const lines: string[] = [
    'LOCALIZED HOUSEHOLD CONTEXT (ground truth for scrape + synthesis — do not invent postcode or tenure):',
    `postcode: ${pc}`,
  ]
  const p = params.profileData
  if (p?.home_type) lines.push(`home_type: ${p.home_type}`)
  if (p?.home_power) lines.push(`home_power: ${p.home_power}`)
  if (p?.household) lines.push(`household: ${p.household}`)
  if (p?.transport_baseline) lines.push(`transport_baseline: ${p.transport_baseline}`)
  if (p?.heating) lines.push(`heating: ${p.heating}`)
  if (p?.employment_status) lines.push(`employment_status: ${p.employment_status}`)
  if (p?.household_income_bracket) lines.push(`household_income_bracket: ${p.household_income_bracket}`)
  if (p?.primary_goal) lines.push(`primary_goal: ${p.primary_goal}`)
  if (p?.tenure) lines.push(`tenure: ${p.tenure}`)
  if (p?.household_size) lines.push(`household_size: ${p.household_size}`)
  if (p?.goal) lines.push(`goal: ${p.goal}`)
  if (params.category) {
    lines.push(`current_domain: ${params.category}`)
    lines.push(`target_journey: ${params.category}`)
  }
  if (params.loopQuestionId && params.loopAnswer) {
    lines.push(`loop_question_id: ${params.loopQuestionId}`)
    lines.push(`loop_answer: ${params.loopAnswer}`)
  }
  const uc = params.userContext?.trim()
  if (uc) lines.push('', 'Additional context:', uc)
  lines.push(
    '',
    'Synthesis rules: Warm Auditor voice — three paragraphs (friction → April 2026 lever → payoff once). Open with town/locality from context, never a raw postcode in prose. Use only £/year figures and https URLs present in scraped markdown; if absent, stay conservative — never fabricate grant amounts or retailer deals.'
  )
  return lines.join('\n')
}

/** Employed / affluent → SEG, agile tariffs, salary sacrifice; low income → ECO4, social tariffs, council grants. */
export function buildEmploymentAwareResearchSeeds(profile?: LocalizedProfileInput | null): string[] {
  const employed = isActiveEmployed(profile?.employment_status)
  const lowIncome = isLowIncomeBracket(profile?.household_income_bracket)
  if (employed && !lowIncome) {
    return [
      'https://energysavingtrust.org.uk/energy-at-home/generating-your-own-energy/solar-panels/',
      'https://energysavingtrust.org.uk/energy-at-home/generating-your-own-energy/getting-paid-exporting/',
      'https://octopus.energy/smart/',
      'https://octopus.energy/smart/export/',
      'https://octopus.energy/agile/',
      'https://www.gov.uk/guidance/cycle-to-work-scheme',
      'https://www.moneysavingexpert.com/utilities/',
      'https://www.which.co.uk/money/saving-energy',
    ]
  }
  if (!employed || lowIncome) {
    return [
      'https://www.gov.uk/apply-warm-homes-local-grant',
      'https://www.gov.uk/energy-company-obligation',
      'https://www.gov.uk/apply-warm-home-discount-scheme',
      'https://energysavingtrust.org.uk/advice/grants-and-loans/',
      'https://www.gov.uk/find-energy-grants-help-pay-bills',
    ]
  }
  return []
}

export function buildCategoryFirecrawlSeedUrls(params: {
  postcode: string
  category: string
  profileData?: LocalizedProfileInput | null
  /** JIT surgical pass — fewer URLs, skip cross-domain grant seeds when employed. */
  surgical?: boolean
}): string[] {
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  const journeyKey = normalizeCategoryToJourneyKey(params.category)
  const employed = isActiveEmployed(params.profileData?.employment_status)
  const lowIncome = isLowIncomeBracket(params.profileData?.household_income_bracket)
  const skipGrantSeeds = employed && !lowIncome && journeyKey !== 'grants'
  const seen = new Set<string>()
  const out: string[] = []
  const add = (url: string) => {
    const u = url.trim()
    if (!u.startsWith('https://') || seen.has(u)) return
    if (skipGrantSeeds && isGrantHeavyUrl(u)) return
    seen.add(u)
    out.push(u)
  }

  for (const u of JOURNEY_FIRECRAWL_SEEDS[journeyKey] ?? []) add(u)
  for (const u of buildEmploymentAwareResearchSeeds(params.profileData ?? null)) {
    if (!skipGrantSeeds || !isGrantHeavyUrl(u)) add(u)
  }
  add(trustedUrlForJourney(journeyKey))
  if (!params.surgical) {
    for (const u of GENERIC_UK_RESEARCH_SEEDS) add(u)
  } else if (journeyKey === 'money' || journeyKey === 'carbon' || journeyKey === 'home') {
    add('https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap')
  }
  if (pc.length >= 4 && !params.surgical) {
    add(`https://www.gov.uk/find-local-council/${encodeURIComponent(pc)}`)
  }

  const transport = String(params.profileData?.transport_baseline ?? '').toLowerCase()
  if (journeyKey === 'travel' || transport.includes('train') || transport.includes('rail')) {
    add('https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/')
  }
  if (!skipGrantSeeds && (journeyKey === 'home' || journeyKey === 'grants')) {
    add('https://www.gov.uk/apply-boiler-upgrade-scheme')
  }

  if (journeyKey === 'utilities') {
    const hp = String(params.profileData?.home_power ?? '')
      .trim()
      .toUpperCase()
    if (hp === 'GAS' || hp === 'MIX') {
      add('https://www.gov.uk/apply-boiler-upgrade-scheme')
    }
    if (hp === 'ELECTRIC' || hp === 'MIX') {
      add('https://octopus.energy/smart/')
      add('https://energysavingtrust.org.uk/energy-at-home/heating-your-home/electric-heating/')
    }
  }

  const cap = params.surgical ? 4 : 8
  return out.slice(0, cap)
}

export function isAllowedJourneyCategory(cat: string): cat is JourneyId {
  return (JOURNEY_IDS as readonly string[]).includes(cat)
}
