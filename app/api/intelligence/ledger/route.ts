export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { buildIntelligenceLedger } from '@/lib/intelligence/buildIntelligenceLedger'

/** GET — session user's truth ledger (profile, register, behaviour, journey gates). */
export async function GET() {
  try {
    const session = await getSessionFromRequest().catch(() => null)
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ledger = await buildIntelligenceLedger(pool, session.userId)
    if (!ledger) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ ledger })
  } catch (error) {
    console.error('[api/intelligence/ledger]', error)
    return NextResponse.json({ error: 'Failed to load truth ledger' }, { status: 500 })
  }
}
