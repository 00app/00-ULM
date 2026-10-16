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
| Price constants | **Done** — October 2026 Ofgem cap £1,723 (`TRUTH_2026_JULY`); April £1,641 retained for policy-step copy | `lib/brains/constants.ts` |

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
| Zai persistence | **Done** — transcript saved and restored per user / guest session; `zai_messages` recreated on production 2026-10-15 | `app/api/zai/route.ts`, `lib/zai/chatHistory.ts`, migration `20260704` |
| Household living | **Done (manual)** — signed-in users record bills and contracts by group (home, utilities, vehicle, subscriptions), soft-end them, see a static switching tip per category, and run a moving-house checklist. Signed-in only; no guest path by design (financial data). Live on production 2026-10-16 | `household_accounts`, `household_moves` (migration `20261015`), `lib/household/*`, `app/api/household/**`, `/settings/living/[group]`, `/settings/living/move` |
| Bill ingestion | OCR / manual bill → utilities journey seed. Manual entry now exists via Household living; OCR not started | Upload API, Gemini extract |
| Grants as first project type | Grant application tracker | `grants` journey, Solo Focus handoff |

## Phase 3 — Scale & trust

- Multi-region postcode (non-GB formats via explicit country resolution)
- Public API for partner embeds
- `ignoreBuildErrors` removal once type surface is clean (`next.config.js` — mitigated today by `vercel-build-gate`)

## Strategy check 2026-10-16

Checked against the north star (**£ realised across active projects**) after the October entry-flow, first-result and Household living work. `npm run verify` green (768 checks).

| # | Area | Finding | Status |
|---|------|---------|--------|
| 1 | First result | Four live, sourced insights (energy, carbon, solar, home) replace the single figure. Supports Phase 1 money-first: the user sees real local numbers before any ask. Mechanical truth held: missing sources are omitted, never estimated. | Aligned |
| 2 | First result → guest path | Screen now has **one** action, START (create account). "Skip for now" (guest → Zone) and "Log in" were removed. This trades guest reach and Phase 1 "Faster TTV" for account conversion: a visitor can no longer see Zone without creating an account, and a returning user who lands here must go back to the splash to log in. | **Decided 2026-10-16 (Gary): keep START only, no guest path, no Log in on this screen.** Returning users log in from the splash. |
| 3 | Verified £ on Zone | A £ is verified only by a Neon `research_results` row with a source URL (ENTRY-AND-ZONE-RAILS §2). The daily `/api/cron/zone-research` has no-opped since late August because `LIVE_LLM_CONTENT_ENABLED` is off (cost control). Verified £ figures are therefore ageing and will not grow. Directly limits the money-first wall. Note: the flag is a **master switch** for all live LLM content (`aiGateway`, `zeroAgent`, the cron), not only the cron. | **Decided 2026-10-16 (Gary): turn on for the daily cron only.** New `ZONE_RESEARCH_CRON_LLM_ENABLED=1` enables live LLM content inside `/api/cron/zone-research` alone (AsyncLocalStorage scope in `scrapeBoundaries.ts`); `LIVE_LLM_CONTENT_ENABLED` stays off, so sign-up, Solo Focus and Zai keep template content. Spend bounded by the cron `limit=3`. |
| 4 | Household living | Manual accounts + moving checklist are the first persisted "active project"-like objects. Not yet the `projects` model: no switch/grant/install status, no £ realised. `RecurringCategory` (bank) and `HouseholdCategory` (manual) are separate taxonomies and must be reconciled before bank-matched and manual accounts show together. | Partly aligned |
| 5 | Savings tracker | Only confirmed switches count; sample savings never added. This is the north-star metric in miniature. | Aligned |
| 6 | Environments | Local `.env.local` points at a different Neon database (`ep-quiet-boat`) from production (`ep-floral-recipe`). Preview deployments have no `DATABASE_URL`. Local testing does not reflect production data or schema. | Risk |
| 7 | Docs | `HANDOFF-01-PAGER.md` still says production has no `DATABASE_URL` (fixed 2026-10-15). `FULL-APP-SPEC.md` intro row is flagged in ENTRY-AND-ZONE-RAILS conflicts #1 and #5. | Stale, flagged |

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
