import { NextRequest, NextResponse } from 'next/server'
import { shutdownDbPool } from '@/lib/db'
import { repairResearchResultsMissingHeadlines } from '@/lib/agents/researchAgent'
import { normalizeSecret } from '@/lib/intelligence/normalizeSecret'

export const runtime = 'nodejs'
/** BUS + Ofgem SQL backfill only — no Firecrawl, no Gemini. */
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function authorizeCron(request: NextRequest): boolean {
  const secret = normalizeSecret(process.env.CRON_SECRET)
  if (!secret || secret.length < 16) return false
  const bearer = normalizeSecret(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))
  const header = normalizeSecret(request.headers.get('x-cron-secret'))
  return bearer === secret || header === secret
}

/**
 * Fast Hermes repair pulse — mechanical triplets for BUS + Ofgem URLs only.
 * `GET /api/cron/repair-mechanical?limit=6` (Bearer CRON_SECRET).
 */
async function runRepairMechanical(request: NextRequest): Promise<Response> {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = request.nextUrl.searchParams.get('limit') ?? '6'
  const limit = Math.min(30, Math.max(1, parseInt(raw, 10) || 6))

  try {
    const repaired = await repairResearchResultsMissingHeadlines({
      limit,
      mechanicalOnly: true,
    })
    return NextResponse.json({
      ok: true,
      mode: 'repair_mechanical',
      repaired,
      limit,
      note: 'BUS gov.uk + Ofgem price-cap rows only. Deploy this route if Hermes was timing out on zone-research?repair=1.',
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
