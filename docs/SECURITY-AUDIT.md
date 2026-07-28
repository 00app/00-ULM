# Security audit — 00-ULM

OWASP-focused review (Next.js / Vercel / Neon).

## Remediation status

| ID | Issue | Status |
| --- | --- | --- |
| H-1 | UUID-only auth on `POST /api/answers` | **Fixed** |
| H-2 | Guest tier-2 JIT scrape | **Fixed** |
| M-1 | Mobile in `localStorage` | **Fixed** |
| M-2 | Mobile echoed in API | **Fixed** |
| M-3 | `restore_proof` TTL + XSS window | **Fixed** — 7-day TTL; proof in `sessionStorage` only |
| M-4 | Diagnostics invoke payload to any session | **Fixed** |
| M-5 | Public `/api/health` provider map | **Fixed** |
| M-6 | `userId` in `localStorage` | **Fixed** — id embedded in proof only; legacy keys cleared |
| M-7 | Unauthenticated analytics writes | **Fixed** |
| M-8 | `/api/analytics/click` stub | **Fixed** — route removed |
| L-5 | Transitive `esbuild` CVE | **Fixed** — `esbuild` override `^0.28.1` in `package.json` |
| M-9 | `getClientIp()` trusted first hop of `x-forwarded-for`, letting a client rotate a spoofed header to bypass login/signup/SMS rate limits | **Fixed** — now takes the last hop (the IP Vercel's edge appends itself); earlier hops are client-supplied and untrusted |
| M-10 | `resolveResearchUserId()` accepted `user_id` from the query string for `SCRAPER_SECRET`-bearer requests, widening blast radius if the secret leaked (query params land in access/proxy logs and referrers) | **Fixed** — explicit `user_id` now accepted from POST body only |
| M-11 | `POST /api/zone/injections/achievement` had no auth check gating the handler — an unauthenticated request could inject an arbitrary card into the shared, cross-user in-memory Zone tip store (`appendStoredInjections`), served to every visitor on that Vercel instance | **Fixed** — gated on `requireAiRouteAuth` (session or server-issued guest cookie) |
| M-12 | `POST /api/memory/flush` had no auth check and no runtime body validation (`as MemoryFlushPayload` cast) — an unauthenticated request could overwrite the global variable later pasted into the live Gemini prompt for tip generation | **Fixed** — gated on `requireAiRouteAuth`; body validated against `memoryFlushPostBodySchema` (`lib/api/schemas.ts`), capping field lengths and total payload size |

## Rate limiting

`lib/rateLimitDistributed.ts` (Neon-backed, via `lib/rateLimitNeon.ts`) replaced the old per-instance in-memory map for `checkRateLimitAsync` (2026-07) — a limit now holds across serverless instances instead of resetting on every cold start. No new vendor; reuses the existing Neon connection. Guest-tier AI/scrape routes (`requireAiRouteAuth` in `lib/requestAuth.ts`) rate-limit guest identities only, not signed-in sessions — a known, accepted gap since account creation itself is already rate-limited (`POST /api/user`, 5/min/IP).

## Production headers

`next.config.js` sets in production:

- `Content-Security-Policy` (Turnstile + Vercel Analytics allowlisted)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Verify

```bash
npm run verify
```

## Key files

- Auth: `lib/auth.ts`, `lib/sessionCookieSign.ts`, `lib/sessionRestoreProof.ts`
- AI/scrape route gate: `lib/requestAuth.ts` (`requireAiRouteAuth`, `requireUserOrServiceBearer`)
- Client restore: `lib/client/sessionRestoreProofStorage.ts`, `lib/client/ensureProfileSession.ts`
- Answers gate: `lib/answers/resolveAnswersUser.ts`
- Request body validation: `lib/api/schemas.ts` (zod schemas for hot routes)
- Rate limiting: `lib/rateLimit.ts`, `lib/rateLimitDistributed.ts`, `lib/rateLimitNeon.ts`
- Health: `app/api/health/route.ts`, `app/api/health/diagnostics/route.ts`
- Analytics: `app/api/analytics/route.ts`
