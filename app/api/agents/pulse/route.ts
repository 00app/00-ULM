/**
 * ZeroHunter heartbeat — cron / internal agent pulse.
 * Top “unspent” users → run price-cap + grant scrape → inject Discovery Card if saving > £50.
 *
 * Auth: `Authorization: Bearer <GATEWAY_TOKEN>` (not `CRON_SECRET`).
 */

import { NextRequest, NextResponse } from 'next/server'
import { gatewayTokenMatches } from '@/lib/gatewayAuth'
import { getTopUnspentUsersForPulse, getJourneyAnswersForUser } from '@/lib/db/neon'
import { runZeroHunterForUserProfile } from '@/lib/agents/zeroHunterRun'
import { validateInjectionCard } from '@/lib/zone/injections'
import { sanitizeAgentMarkdown } from '@/lib/agents/zeroHunterMarkdown'
import { persistZoneTipInjectBody } from '@/lib/zone/persistZoneTipInject'

export const dynamic = 'force-dynamic'

function authorizePulse(req: NextRequest): boolean {
  if (gatewayTokenMatches(req)) return true
  return process.env.NODE_ENV !== 'production'
}

export async function POST(req: NextRequest) {
  return handlePulse(req)
}

export async function GET(req: NextRequest) {
  return handlePulse(req)
}

async function handlePulse(req: NextRequest) {
  if (!authorizePulse(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await getTopUnspentUsersForPulse(5)
  const results: Array<{ userId: string; injected: boolean; valueGbp?: number }> = []

  for (const u of users) {
    const ja = await getJourneyAnswersForUser(u.id)
    const heating = ja.home?.energy_type ?? (ja.home as Record<string, string> | undefined)?.heating ?? null
    const hit = await runZeroHunterForUserProfile({
      postcode: u.postcode?.replace(/\s+/g, '').trim() ?? null,
      homeType: u.home_type,
      heatingType: heating ? String(heating) : null,
    })
    if (!hit || hit.valueGbp <= 50) {
      results.push({ userId: u.id, injected: false })
      continue
    }

    const card = validateInjectionCard({
      id: `inject-zerohunter__${u.id}__${Date.now()}`,
      title: hit.title.trim().slice(0, 72).toUpperCase(),
      journey_key: 'home',
      category: 'home',
      data: {
        money: hit.valueGbp >= 1000 ? `£${(hit.valueGbp / 1000).toFixed(1)}k` : `£${Math.round(hit.valueGbp)}`,
        carbon: '0 kg CO₂',
      },
      source: hit.source_url,
      explanation: [sanitizeAgentMarkdown(hit.description, 400)],
      actions: {
        actionType: 'learn',
        learnUrl: hit.source_url,
        actionUrl: hit.source_url,
      },
      cta: { label: 'Open source', url: hit.source_url },
    })
    if (!card) {
      results.push({ userId: u.id, injected: false })
      continue
    }

    const injected = persistZoneTipInjectBody({ cards: [card] }) > 0
    results.push({ userId: u.id, injected, valueGbp: hit.valueGbp })
  }

  return NextResponse.json({ ok: true, results })
}
