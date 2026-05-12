import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** POST { email } — validate marketing / tips signup (extend with CRM or DB when ready). */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const raw =
    typeof body === 'object' && body !== null && typeof (body as { email?: unknown }).email === 'string'
      ? (body as { email: string }).email
      : ''
  const email = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
