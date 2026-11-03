# Z2 audit: Zone intelligence vs PRD v4

Date: 25 Oct 2026. Read only; no code changed. PRD v4: https://claude.ai/artifact/8eJ2WsMJJZQtCLFj6mCbcc
Proposed schema: `db/migrations/20261025_intelligence_layer.sql` (not applied, not in `scripts/apply-pending-migrations.ts`).

## Headline findings

1. **Two rankers, one card contract.** Library actions rank in `lib/actions/selectActions.ts` (`scoreAction`); research cards rank in `lib/zone/buildZoneViewModel.ts` (1,651 lines) and `gridOrder` / `directorsOrder`; both land as `RecCardModel` in `lib/zone/recCard.ts`, which already drops any £ without a source. v4's ranker should wrap both, not replace either.
2. **No confidence anywhere.** No card, action, account or answer carries a confidence level or data tier. This is the biggest gap against v4.
3. **Saving kinds are half there.** `SavingSource.kind` has verified, sample, typical. v4 needs estimated and realised, and realised needs evidence.
4. **Outcomes stop at "done".** Completions are `user_actioned_cards` (signed in) or localStorage (guests): card id and time only. No option chosen, no estimate at approval, no evidence, no follow-up.
5. **Knowledge gathering is client-side and thin.** 17 loop questions (1 or 2 per journey, none for lifestyle), answered state in localStorage only. Nothing server-side records asked, answered or skipped.
6. **`household_accounts` is a strong base.** Bills and contracts with provider, monthly amount, renewal and contract end dates, manual or bank source. Signed-in only; no source URL, as-of or confidence; no membership or pet categories.
7. **Library coverage is uneven.** 63 actions: money 17, travel 10, home 9, utilities 9, water 6, food 4, tech 4, shopping 2, solar 1, waste 1, holidays 0, carbon 0, lifestyle 0. 53 were last verified 31 Jul 2026; only 1 uses `reviewBy`.
8. **Public data clients have no shared cache.** No caching found in `lib/intelligence/*Client.ts`; the data service should own caching.
9. **Gemini is called from about 20 places** (agents, Zai, discovery, zone generate and refresh routes) through `aiGateway` with failover. v4 should route card wording through one checked path.
10. **Lifestyle has no footprint.** The string `lifestyle` appears nowhere in `lib` or `app`; the database has no category CHECK constraints, so adding it is code-only.

## 1. Cards and ranking

| Item | File | What it does | Gap vs v4 |
| --- | --- | --- | --- |
| Rec card contract | `lib/zone/recCard.ts` | Slots: label, headline, typical saving, whyYou, CTAs, badge; drops £ without `savingSource` | Add confidence, tier, metrics, why drivers, options, gaps, context, estimated and realised kinds |
| Rec card from research | `lib/zone/recCardFromZone.ts` | Maps research rows to cards | Must emit the full contract |
| Library ranking | `lib/actions/selectActions.ts` | `scoreAction`: £ (capped 1,500), kg, free or low cost, CLAIM bonus, gate matches; hard filters; bucket diversity with backfill | No confidence, deadline or dismissal terms |
| Zone view model | `lib/zone/buildZoneViewModel.ts` | Builds the wall from research, profile, season, goal | Very large; read cards through the data service rather than adding more logic here |
| Grid and directors order | `lib/zone/gridOrder.ts`, `directorsOrder.ts` | Category order and placement | Replace with v4 rank for hero and Action Centre; keep for category rails |
| Rails | `lib/zone/rails.ts` | Hero (3), Biggest savings (12), Today, one rail per category with 2 or more cards | Hero becomes "one thing that needs you now"; add Action Centre rail |
| Zone card UI | `app/components/ZoneRecCard.tsx`, `JourneyBentoCard.tsx` (1,354 lines) | Card rendering | Compact v4 card in the brand language |
| Solo Focus | `app/components/SoloFocusOverlay.tsx` (1,070 lines), `lib/zone/soloFocus*.ts` | Deep view, journey nav, engagement | Rebuild content slots (Z9); keep open, close and nav |
| Signals | `offer_signals` table | like, dislike, indifferent, ask, feedback answer | Feed v4 dismissal and learning terms |
| Zone agents | `lib/zoneAgents/registry.ts` | Moving agent, eligibility from life events | Pattern for category agents |

## 2. £ and kg figures

| Item | File | Source, as-of, confidence today | Gap |
| --- | --- | --- | --- |
| Library actions | `lib/actions/actionLibrary.ts` | `source` and `verifiedOn` on every action; no confidence | Add confidence and `reviewBy` to all; refresh the 53 dated 31 Jul |
| Research cards | `research_results` and `recCardFromZone.ts` | Citations JSON and truth columns; no confidence | Confidence from citation quality and age |
| Truth ledger | `lib/intelligence/buildIntelligenceLedger.ts` | Status per journey: settled, computing, bleed, estimated; verified flag | Map to confidence and tier |
| Bank analysis | `lib/bank/analysis.ts` | Sample or live provider; status none, sample, live | Tier 3 source; sample stays badged |
| Household accounts | `household_accounts` | Manual or bank; no as-of beyond updated_at | Add source URL, as-of, confidence |

## 3. Profile data

| Data | Where stored | Used by | Gap |
| --- | --- | --- | --- |
| Onboarding answers (3 per journey) | `user_profiles.journey_answers_jsonb`, `guest_sessions.profile` and `journey_answers`, localStorage | Action gates, view model, loop picks | No per-answer source or date; no delete per field |
| Loop answers | localStorage via `lib/zone/loopMemory.ts` | Action `gates.loop` | Not server-side; lost across devices |
| Property prefill | `lib/intelligence/propertyAnswerPrefill.ts`, `persistPropertyPrefill.ts` | Home and utilities cards | Tag tier 1 with source and date |
| Bills and contracts | `household_accounts` (signed in) | Settings living pages, Moving agent | Not used by Zone cards yet; no guest path |
| Moves | `household_moves` | Moving agent | Fine |

## 4. Public data clients

EPC (`openEpcClient`, `epcAddressMatch`), Land Registry, deprivation, flood risk, DNO, NESO grid, PVGIS, solar irradiance, Climatiq, Defra waste, Open Food Facts, Bank of England, postcode geo. Gap: no shared cache or as-of on results; the data service (Z3) wraps them and stores results as tier 1 facts.

## 5. Gemini

| Caller group | Files | Gap |
| --- | --- | --- |
| Gateway and failover | `lib/intelligence/aiGateway.ts`, `bucketFailover.ts`, `geminiModels.ts` | Keep as the single entry |
| Research and discovery | `lib/agents/researchAgent.ts`, `researcher.ts`, `discovery*.ts`, `contentArchitect.ts`, `zeroHunterRun.ts`, `rebirthVaultDiscovery.ts`, `skills/researchLocalGrants.ts` | Produce facts and citations; must not produce card figures directly |
| Zone routes | `app/api/zone/generate-next`, `tips-refresh`, `lib/zone/discoveryCard.ts` | Route through the v4 checked wording path |
| Zai | `lib/zai/agent.ts`, `lib/brains/zai/prompts.ts`, `app/api/zai/route.ts` | Use data service tools; sources and confidence in answers |
| Sentinel | `lib/agents/sentinel.ts`, `lib/sentinel/liveGrounding.ts` | Unchanged |

## 6. Per journey

| Journey | Library actions | Loop questions | Main evidence today | Biggest gap |
| --- | --- | --- | --- | --- |
| Home | 9 | 2 | EPC, Land Registry, flood, deprivation, grants | Boiler age, loft depth; tenure-led options |
| Utilities | 9 | 1 | Supplier, price cap, DNO | Tariff type and fix end date not captured |
| Solar | 1 | 1 | PVGIS, irradiance | Few actions; roof and shade questions |
| Travel | 10 | 2 | Transport answer | Renewal dates (use household_accounts) |
| Holidays | 0 | 2 | Answers only | No library actions |
| Food | 4 | 2 | Open Food Facts | Weekly spend unknown |
| Shopping | 2 | 1 | Answers | Thin; depends on bank data |
| Money | 17 | 2 | Bank analysis, BoE | Savings rate, council tax band check |
| Tech | 4 | 1 | Answers | Provider, end date, price not captured outside household_accounts |
| Water | 6 | 1 | Supplier by postcode | Metered status, occupants |
| Waste | 1 | 1 | Defra waste | Thin |
| Carbon | 0 | 1 | Climatiq, NESO | Roll-up only by design |
| Lifestyle | 0 | 0 | None | New category (Z5) |

## Proposed database changes

File: `db/migrations/20261025_intelligence_layer.sql`. Idempotent, additive, no data rewrite.

| Change | Purpose | Used in |
| --- | --- | --- |
| `household_facts` (new) | Every known fact with source, as-of, confidence, tier; one row per field per household; hard delete | Z3, Z7 "What we know" |
| `household_accounts` (extend) | Lifestyle and insurance categories; tariff, fixed flag, usage per month, source URL, as-of, confidence; guest owner | Z3, Z5, Z6 |
| `insight_cards` (new) | Generated card snapshots with rank, confidence, ranges, options, why, gaps, generated_by and the check result | Z4, Z8, Z9 |
| `knowledge_questions` (new) | Shown, answered, skipped per question per household, with value score | Z7 |
| `tasks` (new) | One row per acted-on card: option, state, approval tier, estimated and realised ranges | Z10, Z11 |
| `task_events` (new) | Append-only event log for playback | Z11 |
| `task_evidence` (new) | Bills, confirmations, entered prices that make a saving realised | Z11 |
| `outcome_priors` (new) | Aggregated choice and realised rates by category and region, only groups of 5 or more | Z12 |

Every new table takes either `user_id` or `guest_session_id`, like `offer_signals`, and cascades on user delete.

## Recommended changes to the Z3 to Z12 plan

- Z3: build on `lib/household/data.ts` (extend, do not create a second service); add the fact store and caching for intelligence clients.
- Z4: extend `RecCardModel` in place; keep `resolveRecCard` returning null for unsupportable cards.
- Z6: write the 13 spec files, and add library actions for holidays, carbon and lifestyle, plus more for solar, waste and shopping.
- Z7: move loop answers server-side into `household_facts` and `knowledge_questions`; keep localStorage as the guest cache.
- Z11: migrate `user_actioned_cards` rows into `tasks` as state done, kind typical, no realised.
