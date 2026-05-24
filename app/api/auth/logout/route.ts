import { NextResponse } from 'next/server'
import { deleteSession, getSessionCookieAttributes, readSessionTokenFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** POST /api/auth/logout — invalidate session and clear cookie. */
export async function POST() {
  try {
    const token = await readSessionTokenFromCookies()
    if (token) {
      await deleteSession(token)
    }
    const { name, options } = getSessionCookieAttributes(0)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(name, '', { ...options, maxAge: 0 })
    return res
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
