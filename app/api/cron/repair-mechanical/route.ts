import { NextRequest, NextResponse } from 'next/server'
import { shutdownDbPool } from '@/lib/db'
import {
  repairResearchResultsMissingHeadlines,
  seedMechanicalJourneysForDistinctPostcodes,
  seedMechanicalJourneysForPostcode,
} from '@/lib/agents/researchAgent'
import { JOURNEY_IDS } from '@/lib/journeys'
import { normalizeSecret } from '@/lib/intelligence/normalizeSecret'

export const runtime = 'nodejs'
/** Mechanical 13-journey seed + headline/URL repair — no Firecrawl, no Gemini. */
export const maxDuration = 120
export const dynamic = 'force-dynamic'

function authorizeCron(request: NextRequest): boolean {
  const secret = normalizeSecret(process.env.CRON_SECRET)
  if (!secret || secret.length < 16) return false
  const bearer = normalizeSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))
  const header = normalizeSecret(request.headers.get('x-cron-secret'))
  return bearer === secret || header === secret
}

/**
 * Hermes mechanical repair — seed 13 Zone journeys and backfill short headlines / wrong Ofgem URLs.
 * `GET /api/cron/repair-mechanical?postcode=SW1A1AA`
 * `GET /api/cron/repair-mechanical?seed=all&limit=5`
 * `GET /api/cron/repair-mechanical?limit=6` (row repair only)
 */
async function runRepairMechanical(request: NextRequest): Promise<Response> {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = request.nextUrl.searchParams.get('limit') ?? '6'
  const limit = Math.min(30, Math.max(1, parseInt(raw, 10) || 6))
  const postcode = request.nextUrl.searchParams.get('postcode')?.replace(/\s+/g, '').trim().toUpperCase()
  const seedAll = request.nextUrl.searchParams.get('seed') === 'all'

  try {
    if (postcode && postcode.length >= 5) {
      const { seeded, journeys } = await seedMechanicalJourneysForPostcode(postcode)
      return NextResponse.json({
        ok: true,
        mode: 'seed_mechanical',
        postcode,
        seeded,
        expected: JOURNEY_IDS.length,
        journeys,
      })
    }

    if (seedAll) {
      const batch = await seedMechanicalJourneysForDistinctPostcodes(limit)
      return NextResponse.json({
        ok: true,
        mode: 'seed_mechanical_batch',
        postcodes: batch.postcodes,
        totalSeeded: batch.totalSeeded,
        expectedPerPostcode: JOURNEY_IDS.length,
        limit,
      })
    }

    const repaired = await repairResearchResultsMissingHeadlines({
      limit,
      mechanicalOnly: true,
    })
    return NextResponse.json({
      ok: true,
      mode: 'repair_mechanical',
      repaired,
      limit,
      note: 'Repairs incomplete rows (short headlines, wrong Ofgem URLs). Pass ?postcode= or ?seed=all to re-seed all 13 journeys.',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'repair_mechanical failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  } finally {
    await shutdownDbPool()
  }
}

export async function GET(request: NextRequest) {
  return runRepairMechanical(request)
}

export async function POST(request: NextRequest) {
  return runRepairMechanical(request)
}
