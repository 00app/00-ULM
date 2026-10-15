import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { unauthorizedResponse } from '@/lib/requestAuth'
import { isHouseholdCategory, isHouseholdGroup } from '@/lib/household/categories'
import {
  listHouseholdAccounts,
  listHouseholdAccountsByGroup,
  upsertHouseholdAccount,
  type HouseholdAccountInput,
} from '@/lib/household/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Settings → Living, one group's accounts.
 * GET ?group=home — active accounts for that group. Guests get an empty list, never a 401,
 * same convention as /api/household/summary.
 * POST — insert (no id) or update (id present) a single account for the signed-in user.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest()
  const groupParam = request.nextUrl.searchParams.get('group')
  const categoryParam = request.nextUrl.searchParams.get('category')

  if (groupParam && !isHouseholdGroup(groupParam)) {
    return NextResponse.json({ error: 'Unknown group' }, { status: 400 })
  }
  if (categoryParam && !isHouseholdCategory(categoryParam)) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 400 })
  }

  const accounts = isHouseholdGroup(groupParam)
    ? await listHouseholdAccountsByGroup(session?.userId, groupParam)
    : await listHouseholdAccounts(session?.userId, isHouseholdCategory(categoryParam) ? categoryParam : undefined)

  return NextResponse.json({ signedIn: Boolean(session), accounts })
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest()
  if (!session?.userId) return unauthorizedResponse()

  let body: Partial<HouseholdAccountInput> | null = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || !isHouseholdCategory(body.category)) {
    return NextResponse.json({ error: 'A valid category is required' }, { status: 400 })
  }

  const saved = await upsertHouseholdAccount(session.userId, {
    id: typeof body.id === 'string' ? body.id : undefined,
    category: body.category,
    provider_name: typeof body.provider_name === 'string' ? body.provider_name : null,
    nickname: typeof body.nickname === 'string' ? body.nickname : null,
    monthly_amount_pence: typeof body.monthly_amount_pence === 'number' ? body.monthly_amount_pence : null,
    renewal_date: typeof body.renewal_date === 'string' ? body.renewal_date : null,
    contract_end_date: typeof body.contract_end_date === 'string' ? body.contract_end_date : null,
    postcode: typeof body.postcode === 'string' ? body.postcode : null,
  })

  if (!saved) return NextResponse.json({ error: 'Could not save account' }, { status: 500 })
  return NextResponse.json({ account: saved })
}
