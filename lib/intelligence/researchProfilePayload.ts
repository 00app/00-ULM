/**
 * Localized profile prefix for Firecrawl + Gemini — keeps scrape/synthesis tied to household context.
 */

/** Mirrors `ResearchProfileData` — kept local to avoid circular imports with researchAgent. */
export type LocalizedProfileInput = {
  postcode?: string | null
  home_type?: string | null
  household?: string | null
  transport_baseline?: string | null
  heating?: string | null
  employment_status?: string | null
  tenure?: string | null
  household_size?: string | null
  goal?: string | null
}

const GENERIC_UK_RESEARCH_SEEDS = [
  'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
  'https://www.gov.uk/apply-boiler-upgrade-scheme',
  'https://energysavingtrust.org.uk/',
]
import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_IDS } from '@/lib/journeys'
import { trustedUrlForJourney } from '@/lib/zone/trustedJourneyUrls'
import { normalizeCategoryToJourneyKey } from '@/lib/zone/trustedJourneyUrls'

const JOURNEY_FIRECRAWL_SEEDS: Partial<Record<JourneyId, string[]>> = {
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
    'https://www.nationalrail.co.uk/',
  ],
  food: [
    'https://www.lovefoodhatewaste.com/',
    'https://www.which.co.uk/reviews/food-and-drink',
  ],
  money: [
    'https://www.moneysavingexpert.com/utilities/',
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
  if (p?.household) lines.push(`household: ${p.household}`)
  if (p?.transport_baseline) lines.push(`transport_baseline: ${p.transport_baseline}`)
  if (p?.heating) lines.push(`heating: ${p.heating}`)
  if (p?.employment_status) lines.push(`employment_status: ${p.employment_status}`)
  if (p?.tenure) lines.push(`tenure: ${p.tenure}`)
  if (p?.household_size) lines.push(`household_size: ${p.household_size}`)
  if (p?.goal) lines.push(`goal: ${p.goal}`)
  if (params.category) lines.push(`target_journey: ${params.category}`)
  if (params.loopQuestionId && params.loopAnswer) {
    lines.push(`loop_question_id: ${params.loopQuestionId}`)
    lines.push(`loop_answer: ${params.loopAnswer}`)
  }
  const uc = params.userContext?.trim()
  if (uc) lines.push('', 'Additional context:', uc)
  lines.push(
    '',
    'Synthesis rules: use only £/year figures and https URLs present in scraped markdown below; if absent, state uncertainty — never fabricate grant amounts or retailer deals.'
  )
  return lines.join('\n')
}

export function buildCategoryFirecrawlSeedUrls(params: {
  postcode: string
  category: string
  profileData?: LocalizedProfileInput | null
}): string[] {
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  const journeyKey = normalizeCategoryToJourneyKey(params.category)
  const seen = new Set<string>()
  const out: string[] = []
  const add = (url: string) => {
    const u = url.trim()
    if (!u.startsWith('https://') || seen.has(u)) return
    seen.add(u)
    out.push(u)
  }

  for (const u of JOURNEY_FIRECRAWL_SEEDS[journeyKey] ?? []) add(u)
  add(trustedUrlForJourney(journeyKey))
  for (const u of GENERIC_UK_RESEARCH_SEEDS) add(u)
  if (pc.length >= 4) {
    add(`https://www.gov.uk/find-local-council/${encodeURIComponent(pc)}`)
  }

  const transport = String(params.profileData?.transport_baseline ?? '').toLowerCase()
  if (journeyKey === 'travel' || transport.includes('train') || transport.includes('rail')) {
    add('https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/')
  }
  if (journeyKey === 'home' || journeyKey === 'grants') {
    add('https://www.gov.uk/apply-boiler-upgrade-scheme')
  }

  return out.slice(0, 8)
}

export function isAllowedJourneyCategory(cat: string): cat is JourneyId {
  return (JOURNEY_IDS as readonly string[]).includes(cat)
}
