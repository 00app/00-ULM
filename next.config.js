/** @type {import('next').NextConfig} */
const { loadEnvLocal } = require('./scripts/load-env-local.cjs')
// `.env.local` wins over stale exported shell vars (common DATABASE_URL mismatch).
loadEnvLocal({ preferLocal: true })

const isProd = process.env.NODE_ENV === 'production'

/** Baseline CSP — Turnstile + Vercel Analytics; tightens XSS surface in production. */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https: wss:",
  "frame-src https://challenges.cloudflare.com",
].join('; ')

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ...(isProd ? [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }] : []),
]

const nextConfig = {
  // Lint + tsc run in vercel.json `buildCommand` via scripts/vercel-build-gate.mjs (eslint + tsc:check).
  // Do not set `eslint` here — Next 16 removed that option and Vercel native Lint checks crash with "internal error".
  typescript: { ignoreBuildErrors: true },
  // jsdom (lib/agents/freeScraper.ts) depends on @exodus/bytes, a pure-ESM package with no CJS
  // build — Next's default bundler tries to require() it and crashes at runtime. Excluding jsdom
  // from bundling lets Node's own module resolution load it instead, which handles ESM/CJS
  // interop correctly. This masked as a mechanical-triplet-fallback "cost saving" for a while:
  // the fallback path never called the real scraper, so this crash never fired in production.
  serverExternalPackages: ['jsdom'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}
module.exports = nextConfig
