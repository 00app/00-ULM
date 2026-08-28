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
| H-3 | `POST /api/user`'s unauthenticated name+postcode reattachment lookup matched ANY existing account (name+postcode is public information), including password-protected ones — a full account takeover: attacker gets a valid session cookie for the victim's account and overwrites their profile, no password required | **Fixed** — lookup now requires `password_hash IS NULL`; a verified session cookie (real proof of ownership) still updates its own account regardless of password (`requirePasswordless` flag on `runUpdate`, `app/api/user/route.ts`) |
| M-13 | Mobile SMS capture (`/api/profile/mobile`) only rate-limited per minute — a script could stay under that cap and drip-feed real Twilio texts to an arbitrary number indefinitely | **Fixed** — added a 6/day per-number cap (`lib/rateLimit.ts`, `lib/rateLimitDistributed.ts`, `lib/rateLimitNeon.ts` now accept a custom window instead of a hardcoded 60s one) |
| H-4 | A password-less, free-to-create session could claim any mobile number via `/api/profile/mobile` with zero ownership check, then `/api/auth/login-mobile`'s `ORDER BY created_at DESC` tie-break could let a newer, attacker-controlled row shadow the real owner's row, silently locking them out of mobile login | **Fixed** — ownership check before allowing a mobile UPDATE (409 if already claimed by another account), plus `idx_users_mobile` unique partial index in `lib/schema.sql` as defense-in-depth (2026-08) |

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
