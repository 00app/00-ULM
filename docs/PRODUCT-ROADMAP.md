# Product roadmap — pivot to focus

Distilled from the June 2026 product review (`claude/forked-project-review-9naqz7`). North star: **£ realised across active projects**, not one-shot tips.

## Phase 0 — Instrumentation & honesty (do first)

| Item | Goal | Code touchpoints |
|------|------|------------------|
| Funnel events | **Done** — schema + client wiring + `GET /api/admin/funnel` | `lib/analytics/funnelEvents.ts`, `trackFunnelEvent.ts`, `funnelReport.ts` |
| Mechanical-truth eval | **Done** — UK_2026 zeros, stream flags, VM fixtures, EPC address filter, July cap lock (11 checks) | `lib/zone/mechanicalTruthEval.ts`, `npm run test:mechanical-truth` |
| Zod on hot paths | **Done** — answers, scrape-sync, analytics, zone/injections | `lib/api/schemas.ts` |
| Durable rate limits | **Done** — Upstash REST when env set; in-memory fallback | `lib/rateLimitDistributed.ts`, `checkRateLimitAsync` |
| Observability | **Partial** — `onRequestError`, `captureServerError`, optional `SENTRY_DSN` | `instrumentation.ts`, `lib/observability/captureError.ts` |

**Exit criteria:** Funnel dashboard queryable from `analytics_events`; mechanical-truth eval green in CI; rate limits survive cold start.

## Phase 1 — Money-first wall

| Item | Goal | Code touchpoints |
|------|------|------------------|
| £-first hero | **Done** — lead with biggest verified or estimated win | `lib/zone/buildZoneViewModel.ts`, `app/zone/page.tsx` |
| Offer label / CTA alignment | **Done** — CTA URL wins for provider label in Solo Focus | `lib/soloFocusSuppliedBy.ts`, `JourneyBentoCard.tsx` |
| Optional house number (EPC) | **Done** — disambiguate register row at postcode | `ProfilePageClient.tsx`, `openEpcClient.ts`, `/api/local-intelligence` |
| Biggest win card | Surface top journey by `moneyGbp` on primary wall slice | `lib/zone/gridOrder.ts`, ULM 3-card home slice |
| Faster TTV | Reduce summary dwell; optional skip for returners | `app/profile/summary/page.tsx`, `lib/returningUserGate.ts` |
| Price constants | **Done** — July 2026 Ofgem cap £1,862 (`TRUTH_2026_JULY`); April £1,641 retained for policy-step copy | `lib/brains/constants.ts` |

**Exit criteria:** Median time-to-first-Solo-Focus &lt; 3 min; hero shows non-zero £ when profile baseline exists.

## Phase 1.5 — Tool UX (in flight)

| Item | Status | Touchpoints |
|------|--------|-------------|
| Solo Focus wall-ring nav | Done | `lib/zone/soloFocusJourneyNav.ts`, `SoloFocusJourneyNav.tsx` |
| Nav label voice (mothers UPPER, tips fragment) | Done | `lib/zone/soloFocusNavLabels.ts`, `zone-voice-copy.mdc` |
| New-card **+** badge | Done | `lib/zone/soloFocusNewCard.ts`, `useVisitedCardIds.ts` |
| Session prose variety | Done | `lib/zone/sessionProseLedger.ts` |
| Buy-link previews | Open | `IndustrialHandoffButton`, `offerUrlGuard.ts` |
| Likes fragmentation | Open | `AppContext` vs local snapshots |
| Mobile signup + SMS | **Done** — opt-in checkbox, welcome SMS + tips/recs (`signupZoneSms`), topic-aligned Rock URLs, STOP/START webhook | `RockMobileSignupCard`, `lib/messaging/*`, `resolveRockHabitLearnUrl`, migration `020` |

## Phase 2 — Projects workspace

| Item | Goal | Touchpoints |
|------|------|-------------|
| `projects` model | Persist active saves (switch, grant, install) with status | Neon schema, new API routes |
| Zai persistence | Thread context across sessions | `app/zai/`, chat history table |
| Bill ingestion | OCR / manual bill → utilities journey seed | Upload API, Gemini extract |
| Grants as first project type | Grant application tracker | `grants` journey, Solo Focus handoff |

## Phase 3 — Scale & trust

- Multi-region postcode (non-GB formats via explicit country resolution)
- Public API for partner embeds
- `ignoreBuildErrors` removal once type surface is clean (`next.config.js` — mitigated today by `vercel-build-gate`)

## Mechanical truth invariants (non-negotiable)

1. `UK_2026_MONEY_LEAD` — all `money_value: 0` until stream (`lib/scraper/uk2026Defaults.ts`).
2. No journey tile shows stream-sourced £ without `journeyHasStreamData` or profile formula baseline (`lib/zone/mechanicalTruth.ts`, `buildZoneViewModel.ts`).
3. Empty guest (no profile, no Neon, no scrape) → no positive `moneyGbp` on journey tiles; mechanical headlines at £0 are allowed until stream arrives.
4. ULM ceilings unchanged: 24 bento cells, 3 discovery injects/journey (`lib/zone/ulmLimits.ts`).

## Related docs

- [HANDBOOK.md](HANDBOOK.md) — pipeline map
- [ULM-APPLICATION-LOOP.md](ULM-APPLICATION-LOOP.md) — spawn ceilings
- [USER-FLOW-AND-DATA-PIPELINE.md](USER-FLOW-AND-DATA-PIPELINE.md) — journey contract
- [DEV-TEST-AUDIT.md](DEV-TEST-AUDIT.md) — UAT gate
