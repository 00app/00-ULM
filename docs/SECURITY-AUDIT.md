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
- Client restore: `lib/client/sessionRestoreProofStorage.ts`, `lib/client/ensureProfileSession.ts`
- Answers gate: `lib/answers/resolveAnswersUser.ts`
- Health: `app/api/health/route.ts`, `app/api/health/diagnostics/route.ts`
- Analytics: `app/api/analytics/route.ts`
