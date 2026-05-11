# Onboarding, Zone cards, expanded view, and AI data pipeline

**Purpose:** Single reference for every onboarding question/answer, journey genome questions, Zone category cards, Solo Focus expanded content, where data comes from, how it is ordered, how Gemini and Firecrawl connect today, what is missing for stronger per-user Zone personalisation, and how “Hermes” / “Oracle” relate to this repo.

**Scope:** Documentation only — no UI/UX changes.

---

## 1. Hermes and Oracle — are they connected?

| Name | In this repository |
|------|---------------------|
| **Hermes** | **Not implemented as a named service.** `PROJECT-SPECIFICATION.md` and `app/api/profile/mobile/route.ts` note that outbound Hermes/Telegram dispatch is **not wired**. If you use “Hermes” elsewhere, map it to whatever messaging channel you intend (e.g. Telegram) — there is no Hermes client in app code. |
| **Oracle (Cloud)** | **Not connected to runtime app logic.** Optional **Cursor MCP** (`npx -y @oracle/mcp` + `~/.oci/config`) is **host-only** for monitoring (e.g. `zerozero-auditor` in London). It does not read/write Zone cards or onboarding. |
| **Practical mapping** | Spec text maps informal names to: **Gemini** → LLM generation (`@google/generative-ai`, `GEMINI_API_KEY`); **Neon** → Postgres (`DATABASE_URL`); **Firecrawl** → scrape (`FIRECRAWL_API_KEY`). |

So: **Hermes and Oracle setups you have are not automatically “connected” to Zone personalisation** unless you add explicit integrations (webhooks, workers, or MCP-driven workflows outside this repo’s Next routes).

---

## 2. Onboarding (profile) — all questions and stored answers

**Canonical UI + flow:** `app/profile/ProfilePageClient.tsx`  
**Storage:** Each field writes to `localStorage` immediately; keys below. On success, `POST /api/user` creates the user and session; `POST /api/local-intelligence` runs when postcode is entered (council/region/local carbon context).

| Step | Question label (UI) | Type | Allowed answers / notes | `localStorage` key | Stored value |
|------|------------------------|------|---------------------------|-------------------|--------------|
| 1 | `name` | free text | Any string (placeholder e.g. `alex`) | `profile_name` | as typed |
| 2 | `postcode` | free text | UK-style postcode; triggers local intelligence | `profile_postcode` | normalised in flow |
| 3 | `who do you live with?` | options | `ALONE`, `COUPLE`, `FAMILY`, `SHARED` | `profile_household` | one of those tokens |
| 4 | `your home?` | options | `FLAT`, `HOUSE` | `profile_home_type` | token |
| 5 | `how do you get around?` | options | `WALK`, `BIKE`, `PUBLIC`, `CAR`, `MIX` | `profile_transport` | token |
| 6 | `how old are you?` | options | `JUNIOR`, `MID`, `RETIRED` (persona for tips bias) | `profile_age` | token |
| 7 | `employment status?` | options | `EMPLOYED`, `SELF_EMPLOYED`, `UNEMPLOYED` (UI may show line breaks on labels) | `profile_employment_status` | token |
| 8 | `what is your goal?` | options | **SAVE** → `money`, **REDUCE** → `carbon`, **BOTH** → `balanced` (optional weighting objects on options) | `profile_goal` | `money` \| `carbon` \| `balanced` |

**Unified memory:** `lib/unifiedProfileMemory.ts` (`persistUnifiedUserProfileMemory`) mirrors profile for downstream features.

---

## 3. Journey genome — all questions and answers (Solo Focus / Zone)

**Canonical definitions (expanded question loop, validation, `isJourneyComplete`):** `lib/journeys.ts` → `JOURNEYS`  
**Next-question logic:** `lib/zone/questionHandler.ts` → `getNextQuestion` walks `JOURNEYS[journeyId].questions` in order, first item with empty answer.  
**Embedded UI:** `app/components/EmbeddedJourneyQuestion.tsx` uses **`JOURNEYS`** (labels from `question.label`, options from `FUNKY_QUESTION_LABEL` / `getOptionFullLabel` / funky circle labels in `lib/journeys.ts`).

**Per-journey storage:** `localStorage` key `journey_{journeyId}_answers` — JSON object `{ [questionId]: string }`. Synced to server via `POST /api/answers` when authenticated.

### 3.1 `home`

| Question id | Label | Type | Options / behaviour |
|-------------|-------|------|---------------------|
| `energy_type` | What is your primary heating source? | options | `GAS`, `ELECTRIC`, `WOOD`, `MIXED`, `SOLAR`, `UNKNOWN` |
| `home_insulation_level` | Is your home insulated? | options | `YES`, `NO`, `PARTIAL` |
| `electricity_provider` | electricity provider? | options | `OCTOPUS`, `BRITISH_GAS`, `EDF`, `EON`, `OVO`, `SCOTTISH_POWER`, `SHELL`, `UTILITA`, `OTHER` |
| `gas_provider` | gas provider? | options | same set |
| `monthly_cost` | monthly cost? | number | repeat prompt in `repeatLabel` |
| `green_tariff` | green tariff? | options | `YES`, `NO`, `UNKNOWN` |

### 3.2 `travel`

| Question id | Label | Type | Options / behaviour |
|-------------|-------|------|---------------------|
| `primary_transport` | How do you usually commute? | options | `CAR`, `BUS`, `TRAIN`, `BIKE`, `WALK` |
| `fuel_type` | fuel type? | options | `PETROL`, `DIESEL`, `ELECTRIC`, `HYBRID`, `NONE` |
| `distance_amount` | distance? | number | `repeatLabel` for rough miles |
| `distance_period` | per week or per month? | options | `WEEK`, `MONTH` |

### 3.3 `food`

| Question id | Label | Type | Options |
|-------------|-------|------|---------|
| `diet_type` | What best describes your diet? | options | `OMNIVORE`, `FLEXI`, `VEGETARIAN`, `VEGAN` |
| `food_waste` | food waste? | options | `LOW`, `MEDIUM`, `HIGH` |

### 3.4 `shopping`

| Question id | Label | Type | Options |
|-------------|-------|------|---------|
| `buy_new` | How often do you buy brand new? | options | `OFTEN`, `SOMETIMES`, `RARELY` |
| `secondhand` | buy secondhand? | options | `YES`, `NO` |
| `monthly_spend` | monthly spend? | number | `repeatLabel` |

### 3.5 `money`

| Question id | Label | Type | Options |
|-------------|-------|------|---------|
| `biggest_cost` | What is your biggest monthly cost? | options | `HOUSING`, `ENERGY`, `FOOD`, `TRAVEL` |
| `finances_tight` | Are your finances tight? | options | `YES`, `NO` |

### 3.6 `carbon`

| Question id | Label | Type | Options |
|-------------|-------|------|---------|
| `tracking` | Do you track your carbon? | options | `YES`, `NO` |
| `priority` | How do you prioritize carbon? | options | `LOW`, `MEDIUM`, `HIGH` |

### 3.7 `tech`

| Question id | Label | Type | Options |
|-------------|-------|------|---------|
| `upgrade_often` | How often do you upgrade your phone? | options | `MONTHLY`, `YEARLY`, `2+ YEARS` |
| `device_count` | device count? | options | `FEW`, `AVERAGE`, `MANY` |

### 3.8 `waste`

| Question id | Label | Type | Options |
|-------------|-------|------|---------|
| `recycle` | How often do you recycle? | options | `ALWAYS`, `SOMETIMES`, `NEVER` |
| `compost` | compost? | options | `YES`, `NO` |

### 3.9 `holidays`

| Question id | Label | Type | Options |
|-------------|-------|------|---------|
| `fly_frequency` | How often do you fly? | options | `NEVER`, `YEARLY`, `OFTEN` |
| `long_haul` | long haul? | options | `YES`, `NO` |

### 3.10 Parallel copy in `lib/journeys/lockedQuestions.ts`

`JOURNEY_QUESTIONS` is a **shorter prompt variant** used in some flows. It is **not** the source for `getNextQuestion` / `EmbeddedJourneyQuestion`. **Drift risk:** e.g. locked `travel` uses `weekly_distance` while canonical `JOURNEYS.travel` uses `distance_amount` + `distance_period`. Treat **`lib/journeys.ts` as authoritative** for the live expanded loop.

---

## 4. Zone — “category cards” and layout

**Page:** `app/zone/page.tsx`

| Surface | What it is | Source |
|---------|------------|--------|
| **Hero** | Top stamp card with totals / narrative hooks | `buildZoneViewModel` → `ZoneHero`; totals from `heroTotals` in context + `buildUserImpact` pipeline inside builder |
| **9 journey cards** | One per `JourneyId` in wall order | `WALL_JOURNEY_ORDER`: `home`, `travel`, `food`, `shopping`, `money`, `carbon`, `tech`, `waste`, `holidays`. Each is a `ZoneJourneyCard` from `buildZoneViewModel` (`lib/zone/buildZoneViewModel.ts`) |
| **Bento persona** | `square` / `wide` / `tall` per journey | `JOURNEY_PERSONA` in `app/zone/page.tsx` (layout only) |
| **3 tip slots** | Compact cards | Static tips from view model + **injected** discovery tips merged in `mergeDiscoveryInjectionsIntoTips`; Rock habits may replace slots (`lib/rock/*`, `RockSavingTips`) |
| **Yellow vs purple text journeys** | Legibility | `YELLOW_JOURNEY_IDS` in zone page |

**Titles and copy on cards:** Mix of deterministic strings (`JOURNEY_TITLES`, `profileDrivenJourneyTitle`, `getGeneralCardTitles`, scraper teasers, council lines) inside `buildZoneViewModel`. **Gemini enrichment** overlays headlines/insights/action lines after first paint (see §6).

---

## 5. Expanded view (Solo Focus) — content and wiring

**Primary components**

| Component | Role |
|-----------|------|
| `app/components/JourneyBentoCard.tsx` | In-grid card; can expand in-place with portal, question loop, result, Ask Zai handoff |
| `app/components/SoloFocusOverlay.tsx` | Full-screen expanded template for tips (and shared patterns); **QUESTION ↔ RESULT** states; uses `EmbeddedJourneyQuestion`, `MotherCardRenderer`, discovery follow-ups, verified source footer |
| `app/components/EmbeddedJourneyQuestion.tsx` | Renders next question from `getNextQuestion` / `JOURNEYS`; commits answers to storage + `POST /api/answers`; morph cards / generate-next integration |

**Question shown:** First unanswered question in **`JOURNEYS[journeyId].questions`** order (`lib/zone/questionHandler.ts`).

**Result / insight copy:** Built from card props + `lib/soloFocusCopy.ts` (`headlineFromTitle`, `composeScrapedInsightDescription`, asterisk wrapping), journey colours (`lib/journeyColors.ts`), trusted URLs (`lib/zone/trustedJourneyUrls.ts`), recommendations (`lib/brains/recommendations.ts`), optional **Sentinel** / morph payloads (`getNextMorphCard`, `prioritizeMorphCardsForContext`).

**Data persistence:** Answers → `journey_*_answers` localStorage + API; `zz_answer_committed` event; session sync `lib/sessionStateSync.ts`.

---

## 6. Where Zone numbers and sorting come from

**Single impact pipeline:** `buildUserImpact` in `lib/brains/buildUserImpact.ts` (imported by `buildZoneViewModel`). Profile + `journeyAnswers` + optional **scraped** overlay + **local** council context + **market** context (price cap, grid, Neon rates) feed £ and kg.

**View model builder:** `lib/zone/buildZoneViewModel.ts`

- **Genome modifier:** `getGenomeModifier` — confidence-style multiplier from how many answers exist + profile signals.
- **Baselines:** `resolveBaselineMarketRate` / `resolveJourneyLiveMarketRate` / `resolveUserEfficientRate` — journey-specific shares and transport/home adjustments.
- **Scraped overlay:** Optional per-journey `ScrapedDataPoint` from DB / defaults (`UK_2026_MONEY_LEAD`, etc.).
- **Tips merge / sort:** `mergeDiscoveryInjectionsIntoTips` — if `profile.goal === 'money'`, injected tips sorted by parsed £ string descending; if `carbon`, by parsed kg; top 3 injected preferred, then static tips de-duped by `journey_key`, max 3 tips.

**Client-side enrichment (Gemini):** After `buildZoneViewModel` runs in the browser, `app/zone/page.tsx` builds payloads via `buildContentArchitectCardPayload` (`lib/zone/architectZoneRequest.ts`), POSTs **`/api/zone/content-architect`**, applies `applyArchitectEnrichment` (`lib/agents/contentArchitect.ts`) so cards gain architect headline/insight/action/suppliedBy without changing the underlying £/kg engine.

---

## 7. Gemini — where it is used today

| Location | Role |
|----------|------|
| `lib/agents/contentArchitect.ts` | **Content Architect** — maps card inputs to headline / insight / action / `suppliedBy` (uses `GEMINI_API_KEY`). |
| `app/api/zone/content-architect/route.ts` | HTTP entry; batch generation; optional DuckDuckGo HTML scrape for offer URL fallback; may trigger `scrape-sync` for postcode. |
| `app/api/zai/route.ts` | Ask Zai chat + tools; Gemini primary when key present. |
| `app/api/admin/pulse/route.ts` | Health ping (`gemini-2.5-flash-lite`). |
| Research / answers paths | See Firecrawl section — Gemini often paired in hybrid modes in `lib/agents/researcher.ts` / `app/api/answers/route.ts` (e.g. `hybrid_firecrawl_gemini`). |

**Env:** `GEMINI_API_KEY` (required for live calls).

---

## 8. Firecrawl — where it is used today

| Location | Role |
|----------|------|
| `lib/agents/researchAgent.ts` | `scrapeWithFirecrawlUrl`, `UK_2026_SEED_URLS`; ZeroResearch when no OpenClaw gateway. |
| `app/api/scrape-sync/route.ts` | GET/POST dashboard scrape data; optional `runZeroResearchWithProfile` with `persistToNeon`. |
| `app/api/admin/pulse/route.ts` | Connectivity probe to `api.firecrawl.dev/v1/scrape`. |
| `app/api/answers/route.ts` | Hybrid live zone tip path when keys allow (`FIRECRAWL_API_KEY`). |
| Sentinel / Zai | `firecrawl_grant` style payloads surfaced in Zone for home support messaging (`useSentinel`, `app/api/zai/route.ts`). |

**Env:** `FIRECRAWL_API_KEY`.

---

## 9. What to do to connect Gemini + Firecrawl for *stronger* per-user Zone cards

**Already connected (baseline):**

1. Set **`GEMINI_API_KEY`** and **`FIRECRAWL_API_KEY`** in `.env.local` / Vercel.
2. Ensure **`DATABASE_URL`** (Neon) for research persistence and unit rates where used.
3. Zone page already calls **Content Architect** after the deterministic view model is built — personalisation there is **copy-layer** on top of existing £/kg + profile + answers in the payload.

**Gaps / next work (not exhaustive):**

| Gap | Why it matters |
|-----|----------------|
| **No automatic “full genome → scrape all journeys” on every profile change** | Scraped overlay is optional; `/api/scrape-sync` and research runs are rate-limited and often postcode-driven. Deeper per-card URLs may not refresh until triggered. |
| **Content Architect is async and cached** | Fingerprinting in `architectCacheFingerprint` — stale cache can hide updated answers unless invalidated. |
| **OpenClaw gateway** | `OPENCLAW_GATEWAY_URL` + `OPENCLAW_GATEWAY_TOKEN` change research path vs raw Firecrawl seeds — document which environment you use. |
| **Hermes / push notifications** | No in-app wiring; “personalised nudge” flows would be new. |
| **Oracle MCP** | Not in request path for Zone; ops/monitoring only unless you build a bridge. |
| **Locked vs canonical journey questions** | Risk of confusion if any UI still reads `lockedQuestions.ts` for the same user flows — align or delete duplicate. |
| **Per-user scheduling** | No standing cron per user in-repo that says “nightly Firecrawl + Gemini for this postcode” — you’d add a worker or Vercel Cron hitting secured routes with user cohorts. |

**Practical checklist for “more personalised” Zone:**

1. Pass **richer `buildContentArchitectCardPayload`** (already includes journey answers, locality, rates when present) — verify each field is populated from `AppContext` before POST.
2. Trigger **`GET /api/scrape-sync?postcode=…&home_type=…&transport=…&household=…`** after profile save or Zone mount (already partially used from content-architect fallback).
3. Ensure **`runZeroResearchWithProfile`** persistence (`research_results` / related tables) matches your Neon schema — use `npm run db:columns` or migration docs if columns drift.
4. Add **cache bust** when `journey_*_answers` or profile changes (sessionStorage keys used by Content Architect cache in zone page — review `architectCacheFingerprint` usage in `app/zone/page.tsx`).

---

## 10. Quick file map

| Concern | File(s) |
|---------|---------|
| Onboarding questions | `app/profile/ProfilePageClient.tsx` |
| Journey definitions | `lib/journeys.ts` |
| Locked copy (secondary) | `lib/journeys/lockedQuestions.ts` |
| Next question | `lib/zone/questionHandler.ts` |
| Zone view model | `lib/zone/buildZoneViewModel.ts`, `lib/logic/zone.ts` (re-export) |
| Zone page orchestration | `app/zone/page.tsx` |
| Expanded journey | `app/components/JourneyBentoCard.tsx`, `EmbeddedJourneyQuestion.tsx` |
| Expanded tips | `app/components/SoloFocusOverlay.tsx` |
| Gemini architect | `lib/agents/contentArchitect.ts`, `app/api/zone/content-architect/route.ts` |
| Firecrawl research | `lib/agents/researchAgent.ts`, `app/api/scrape-sync/route.ts` |
| Summary narrative | `app/profile/summary/page.tsx` + `lib/brains/summaryLogic.ts` (not expanded line-by-line here; follows same profile + answers) |

---

*Generated as a codebase reference. Update this file when `PROFILE_QUESTIONS`, `JOURNEYS`, or Zone orchestration changes.*

---

## Appendix — DB-first loop (May 2026)

See **`docs/LIVE-INTEGRATIONS.md`** for: `research_results.user_id`, client hydrate from `GET /api/answers`, cron URL for Hermes/VPS, `CRON_SECRET`, and deploy checklist.
