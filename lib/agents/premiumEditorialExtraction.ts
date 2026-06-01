/**
 * Tier B/C premium slice — Gemini editorial only; £ and kg are pre-calculated (no AI arithmetic).
 */

import {
  persistResearchResult,
  extractHybridEditorialTriplet,
  type ResearchProfileData,
} from '@/lib/agents/researchAgent'
import { hasAnyResearchLlmProvider } from '@/lib/intelligence/scrapeBoundaries'

export type PremiumEditorialInput = {
  postcode: string
  category: string
  factualMoneyValue: number
  factualCarbonValue: number
  buildingPhysics?: string
  profileData?: ResearchProfileData | null
  userId?: string | null
  /** Single seed URL for Firecrawl context (optional — skipped when empty). */
  offerUrlHint?: string
}

export type PremiumEditorialResult = {
  agentHeadline: string
  architectProse: string
  offerUrl: string
}

function buildFactualAnchorMarkdown(input: PremiumEditorialInput): string {
  const pc = input.postcode.replace(/\s+/g, '').toUpperCase()
  return [
    '## Deterministic engine anchor (do not recalculate)',
    `Postcode: ${pc}`,
    `Category: ${input.category}`,
    `Annual saving GBP (locked): ${Math.max(0, Math.round(input.factualMoneyValue))}`,
    `Annual carbon kg CO₂e (locked): ${Math.max(0, Math.round(input.factualCarbonValue))}`,
    input.buildingPhysics ? `Building physics: ${input.buildingPhysics}` : '',
    input.offerUrlHint ? `Reference URL: ${input.offerUrlHint}` : '',
    '',
    'Write UK editorial copy only. Numbers above are ground truth.',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Gemini 2.5 Flash — label-free 3-paragraph triplet + 6–8 word headline.
 * Does not invoke Firecrawl; optional markdown is factual anchor only.
 */
export async function runPremiumEditorialExtraction(
  input: PremiumEditorialInput
): Promise<PremiumEditorialResult | null> {
  if (!hasAnyResearchLlmProvider()) return null

  const markdown = buildFactualAnchorMarkdown(input)
  const lockedGbp = Math.max(0, Math.round(input.factualMoneyValue))
  const parsed = await extractHybridEditorialTriplet({
    markdown,
    postcode: input.postcode,
    profileData: input.profileData ?? null,
    category: input.category,
    lockedSavingGbp: lockedGbp,
  })
  if (!parsed?.architect_prose) return null
  return {
    agentHeadline: parsed.agent_headline ?? 'shift your spend this year',
    architectProse: parsed.architect_prose,
    offerUrl: parsed.offer_url?.trim().startsWith('https')
      ? parsed.offer_url.trim()
      : input.offerUrlHint?.trim().startsWith('https')
        ? input.offerUrlHint.trim()
        : 'https://www.gov.uk/',
  }
}

/** Persist premium editorial row with locked £ / kg (skips triplet re-inference). */
export async function persistPremiumEditorialRow(
  input: PremiumEditorialInput,
  editorial: PremiumEditorialResult
): Promise<void> {
  await persistResearchResult({
    userId: input.userId ?? null,
    postcode: input.postcode,
    profileData: input.profileData ?? null,
    markdown: buildFactualAnchorMarkdown(input),
    citations: editorial.offerUrl
      ? [{ url: editorial.offerUrl, source_name: 'hybrid_anchor' }]
      : [],
    category: input.category,
    savingAmountGbp: Math.max(0, Math.round(input.factualMoneyValue)),
    carbonImpactKg: Math.max(0, Math.round(input.factualCarbonValue)),
    offerUrl: editorial.offerUrl,
    agentHeadline: editorial.agentHeadline,
    architectProse: editorial.architectProse,
    skipResearchGeminiExtraction: true,
    invokePayload: { trigger: 'hybrid-pipeline', tier: 'premium_editorial' },
  })
}
