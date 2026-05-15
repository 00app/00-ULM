/**
 * Recursive Rebirth — Solo Focus expanded answers: Firecrawl Action Vault scrape + pro Gemini
 * (12k/1t profile) → high-impact ZoneTipCard + Neon `research_results.is_high_impact`.
 */

import type { JourneyId } from '@/lib/journeys'
import { scrapeWithFirecrawlUrl, persistResearchResult, type ResearchProfileData } from '@/lib/agents/researchAgent'
import { vaultForJourney, urlsForVault, type IntelligenceVaultId } from '@/lib/agents/actionVaults'
import { validateInjectionCard } from '@/lib/zone/injections'
import { enforceTrueWinRails, TRUE_WIN_RAILS } from '@/lib/zone/trueWinRails'
import type { ZoneTipCard } from '@/lib/zone/buildZoneViewModel'
import { buildDiscoveryInjectionId } from '@/lib/zone/discoveryCard'
import type { DiscoveryBirthPayload } from '@/lib/agents/discoveryBirthRace'

function parseJsonObject(text: string): Record<string, unknown> | null {
  const t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    const o = JSON.parse(t) as unknown
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function sanitizeHttpsUrl(u: string, fallback: string): string {
  try {
    const x = new URL(u.trim())
    if (x.protocol !== 'https:') return fallback
    return x.href
  } catch {
    return fallback
  }
}

const REBIRTH_MODEL_PRIMARY =
  process.env.GEMINI_REBIRTH_MODEL?.trim() || 'gemini-2.5-pro-preview-05-06'
const REBIRTH_MODEL_FALLBACK = 'gemini-2.0-flash'

async function scrapeVaultCorpus(vault: IntelligenceVaultId): Promise<{ markdown: string; urls: string[] }> {
  const urls = urlsForVault(vault, 5)
  const chunks: string[] = []
  const settled = await Promise.allSettled(
    urls.map(async (url) => {
      const r = await scrapeWithFirecrawlUrl(url)
      const md = r?.markdown?.trim()
      if (md) return `### ${url}\n${md.slice(0, 3800)}`
      return ''
    })
  )
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value) chunks.push(s.value)
  }
  return { markdown: chunks.join('\n\n'), urls }
}

function formatPostcodeHint(pc: string | null): string {
  if (!pc?.trim()) return ''
  const c = pc.replace(/\s+/g, '').toUpperCase()
  if (c.startsWith('BN17')) {
    return 'locality: Littlehampton / Arun coast (BN17) — prefer Arun-adjacent schemes when cited.'
  }
  if (c.startsWith('BN')) return 'locality: West Sussex / Sussex coast context when sources allow.'
  return `postcode outcode: ${c.slice(0, 4)}`
}

/**
 * Solo Focus only: returns a high-impact discovery card + persists Neon row.
 */
export async function runRebirthVaultDiscovery(params: {
  journeyId: JourneyId
  questionId: string
  answerValue: string
  postcode: string | null
  profileData: ResearchProfileData | null
  userId: string
}): Promise<DiscoveryBirthPayload | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null

  const vault = vaultForJourney(params.journeyId)
  const { markdown: vaultMd, urls: vaultUrls } = await scrapeVaultCorpus(vault)
  if (!vaultMd.trim()) return null

  const stableId = buildDiscoveryInjectionId(
    params.journeyId,
    params.questionId,
    params.answerValue
  )
  const pcHint = formatPostcodeHint(params.postcode)
  const stressHint =
    /struggl|can't pay|skipping|arrears|debt|prepayment|meter/i.test(params.answerValue)
      ? 'User signal: struggling with bills — prioritise standing charge reduction, Warm Homes / ECO where eligible, and grant routes; be concrete on £/yr.'
      : ''

  const baselineBlock = `Zero Zero baseline: tie savings to the 12,000 kWh / 1 tonne CO₂e household reference — express carbon as kg CO₂e avoided for the modelled action, and GBP as integer annual saving where evidence supports it.`

  const prompt = `You are Zai Senior Auditor (UK, March 2026). Using ONLY the scraped markdown corpus below plus user context, output ONE JSON object.

User journey="${params.journeyId}" question="${params.questionId}" answer="${params.answerValue}".
${pcHint}
${stressHint}
Vault=${vault} (${vault === 'A' ? 'home energy / grants' : vault === 'B' ? 'travel / shared mobility' : 'circular / food / finance'})
${baselineBlock}

Scraped Action Vault corpus:
---
${vaultMd.slice(0, 28_000)}
---

Required JSON (no markdown fences):
{
  "recommendation_copy": "max 380 chars, lowercase, direct UK advice grounded in corpus URLs",
  "source_url": "https from corpus or listed seed domains only",
  "saving_gbp_annual": <integer plausible annual £ saving for this household signal>,
  "carbon_kg_annual": <integer plausible annual kg CO2e avoided>,
  "agent_headline": "max 20 words, Marvin-style headline uppercase fragments ok",
  "architect_prose": "exactly three paragraphs separated by blank lines, label-free, what/why/how embedded",
  "new_card_data": {
    "id": "${stableId}",
    "title": "UPPERCASE HEADLINE MAX 6 WORDS",
    "journey_key": "${params.journeyId}",
    "category": "${params.journeyId}",
    "high_impact": true,
    "data": { "money": "string like £480 or £7.5k", "carbon": "string like 420 kg CO₂" },
    "dominant_win": "money or carbon",
    "explanation": ["one line tied to user answer"],
    "actions": { "actionType": "apply", "learnUrl": "https...", "actionUrl": "https..." },
    "cta": { "label": "claim offer", "url": "https..." },
    "badge": "HIGH IMPACT"
  }
}

Rules: offer_url / cta.url / actions must be https and must appear in corpus or be a parent domain clearly tied to scraped content. No invented HMRC amounts. If uncertain, use conservative integers and cite the page that supports the band.`

  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)

  async function runModel(modelName: string) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.25,
        maxOutputTokens: 8192,
      },
    })
    return model.generateContent(prompt)
  }

  let rawText = ''
  try {
    const result = await runModel(REBIRTH_MODEL_PRIMARY)
    rawText = result.response.text()
  } catch (e) {
    console.warn('[rebirthVault] primary model failed, fallback:', e)
    try {
      const result = await runModel(REBIRTH_MODEL_FALLBACK)
      rawText = result.response.text()
    } catch {
      return null
    }
  }

  const parsed = parseJsonObject(rawText)
  if (!parsed) return null

  const recommendation_copy =
    typeof parsed.recommendation_copy === 'string'
      ? parsed.recommendation_copy.trim().slice(0, 400)
      : ''
  const source_url = sanitizeHttpsUrl(
    typeof parsed.source_url === 'string' ? parsed.source_url : 'https://www.gov.uk/',
    'https://www.gov.uk/'
  )
  const savingGbp =
    typeof parsed.saving_gbp_annual === 'number' && Number.isFinite(parsed.saving_gbp_annual)
      ? Math.round(parsed.saving_gbp_annual)
      : null
  const carbonKg =
    typeof parsed.carbon_kg_annual === 'number' && Number.isFinite(parsed.carbon_kg_annual)
      ? Math.round(parsed.carbon_kg_annual)
      : null

  const ncd = parsed.new_card_data as Record<string, unknown> | undefined

  const mergedRaw = {
    ...(ncd && typeof ncd === 'object' ? ncd : {}),
    id: stableId,
    journey_key: params.journeyId,
    category: params.journeyId,
    high_impact: true,
  }

  let card = validateInjectionCard(mergedRaw)
  if (!card) return null

  const badgeFromGemini =
    typeof ncd?.badge === 'string' && ncd.badge.trim() ? ncd.badge.trim().slice(0, 48) : 'HIGH IMPACT'

  card = enforceTrueWinRails({
    ...card,
    high_impact: true,
    badge: badgeFromGemini,
    explanation: card.explanation?.length
      ? [recommendation_copy || card.explanation[0]]
      : [recommendation_copy],
  })

  const citations = vaultUrls.map((url) => ({
    source_name: 'Action Vault',
    url,
    snippet: 'rebirth scrape',
  }))

  const savingForRow =
    savingGbp ??
    (() => {
      const n = Number.parseFloat(String(card.data.money).replace(/[^\d.]/g, ''))
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
    })()

  await persistResearchResult({
    userId: params.userId,
    postcode: params.postcode,
    profileData: params.profileData,
    markdown: vaultMd.slice(0, 50_000),
    citations,
    sourceUrl: source_url,
    category: params.journeyId,
    savingAmountGbp: savingForRow,
    offerUrl: card.cta?.url ?? source_url,
    agentHeadline:
      typeof parsed.agent_headline === 'string' ? parsed.agent_headline.trim().slice(0, 500) : null,
    architectProse:
      typeof parsed.architect_prose === 'string' ? parsed.architect_prose.trim().slice(0, 8000) : null,
    localityContext: pcHint || null,
    invokePayload: {
      vault,
      engine: 'rebirth_vault',
      seed_urls: vaultUrls,
      gemini_model: REBIRTH_MODEL_PRIMARY,
    },
    skipResearchGeminiExtraction: true,
    isHighImpact: true,
    carbonImpactKg: carbonKg,
  })

  return {
    recommendation_copy: recommendation_copy || card.explanation?.[0] || 'action vault rebirth',
    source_url,
    new_card_data: card,
  }
}
