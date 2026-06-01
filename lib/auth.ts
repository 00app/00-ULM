import { cookies } from 'next/headers'
import pool from '@/lib/db'
import crypto from 'crypto'
import type { NextResponse } from 'next/server'
import { assertSessionSecretConfigured, sealSessionToken, unsealSessionToken } from '@/lib/sessionCookieSign'

/** v1.8.14 — Hard kill; sessions never gate on third-party messaging env. */
const DISALLOW_OUTBOUND = true
void DISALLOW_OUTBOUND

export const SESSION_COOKIE = 'session'
const SESSION_DAYS = 30

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function createSession(userId: string, sessionDays: number = SESSION_DAYS): Promise<string> {
  assertSessionSecretConfigured()
  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + sessionDays)
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt.toISOString()]
  )
  return token
}

export async function getSessionFromRequest(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value ?? null
  const token = raw ? unsealSessionToken(raw) : null
  if (!token) return null

  const result = await pool.query(
    `SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now()`,
    [token]
  )
  const row = result.rows[0]
  if (!row) return null
  return { userId: String(row.user_id) }
}

/** Set signed session cookie on an API response. */
export function setSessionCookieOnResponse(
  res: NextResponse,
  token: string,
  maxAgeSeconds?: number
): void {
  assertSessionSecretConfigured()
  const { name, options } = getSessionCookieAttributes(maxAgeSeconds)
  res.cookies.set(name, sealSessionToken(token), options)
}

/** Read raw session token from cookie store (for logout invalidation). */
export async function readSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value ?? null
  return raw ? unsealSessionToken(raw) : null
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token])
}

export interface SessionCookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
}

export function getSessionCookieAttributes(maxAgeSeconds?: number): { name: string; value: string; options: SessionCookieOptions } {
  const maxAge = maxAgeSeconds ?? SESSION_DAYS * 24 * 60 * 60
  return {
    name: SESSION_COOKIE,
    value: '',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
      maxAge,
    },
  }
}
