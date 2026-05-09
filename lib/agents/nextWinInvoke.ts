/**
 * POST gateway `/tools/invoke` — "Research the Next Win" after a journey answer.
 */

import { zeroResearchInvokeExtras } from '@/lib/agents/config'
import type { JourneyId } from '@/lib/journeys'
import type { ZoneTipCard } from '@/lib/logic/zone'
import { regionalHeatPumpGrantGbp } from '@/lib/zone/regionalGrants'
import { enforceTrueWinRails, passesBoundaryGuard } from '@/lib/zone/trueWinRails'
import { ensureInjectionCardUrls } from '@/lib/zone/injections'
import { insertResearchInvokeSnapshot } from '@/lib/db/neon'

const GATEWAY_HTTP = (process.env.OPENCLAW_GATEWAY_URL ?? 'http://127.0.0.1:18789').replace(/\/$/, '')

const NEXT_WIN_TIMEOUT_MS = 12_000

interface ResearchCitation {
  source_name?: string
  url?: string
  title?: string
}

function firstUrlFromMarkdown(md: string): string | null {
  const m = md.match(/https:\/\/(?:www\.)?(?:gov\.uk|ofgem\.gov\.uk)[^\s)\]'"<>]+/i)
  return m ? m[0].replace(/[.,;]+$/, '') : null
}

function titleFromMarkdown(md: string): string {
  const h = md.match(/^#\s+(.+)$/m) || md.match(/^##\s+(.+)$/m)
  if (h?.[1]) return h[1].trim().slice(0, 72)
  const line = md.split('\n').find((l) => l.trim().length > 12)
  return (line ?? 'your next win').trim().slice(0, 72)
}

function inferMoneyLine(journeyId: string, answerValue: string, postcode: string | null): string {
  const grant = regionalHeatPumpGrantGbp(postcode)
  if (journeyId === 'home' && answerValue.toUpperCase() === 'GAS') {
    return `£${grant.toLocaleString()}`
  }
  return `£${grant.toLocaleString()}`
}

/**
 * Invoke ZeroResearch with NextWin context; returns validated ZoneTipCard(s) or [].
 */
export async function researchNextWinAfterAnswer(params: {
  journeyId: string
  questionId: string
  answerValue: string
  postcode: string | null
  profileData: Record<string, unknown> | null
}): Promise<ZoneTipCard[]> {
  const token = process.env.OPENCLAW_API_KEY?.trim() || process.env.OPENCLAW_GATEWAY_TOKEN?.trim()
  if (!token) return []

  const employment =
    params.profileData && typeof params.profileData.employment_status === 'string'
      ? params.profileData.employment_status.trim()
      : undefined

  const body = {
    agent: 'ZeroResearch',
    trigger: 'NextWin',
    params: {
      journeyKey: params.journeyId,
      questionKey: params.questionId,
      answerValue: params.answerValue,
      postcode: params.postcode,
      employment_status: employment && employment.length > 0 ? employment : undefined,
      profileData: params.profileData ?? undefined,
      task: `Research the single best next financial win for this UK household given their latest answer.
If they use gas for heating, prioritise heat pump grants (Boiler Upgrade Scheme or Home Energy Scotland) with an official gov.uk or homeenergyscotland.org link.
Return concise markdown with one clear headline and one primary link.`,
    },
    ...zeroResearchInvokeExtras(),
  }

  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), NEXT_WIN_TIMEOUT_MS)

  try {
    const res = await fetch(`${GATEWAY_HTTP}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
    clearTimeout(t)
    if (!res.ok) return []

    const data = (await res.json()) as {
      markdown?: string
      citations?: ResearchCitation[]
      [key: string]: unknown
    }
    const md = typeof data.markdown === 'string' ? data.markdown.trim() : ''
    if (md.length < 24) return []

    const cites = Array.isArray(data.citations) ? data.citations : []
    const url =
      cites.find((c) => typeof c.url === 'string' && c.url.startsWith('http'))?.url ??
      firstUrlFromMarkdown(md) ??
      'https://www.gov.uk/apply-boiler-upgrade-scheme'

    const title = titleFromMarkdown(md)
    const money = inferMoneyLine(params.journeyId, params.answerValue, params.postcode)

    const providerName =
      cites.find((c) => typeof c.source_name === 'string' && c.source_name.trim())?.source_name?.trim() ?? null

    await insertResearchInvokeSnapshot({
      postcode: params.postcode,
      profileSnapshot: params.profileData ?? undefined,
      markdown: md.slice(0, 24_000),
      citations: cites,
      sourceUrl: url,
      providerName,
      agentHeadline: title,
      invokePayload: {
        request: { agent: body.agent, trigger: body.trigger, params: body.params },
        response: data,
      },
    })

    const card: ZoneTipCard = {
      id: `live-next-win-${params.journeyId}-${Date.now()}`,
      variant: 'card-compact',
      title: title || 'Next win',
      journey_key: params.journeyId as JourneyId,
      category: params.journeyId as JourneyId,
      data: {
        money,
        carbon: '800 kg',
      },
      explanation: [md.slice(0, 400).replace(/\s+/g, ' ').trim()],
      actions: {
        actionType: 'learn',
        learnUrl: url,
      },
    }

    ensureInjectionCardUrls(card)
    const railed = enforceTrueWinRails(card)
    ensureInjectionCardUrls(railed)
    if (!passesBoundaryGuard(railed, params.postcode)) return []
    return [railed]
  } catch {
    clearTimeout(t)
    return []
  }
}
