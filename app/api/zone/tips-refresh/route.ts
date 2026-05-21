/**
 * Zone tips refresh — user context + optional supplemental gateway research, then Gemini (3 cards).
 */

import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { getUserContextMarkdown } from '@/lib/memory/store'
import { triggerSupplementalResearch } from '@/lib/agents/researchAgent'
import { shouldSkipFirecrawlScrape } from '@/lib/intelligence/scrapeBoundaries'
import { isGeminiQuotaExceeded, setGeminiQuotaExceeded } from '@/lib/geminiQuota'
import { validateInjectionCards } from '@/lib/zone/injections'
import { setStoredInjections } from '@/lib/zone/injectionStore'
import { validateAndRailCards, TRUE_WIN_RAILS } from '@/lib/zone/trueWinRails'
import { fallbackZoneTips } from '@/lib/zone/fallbackZoneTips'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const ZONE_TIPS_SYSTEM = `You are Zai, the Zero Zero Carbon Expert, building a live UK 2026 savings stream for the Zone dashboard.

Return exactly 3 Zone cards as a JSON array. Each card MUST include:
- id (string, e.g. inject-deal-1)
- title (short headline, sentence case) — Marvin-style data headline
- journey_key AND category (one of: home, travel, food, shopping, money, carbon, tech, waste, holidays) — use THREE DIFFERENT journey_keys when possible so the grid covers more categories over time
- data: { "money": "£X or £X/yr", "carbon": "Y kg CO₂" } — money figures MUST be consistent with the April 2026 typical household price-cap narrative (typical dual-fuel cap around £${TRUE_WIN_RAILS.energyCapGbp}/yr; use rails below if unsure)
- source: a real https URL you are inferring from the research text (never invent domains; use publisher home or article paths only if plausible)
- sourceLabel: the REAL publisher name exactly as readers know it, e.g. "Which?", "MoneySavingExpert", "Energy Saving Trust", "Octopus Energy", "Consumer Reports", "gov.uk", "Ofgem" — this becomes "Supplied by [sourceLabel]" in the app
- dominant_win ("money" or "carbon")
- explanation: one short line, Zai voice, left-aligned insight tone
- actions: { "actionType": "learn", "learnUrl": "<same or best https URL>" }

CONTENT MIX (mandatory): draw roughly 40% from grants, schemes, and official programmes (BUS, ECO, council, Ofgem cap), and 60% from general savings and lifestyle hacks (tariff tips, appliance use, travel behaviour, food waste, tech power draw, etc.). Prioritise evidence-shaped tips aligned with: Which?, MoneySavingExpert, Energy Saving Trust, Octopus Energy, and Consumer Reports (use UK relevance; cite Consumer Reports mainly for methodology or global appliance efficiency parallels when UK-specific pages are thin).

Rails when live numbers are ambiguous: energy cap £${TRUE_WIN_RAILS.energyCapGbp}, average tariff ${TRUE_WIN_RAILS.avgTariffPencePerKwh}p/kWh, boiler grant £${TRUE_WIN_RAILS.boilerGrantGbp}. No markdown, no code fence — raw JSON array only.`

const GeminiCardSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  headline: z.string().optional(),
  journey_key: z.string().optional(),
  category: z.string().optional(),
  data: z
    .object({
      money: z.string().optional(),
      cash: z.string().optional(),
      carbon: z.string().optional(),
    })
    .optional(),
  source: z.string().optional(),
  sourceLabel: z.string().optional(),
  explanation: z.array(z.string()).optional(),
  actions: z
    .object({
      actionType: z.string().optional(),
      learnUrl: z.string().optional(),
      actionUrl: z.string().optional(),
    })
    .optional(),
  cta: z.object({ label: z.string(), url: z.string() }).optional(),
  followUp: z
    .object({
      question: z.string(),
      options: z.array(z.string()),
      targetField: z.string(),
    })
    .optional(),
  type: z.string().optional(),
  location: z.string().optional(),
  dominant_win: z.enum(['money', 'carbon']).optional(),
})
const GeminiCardsSchema = z.array(GeminiCardSchema)

function parseGeminiCards(text: string): unknown[] {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []
  try {
    const parsed = JSON.parse(jsonMatch[0])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function extractPostcodeFromContext(markdown: string): string | null {
  const match = markdown.match(/(?:Location|postcode|Postcode):\s*([A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2})/i)
  return match ? match[1].replace(/\s+/g, ' ').trim() || null : null
}

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const userContext = getUserContextMarkdown()
  const postcodeNorm = postcodeFromContext(userContext)
  const freeTier =
    process.env.GEMINI_FREE_TIER === '1' || process.env.BUCKET_SKIP_GEMINI === '1'

  if (freeTier) {
    const fallback = validateAndRailCards(validateInjectionCards(fallbackZoneTips(postcodeNorm)), postcodeNorm)
    setStoredInjections(fallback)
    return NextResponse.json({
      ok: true,
      source: 'fallback',
      count: fallback.length,
      degraded: true,
      geminiError: 'free_tier',
    })
  }

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'Missing GEMINI_API_KEY for live zone tips' },
      { status: 503 }
    )
  }
  if (isGeminiQuotaExceeded()) {
    const fallback = validateAndRailCards(validateInjectionCards(fallbackZoneTips(postcodeNorm)), postcodeNorm)
    setStoredInjections(fallback)
    return NextResponse.json(
      {
        ok: true,
        source: 'fallback',
        count: fallback.length,
        degraded: true,
        geminiError: 'quota_exceeded',
      },
      { status: 200 }
    )
  }

  let supplementalMarkdown = ''
  const postcode = postcodeNorm
  if (!shouldSkipFirecrawlScrape()) {
    try {
      const research = await triggerSupplementalResearch({
        postcode: postcode ?? undefined,
        persistToNeon: false,
      })
      if (research?.markdown) {
        supplementalMarkdown = research.markdown.slice(0, 5000)
      }
    } catch {
      /* continue without gateway markdown */
    }
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_ZONE_MODEL?.trim() || 'gemini-1.5-flash',
    systemInstruction: ZONE_TIPS_SYSTEM,
  })

  const promptParts: string[] = []
  if (userContext) {
    promptParts.push('User profile (use for location, home type, heating, goals):\n' + userContext)

    const goalMatch = userContext.match(/- Goal:\s*(money|carbon|balanced)/i)
    if (goalMatch) {
      const goal = goalMatch[1].toLowerCase()
      if (goal === 'money') {
        promptParts.push(
          '\nGoal Bias: User goal is SAVE (Money). Ensure 70% of the returned cards are yellow (home, food, money, tech, holidays) and focus on maximum financial return.'
        )
      } else if (goal === 'carbon') {
        promptParts.push(
          '\nGoal Bias: User goal is REDUCE (Carbon). Ensure 70% of the returned cards are pink (travel, shopping, carbon, waste) and focus on maximum carbon reduction.'
        )
      } else {
        promptParts.push('\nGoal Bias: User goal is BOTH (Balanced). Return a balanced mix of cards.')
      }
    }
  }
  if (supplementalMarkdown) {
    promptParts.push('\nUK 2026 research (use to pick real grants/deals):\n' + supplementalMarkdown)
  }
  promptParts.push(
    '\nReturn exactly 3 cards. Obey the 40% grants/schemes vs 60% general savings/lifestyle mix. Prefer three different journey_keys. Every card must have a truthful sourceLabel matching the publisher and a valid https source/learnUrl. JSON array of 3 cards only.'
  )
  const prompt =
    promptParts.join('\n').trim() ||
    'Return 3 UK 2026 Zone cards (40% grants, 60% general savings), three different journey_keys where possible, each with sourceLabel and https URL. JSON array only.'

  try {
    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()
    const rawCards = parseGeminiCards(text ?? '')
    const parsed = GeminiCardsSchema.safeParse(rawCards)
    const cards = validateAndRailCards(validateInjectionCards(parsed.success ? parsed.data : []), postcodeNorm)

    if (cards.length > 0) {
      setStoredInjections(cards)
      return NextResponse.json({ ok: true, source: 'gemini', count: cards.length })
    }
    const fallback = validateAndRailCards(validateInjectionCards(fallbackZoneTips(postcodeNorm)), postcodeNorm)
    setStoredInjections(fallback)
    return NextResponse.json({ ok: true, source: 'fallback', count: fallback.length, degraded: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = (err as { status?: number })?.status
    const isQuota = status === 429 || status === 529 || /429|529|quota|resource exhausted/i.test(msg)
    if (isQuota) setGeminiQuotaExceeded()
    const fallback = validateAndRailCards(validateInjectionCards(fallbackZoneTips(postcodeNorm)), postcodeNorm)
    setStoredInjections(fallback)
    return NextResponse.json({
      ok: true,
      source: 'fallback',
      count: fallback.length,
      degraded: true,
      geminiError: isQuota ? 'quota_exceeded' : undefined,
    }, { status: 200 })
  }
}

function postcodeFromContext(userContext: string): string | null {
  if (!userContext) return null
  return extractPostcodeFromContext(userContext)?.replace(/\s+/g, '').toUpperCase() ?? null
}
