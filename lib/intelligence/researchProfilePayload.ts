/**
 * Localized profile prefix for Firecrawl + Gemini — keeps scrape/synthesis tied to household context.
 */

import { isActiveEmployed, isBetweenJobs, isStudent } from '@/lib/profile/employmentSegment'
import { isLowIncomeBracket } from '@/lib/zone/affluenceCheck'

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
  house_number?: string | null
  /** ONS IMD decile 1–10 from property_intelligence.deprivation */
  imd_decile?: number | null
  /** From property_intelligence envelope */
  property_confidence?: string | null
  epc_rating?: string | null
  epc_potential_rating?: string | null
  epc_stale?: boolean
  property_value_band?: string | null
  flood_risk_zone?: string | null
  solar_irradiance_kwh_m2?: number | null
  dno_region?: string | null
  lsoa_code?: string | null
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
  tech: ['https://www.backmarket.co.uk/en-gb', 'https://www.gov.uk/guidance/smart-meters-how-they-work'],
  waste: ['https://www.gov.uk/recycling-collections'],
  water: ['https://www.waterwise.org.uk/'],
  solar: ['https://www.gov.uk/government/publications/solar-energy-uk'],
  carbon: ['https://www.ofgem.gov.uk/'],
}

/**
 * Per-category seed URLs that work with the free scraper (static/SSR HTML, no JS rendering needed).
 * Used as the scrape source when Firecrawl is unavailable — gives Gemini live web content per domain.
 */
export const JOURNEY_FREE_SEEDS: Partial<Record<JourneyId, string[]>> = {
  home: [
    'https://energysavingtrust.org.uk/advice/reducing-home-heat-loss/',
    'https://www.gov.uk/energy-grants-calculator',
    'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/energy-price-cap-and-standing-charges-explained',
  ],
  utilities: [
    'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/energy-price-cap-and-standing-charges-explained',
    'https://energysavingtrust.org.uk/advice/home-energy-efficiency/',
    'https://www.gov.uk/energy-grants-calculator',
  ],
  solar: [
    'https://energysavingtrust.org.uk/advice/solar-panels/',
    'https://www.gov.uk/feed-in-tariffs',
    'https://www.gov.uk/guidance/smart-export-guarantee',
  ],
  travel: [
    'https://www.gov.uk/guidance/rail-fares-and-season-tickets',
    'https://www.gov.uk/buy-vehicle-tax-disc',
    'https://www.gov.uk/plug-in-car-van-grants',
  ],
  holidays: [
    'https://www.visitbritain.com/en/destinations',
    'https://www.gov.uk/foreign-travel-advice',
    'https://www.eurostar.com/uk-en/deals',
  ],
  food: [
    'https://www.lovefoodhatewaste.com/why-save-food/facts-about-food-waste/',
    'https://wrap.org.uk/taking-action/food-drink/actions/food-waste-reduction-roadmap',
    'https://www.gov.uk/government/collections/food-waste-prevention',
  ],
  shopping: [
    'https://wrap.org.uk/taking-action/textiles',
    'https://www.gov.uk/guidance/buy-second-hand-goods-and-clothes',
    'https://www.recyclenow.com/',
  ],
  money: [
    'https://www.gov.uk/apply-warm-home-discount-scheme',
    'https://www.gov.uk/pension-credit',
    'https://energysavingtrust.org.uk/advice/grants-and-loans/',
  ],
  // All three previous seeds confirmed dead 2026-07-11: gov.uk/guidance/energy-saving-tips is a
  // genuine branded "Page not found - GOV.UK" (not a bot-block — checked the actual page title),
  // and a live trigger against production showed zero scraped content / empty citations for tech
  // specifically, confirmed against the app's own real output, not just a local curl test.
  // Replaced with three URLs verified live (HTTP 200, real page titles) 2026-07-11.
  tech: [
    'https://www.gov.uk/guidance/smart-meters-how-they-work',
    'https://www.ofgem.gov.uk/getting-smart-meter',
    'https://www.smartenergygb.org/smart-living/smart-energy-tips/switching-appliances-off-stand-by',
  ],
  water: [
    'https://www.waterwise.org.uk/save-water/',
    'https://www.gov.uk/find-local-council',
    'https://energysavingtrust.org.uk/advice/water/',
  ],
  waste: [
    'https://www.gov.uk/recycling-collections',
    'https://www.recyclenow.com/',
    'https://wrap.org.uk/taking-action/food-drink/actions/food-waste-reduction-roadmap',
  ],
  // Previous seeds confirmed topically wrong 2026-07-12, not dead like tech's were: the free
  // scraper succeeded (real markdown, real citations) but the content was unusable — the gov.uk
  // page is explicitly marked "[Withdrawn]" and is about corporate/business greenhouse-gas
  // reporting (Companies Act 2006, quoted companies' Directors' Reports), not household carbon;
  // the other two seeds duplicate home's/utilities' own content with no carbon-specific angle.
  // Confirmed via a live production trigger + inspecting the actual scraped markdown, not curl.
  // Replaced with three URLs verified live 2026-07-12: a genuinely current (not withdrawn) GOV.UK
  // statistics release, Energy Saving Trust's household carbon-cutting tips (concrete £/kg figures
  // per action), and Carbon Trust's own guides hub (matches the journey's trusted CTA domain).
  carbon: [
    'https://www.gov.uk/government/statistics/uks-carbon-footprint/carbon-footprint-for-the-uk-and-england-to-2023',
    'https://energysavingtrust.org.uk/top-tips-to-reduce-your-carbon-emissions/',
    'https://www.carbontrust.com/our-work-and-impact/guides-reports-and-videos',
  ],
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
  if (p?.house_number) lines.push(`house_number: ${p.house_number}`)
  if (p?.household) lines.push(`household: ${p.household}`)
  if (p?.transport_baseline) lines.push(`transport_baseline: ${p.transport_baseline}`)
  if (p?.heating) lines.push(`heating: ${p.heating}`)
  if (p?.employment_status) lines.push(`employment_status: ${p.employment_status}`)
  if (p?.household_income_bracket) lines.push(`household_income_bracket: ${p.household_income_bracket}`)
  if (p?.primary_goal) lines.push(`primary_goal: ${p.primary_goal}`)
  if (p?.tenure) lines.push(`tenure: ${p.tenure}`)
  if (p?.household_size) lines.push(`household_size: ${p.household_size}`)
  if (p?.goal) lines.push(`goal: ${p.goal}`)
  if (p?.property_confidence) lines.push(`property_confidence: ${p.property_confidence}`)
  if (p?.epc_rating) lines.push(`epc_current_rating: ${p.epc_rating}`)
  if (p?.epc_potential_rating) lines.push(`epc_potential_rating: ${p.epc_potential_rating}`)
  if (p?.epc_stale) lines.push('epc_stale: true')
  if (p?.property_value_band) lines.push(`property_value_band: ${p.property_value_band}`)
  if (p?.flood_risk_zone) lines.push(`flood_risk_zone: ${p.flood_risk_zone}`)
  if (typeof p?.solar_irradiance_kwh_m2 === 'number') {
    lines.push(`solar_irradiance_kwh_m2: ${p.solar_irradiance_kwh_m2}`)
  }
  if (typeof p?.imd_decile === 'number') lines.push(`imd_decile: ${p.imd_decile}`)
  if (p?.dno_region) lines.push(`dno_region: ${p.dno_region}`)
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

/** Employed → SEG, agile tariffs; student / between jobs → grants + budget seeds. */
export function buildEmploymentAwareResearchSeeds(profile?: LocalizedProfileInput | null): string[] {
  const employed = isActiveEmployed(profile?.employment_status)
  const student = isStudent(profile?.employment_status)
  const betweenJobs = isBetweenJobs(profile?.employment_status)
  const lowIncome = isLowIncomeBracket(profile?.household_income_bracket)

  if (student) {
    return [
      'https://www.moneysavingexpert.com/utilities/',
      'https://energysavingtrust.org.uk/advice/grants-and-loans/',
      'https://www.gov.uk/find-energy-grants-help-pay-bills',
      'https://www.gov.uk/apply-warm-home-discount-scheme',
      'https://www.which.co.uk/money/saving-energy',
    ]
  }
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
  if (betweenJobs || !employed || lowIncome) {
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
  /** Answer funnel overrides — property/IMD/solar/flood biased seeds. */
  extraSeedUrls?: string[]
  deprioritizeMeansTestedGrants?: boolean
}): string[] {
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  const journeyKey = normalizeCategoryToJourneyKey(params.category)
  const employed = isActiveEmployed(params.profileData?.employment_status)
  const lowIncome = isLowIncomeBracket(params.profileData?.household_income_bracket)
  const imdDecile = params.profileData?.imd_decile
  const affluentArea = typeof imdDecile === 'number' && imdDecile >= 8
  const deprivedArea = typeof imdDecile === 'number' && imdDecile <= 3
  const skipGrantSeeds =
    params.deprioritizeMeansTestedGrants === true ||
    ((employed && !lowIncome && !deprivedArea) || affluentArea)
  const seen = new Set<string>()
  const out: string[] = []
  const add = (url: string) => {
    const u = url.trim()
    if (!u.startsWith('https://') || seen.has(u)) return
    if (skipGrantSeeds && isGrantHeavyUrl(u)) return
    seen.add(u)
    out.push(u)
  }

  for (const u of params.extraSeedUrls ?? []) add(u)
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
  if (deprivedArea && journeyKey === 'home') {
    add('https://www.gov.uk/apply-boiler-upgrade-scheme')
    add('https://www.gov.uk/apply-warm-homes-local-grant')
    add('https://www.gov.uk/energy-company-obligation')
  } else if (!skipGrantSeeds && journeyKey === 'home') {
    add('https://www.gov.uk/apply-boiler-upgrade-scheme')
  }
  if (affluentArea && (journeyKey === 'solar' || journeyKey === 'utilities')) {
    add('https://octopus.energy/smart/')
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
