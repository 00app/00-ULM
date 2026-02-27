import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (token) await deleteSession(token)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', '', { path: '/', maxAge: 0 })
  return res
}
