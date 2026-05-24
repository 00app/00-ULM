import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAiRouteAuth } from '@/lib/requestAuth'
import {
  DEFAULT_TRUSTED_URL,
  isHttpsUrl,
  normalizeCategoryToJourneyKey,
  trustedUrlForJourney,
} from '@/lib/zone/trustedJourneyUrls'
import type { JourneyId } from '@/lib/journeys'

export const runtime = 'nodejs'
export const maxDuration = 60

type LastExpanded = {
  journey_key?: string
  question_id?: string
  answer_value?: string
}

function normalizeGenerateNextCard(raw: Record<string, unknown>): Record<string, unknown> {
  const category = typeof raw.category === 'string' ? raw.category : 'HOME'
  const jkey = normalizeCategoryToJourneyKey(category) as JourneyId
  const fallbackLearn = trustedUrlForJourney(jkey)
  let learnUrl =
    typeof raw.learnUrl === 'string' && isHttpsUrl(raw.learnUrl)
      ? raw.learnUrl.trim()
      : typeof raw.sourceUrl === 'string' && isHttpsUrl(raw.sourceUrl)
        ? raw.sourceUrl.trim()
        : ''

  if (!learnUrl) {
    const tip = typeof raw.tip === 'string' ? raw.tip : ''
    const urlInTip = tip.match(/https:\/\/[^\s)\]}>'"]+/i)
    if (urlInTip?.[0] && isHttpsUrl(urlInTip[0])) learnUrl = urlInTip[0].trim()
  }
  if (!learnUrl) learnUrl = fallbackLearn

  const heading =
    (typeof raw.heading === 'string' && raw.heading.trim()) ||
    (typeof raw.title === 'string' && raw.title.trim()) ||
    'YOUR NEXT WIN'
  const description =
    (typeof raw.description === 'string' && raw.description.trim()) ||
    (typeof raw.tip === 'string' && raw.tip.trim()) ||
    ''

  const impactMoney =
    typeof raw.impactMoney === 'number' && Number.isFinite(raw.impactMoney)
      ? raw.impactMoney
      : typeof raw.impactMoney === 'string'
        ? parseFloat(raw.impactMoney) || 0
        : 0
  const impactCarbon =
    typeof raw.impactCarbon === 'number' && Number.isFinite(raw.impactCarbon)
      ? raw.impactCarbon
      : typeof raw.impactCarbon === 'string'
        ? parseFloat(raw.impactCarbon) || 0
        : 0

  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `gen-next-${jkey}-${Date.now()}`

  return {
    id,
    category,
    journey_key: jkey,
    heading,
    description,
    type: raw.type === 'money' || raw.type === 'carbon' || raw.type === 'both' ? raw.type : 'both',
    impactMoney,
    impactCarbon,
    tip: typeof raw.tip === 'string' ? raw.tip : description,
    learnUrl,
    actions: {
      actionType: 'learn' as const,
      learnUrl,
      actionUrl: learnUrl,
    },
    cta: { label: 'Get this Saving', url: learnUrl },
    source: learnUrl,
    sourceLabel: 'Discovery',
  }
}

export async function POST(request: NextRequest) {
  try {
    const authDenied = await requireAiRouteAuth(request)
    if (authDenied) return authDenied

    const body = (await request.json()) as {
      /** Explicit journey category (e.g. from Solo Focus) — anchors Gemini output to that Zone lane. */
      category?: string
      userContext?: {
        onboardingAnswers?: Record<string, unknown>
        expandedViewAnswers?: Record<string, string>
        lastExpandedAnswer?: LastExpanded
      }
    }

    const { userContext, category: bodyCategory } = body
    if (!userContext) {
      return NextResponse.json({ error: 'Missing userContext' }, { status: 400 })
    }
    const explicitCategory =
      typeof bodyCategory === 'string' && bodyCategory.trim()
        ? (normalizeCategoryToJourneyKey(bodyCategory.trim()) as JourneyId)
        : null

    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({
        cards: [
          normalizeGenerateNextCard({
            id: `fallback-${Date.now()}`,
            category: 'HOME',
            heading: 'CHECK GOV GRANTS',
            description: 'See current UK schemes for your situation.',
            type: 'money',
            impactMoney: 200,
            impactCarbon: 100,
            tip: 'Use trusted GOV.UK links only.',
            learnUrl: DEFAULT_TRUSTED_URL,
          }),
        ],
      })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_ARTICLE_MODEL?.trim() || 'gemini-1.5-flash',
      generationConfig: { temperature: 0.2 },
    })

    const profile = userContext.onboardingAnswers || {}
    const goal = String(profile.goal || 'BOTH')
    const household = String(profile.livingSituation || profile.household || 'family')
    const homeType = String(profile.homeType || profile.home_type || 'home')

    const last = userContext.lastExpandedAnswer
    const anchor =
      explicitCategory ??
      (last?.journey_key ? (normalizeCategoryToJourneyKey(String(last.journey_key)) as JourneyId) : null)
    const focusLine =
      last?.journey_key && last?.question_id
        ? `The user JUST answered in expanded view: journey="${last.journey_key}", question="${last.question_id}", answer="${String(last.answer_value ?? '').slice(0, 120)}". All "next win" cards MUST logically follow from that answer (not generic).`
        : 'Use expandedViewAnswers to infer the latest user choices.'
    const categoryAnchorLine = anchor
      ? `PRIMARY category anchor (all 3 cards must fit this lane): "${anchor}".`
      : ''

    const system = `You are a UK savings advisor. Output ONLY valid JSON (no markdown fences). Every card MUST include learnUrl: a real https:// link (prefer gov.uk, energysavingtrust.org.uk, ofgem.gov.uk). Never invent domains — if unsure use https://www.gov.uk/`

    const prompt = `${system}

User goal: ${goal}. Household: ${household}. Home type: ${homeType}.
${focusLine}
${categoryAnchorLine}

Full context (onboarding + all journey answers merged):
${JSON.stringify(userContext, null, 2)}

Return exactly 3 cards. Each card MUST have:
- id: unique string
- category: short uppercase (e.g. FOOD, ENERGY, TRANSPORT)
- heading: punchy headline
- description: 2–4 short lines
- type: "money" | "carbon" | "both"
- impactMoney: number (£/yr estimate)
- impactCarbon: number (kg CO₂e/yr estimate)
- tip: one actionable line
- learnUrl: required string, MUST start with https://

Schema:
{"cards":[{"id":"string","category":"string","heading":"string","description":"string","type":"money|carbon|both","impactMoney":0,"impactCarbon":0,"tip":"string","learnUrl":"https://..."}]}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    let parsed: { cards?: unknown[] }
    try {
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleanJson) as { cards?: unknown[] }
    } catch (e) {
      console.error('[generate-next] parse error', responseText)
      throw e
    }

    const rawCards = Array.isArray(parsed.cards) ? parsed.cards : []
    const cards = rawCards
      .filter((c): c is Record<string, unknown> => c != null && typeof c === 'object' && !Array.isArray(c))
      .map((c) => normalizeGenerateNextCard(c))

    if (cards.length === 0) {
      cards.push(
        normalizeGenerateNextCard({
          id: `fallback-${Date.now()}`,
          category: 'HOME',
          heading: 'UK SAVINGS HUB',
          description: 'Grants and tariffs update often — start from GOV.UK.',
          type: 'both',
          impactMoney: 150,
          impactCarbon: 80,
          tip: 'Bookmark the official scheme page.',
          learnUrl: DEFAULT_TRUSTED_URL,
        })
      )
    }

    return NextResponse.json({ cards })
  } catch (error) {
    console.error('Error generating next cards:', error)
    return NextResponse.json({ error: 'Failed to generate next cards' }, { status: 500 })
  }
}
