import crypto from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * Server-only admin gate for `/api/admin/*` and `/admin/pulse`.
 *
 * Set `ADMIN_PASSWORD` in Vercel / `.env.local` — **never** `NEXT_PUBLIC_*`.
 * The browser receives a `WWW-Authenticate: Basic` challenge from `proxy.ts`;
 * the password is validated here and never serialized into the client bundle.
 *
 * Optional script override: `ADMIN_BASIC_AUTH=Basic <base64(user:pass)>` for curl/Hermes.
 */

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim())
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

function adminPasswordMatches(authHeader: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD?.trim()
  if (!password || !authHeader?.trim().toLowerCase().startsWith('basic ')) return false
  if (process.env.NODE_ENV === 'production' && password.length < 16) return false
  try {
    const encoded = authHeader.trim().slice(6).trim()
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    const colon = decoded.indexOf(':')
    const suppliedPassword = colon >= 0 ? decoded.slice(colon + 1) : decoded
    return timingSafeStringEqual(suppliedPassword, password)
  } catch {
    return false
  }
}

function legacyBasicHeaderMatches(authHeader: string | null): boolean {
  const expected = process.env.ADMIN_BASIC_AUTH?.trim() || process.env.ADMIN_AUTH_HEADER?.trim() || ''
  if (!expected || !authHeader) return false
  return timingSafeStringEqual(authHeader.trim(), expected)
}

export function adminBasicAuthMatches(request: NextRequest): boolean {
  const got = request.headers.get('authorization')
  if (legacyBasicHeaderMatches(got)) return true
  return adminPasswordMatches(got)
}
