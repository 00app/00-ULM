import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { unauthorizedResponse, tooManyRequestsResponse } from '@/lib/requestAuth'
import { checkRateLimitAsync, getClientIdentifier } from '@/lib/rateLimit'
import { compactUkPostcode, isValidUkPostcode } from '@/lib/geocode/ukPostcode'
import { fetchPostcodeGeo } from '@/lib/intelligence/postcodeGeoClient'
import { cleanAreaName, resolveFirstResult } from '@/lib/entry/firstResult'
import { MOVING_TASKS, nationFromCountry } from '@/lib/zoneAgents/moving/knowledge'
import {
  createHouseholdMove,
  getLatestHouseholdMove,
  updateHouseholdMoveChecklist,
} from '@/lib/household/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PER_MINUTE = 20
/** Agent progress lives under its own key inside household_moves.checklist_jsonb. */
const PROGRESS_KEY = 'agentTasks'

function spaced(raw: string): string {
  const c = compactUkPostcode(raw)
  return `${c.slice(0, -3)} ${c.slice(-3)}`
}

function progressOf(checklist: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const raw = checklist?.[PROGRESS_KEY]
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, v]) => v === true)) as Record<
    string,
    boolean
  >
}

/**
 * Moving Home agent. GET ?postcode= — public: the place, its council and nation, and the live
 * postcode insights (same sourced figures as the first result), plus the signed-in user's saved
 * progress. Never 401: guests get the full list and keep progress locally.
 */
export async function GET(request: NextRequest) {
  const id = getClientIdentifier(request)
  const { ok, retryAfter } = await checkRateLimitAsync(`agent-moving:${id}`, MAX_PER_MINUTE)
  if (!ok) return tooManyRequestsResponse(retryAfter)

  const raw = request.nextUrl.searchParams.get('postcode')?.trim() ?? ''
  if (!isValidUkPostcode(raw)) {
    return NextResponse.json({ error: 'valid UK postcode required' }, { status: 400 })
  }
  const postcode = spaced(raw)
  const [session, geo, live] = await Promise.all([
    getSessionFromRequest(),
    fetchPostcodeGeo(postcode).catch(() => null),
    resolveFirstResult(postcode).catch(() => null),
  ])
  const move = session ? await getLatestHouseholdMove(session.userId) : null

  return NextResponse.json({
    postcode,
    place: live?.place ?? null,
    council: cleanAreaName(geo?.adminDistrict),
    nation: nationFromCountry(geo?.country),
    insights: live?.insights ?? [],
    signedIn: Boolean(session),
    progress: progressOf(move?.checklist_jsonb),
  })
}

/**
 * POST { taskId, done, postcode, movedAt? } — signed-in only. Saves one task's state on the
 * user's latest move, starting a move for this postcode if there isn't one yet.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest()
  if (!session?.userId) return unauthorizedResponse()

  let body: { taskId?: string; done?: boolean; postcode?: string; movedAt?: string } | null = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const taskId = body?.taskId?.trim() ?? ''
  if (!MOVING_TASKS.some((t) => t.id === taskId) || typeof body?.done !== 'boolean') {
    return NextResponse.json({ error: 'A known taskId and done flag are required' }, { status: 400 })
  }

  let move = await getLatestHouseholdMove(session.userId)
  if (!move) {
    const pc = body?.postcode?.trim() ?? ''
    if (!isValidUkPostcode(pc)) return NextResponse.json({ error: 'postcode required' }, { status: 400 })
    const movedAt = /^\d{4}-\d{2}-\d{2}$/.test(body?.movedAt ?? '') ? body?.movedAt : null
    move = await createHouseholdMove(session.userId, { to_postcode: spaced(pc), move_date: movedAt })
    if (!move) return NextResponse.json({ error: 'Could not start the move' }, { status: 500 })
  }

  const progress = { ...progressOf(move.checklist_jsonb), [taskId]: body.done }
  if (!body.done) delete progress[taskId]
  const updated = await updateHouseholdMoveChecklist(session.userId, move.id, {
    ...move.checklist_jsonb,
    [PROGRESS_KEY]: progress,
  })
  if (!updated) return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  return NextResponse.json({ progress: progressOf(updated.checklist_jsonb) })
}
