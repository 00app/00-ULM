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

function adminPasswordMatches(authHeader: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD?.trim()
  if (!password || !authHeader?.trim().toLowerCase().startsWith('basic ')) return false
  try {
    const encoded = authHeader.trim().slice(6).trim()
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    const colon = decoded.indexOf(':')
    const suppliedPassword = colon >= 0 ? decoded.slice(colon + 1) : decoded
    return suppliedPassword === password
  } catch {
    return false
  }
}

function legacyBasicHeaderMatches(authHeader: string | null): boolean {
  const expected = process.env.ADMIN_BASIC_AUTH?.trim() || process.env.ADMIN_AUTH_HEADER?.trim() || ''
  return Boolean(expected && authHeader === expected)
}

export function adminBasicAuthMatches(request: NextRequest): boolean {
  const got = request.headers.get('authorization')
  if (legacyBasicHeaderMatches(got)) return true
  return adminPasswordMatches(got)
}
