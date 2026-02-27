import { cookies } from 'next/headers'
import pool from '@/lib/db'
import crypto from 'crypto'

const SESSION_COOKIE = 'session'
const SESSION_DAYS = 30

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS)
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt.toISOString()]
  )
  return token
}

export async function getSessionFromRequest(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? null
  if (!token) return null

  const result = await pool.query(
    `SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now()`,
    [token]
  )
  const row = result.rows[0]
  if (!row) return null
  return { userId: String(row.user_id) }
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token])
}

export function getSessionCookieAttributes(): { name: string; value: string; options: Record<string, unknown> } {
  return {
    name: SESSION_COOKIE,
    value: '',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    },
  }
}
