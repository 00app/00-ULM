/**
 * JIT surgical scrape — Lane Lock: postcode DNA + current_domain isolation.
 */

import type { JourneyId } from '@/lib/journeys'
import { JOURNEY_IDS } from '@/lib/journeys'
import { normalizeCategoryToJourneyKey } from '@/lib/zone/trustedJourneyUrls'
import { isActiveEmployed, isLowIncomeBracket } from '@/lib/zone/affluenceCheck'
import { buildUtilitiesLaneLockBlock } from '@/lib/intelligence/utilitiesLaneRules'

export function resolveSurgicalJourneyKey(raw: string | null | undefined): JourneyId | null {
  const jk = normalizeCategoryToJourneyKey(String(raw ?? '').trim().toLowerCase())
  if (!jk) return null
  return (JOURNEY_IDS as readonly string[]).includes(jk) ? jk : null
}

function outwardFromPostcode(postcode: string | null | undefined): string | null {
  const pc = (postcode ?? '').replace(/\s+/g, '').toUpperCase()
  const m = pc.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/)
  return m?.[1] ?? null
}

/** Postcode is the primary coordinate — every scrape is locality-anchored. */
export function buildPostcodeDnaBlock(params: {
  postcode: string
  localityContext?: string | null
  journeyKey: JourneyId
}): string {
  const pc = params.postcode.replace(/\s+/g, '').toUpperCase()
  const town =
    params.localityContext?.split(',')[0]?.trim() ||
    outwardFromPostcode(pc) ||
    'your area'
  const councilBit = params.localityContext?.includes(',')
    ? params.localityContext.split(',')[1]?.trim()
    : null
  const localPhrase = councilBit
    ? `${town} (${councilBit} council)`
    : `${town} council`
  return [
    `POSTCODE DNA (primary coordinate): ${pc}.`,
    `Locality anchor: ${localPhrase}.`,
    `Frame Firecrawl/Gemini queries as UK-local (e.g. "${localPhrase} ${params.journeyKey} grants", "${localPhrase} EV charging", "${localPhrase} water meter").`,
    'Do not treat postcode as a decorative label — it drives council and tariff context.',
  ].join(' ')
}

/** Lane Lock — current_domain overrides all other genome signals. */
export function buildLaneLockPromptBlock(
  journeyKey: JourneyId,
  opts?: {
    employment_status?: string | null
    household_income_bracket?: string | null
    home_power?: string | null
  }
): string {
  if (journeyKey === 'utilities') {
    return buildUtilitiesLaneLockBlock(opts?.home_power)
  }
  const employed = isActiveEmployed(opts?.employment_status)
  const lowIncome = isLowIncomeBracket(opts?.household_income_bracket)
  const skipLowIncomePath = employed && !lowIncome
  const key = journeyKey.toUpperCase()

  const lines = [
    `CURRENT_DOMAIN: ${journeyKey} — you are physically barred from referencing any other journey domain.`,
    `LANE LOCK: EXCLUSIVELY audit **${key}**. Ignore solar, travel, food, grants, etc. unless this domain is grants and the URL is grant-specific.`,
    'Stop once you have one defensible triplet: numeric £/year saving, agent_headline (max 7 words), and exactly three paragraphs of architect_prose.',
  ]

  if (skipLowIncomePath) {
    lines.push(
      'NO SECOND-GUESSING: employment_status employed (not low-income) — SKIP low-income benefit verification, ECO4/HUG2/Warm Homes eligibility steps. Go straight to high-leverage investment data (SEG, agile tariffs, salary sacrifice, solar ROI).'
    )
  }

  return lines.join(' ')
}

/** @deprecated alias */
export function buildTopicShieldPromptBlock(journeyKey: JourneyId): string {
  return buildLaneLockPromptBlock(journeyKey)
}

/** Firecrawl seed cap per surgical pass (JIT credit control). */
export const SURGICAL_FIRECRAWL_MAX_URLS = 3
