# Zero Zero — Project Specification (v42.5 Current Baseline)

**v42.0:** Added *Full Site Audit & Implementation Spec* covering profile/journey Q&A, question loop contracts, expanded-card behavior, API surface, environment keys, data provenance, CTA/link resolution, and design system tokens/effects.

**v42.5 — Routing hygiene, segment loading, Neon column check script (latest):**
- **`app/global-layout.tsx`:** Normalize pathname with **`normalizeAppPath`** (trailing slash) so `/profile/` matches **`/profile`** for viewport lock / pulse hide — avoids “stuck” shell classes when the router emits a trailing slash.
- **`app/loading.tsx`:** Renders a **transparent full-screen placeholder** (not `null`) so App Router streaming does not occasionally stall on an empty suspense boundary; still **no purple** flash.
- **CLI:** `npx tsx scripts/list-research-results-columns.ts` (requires **`DATABASE_URL`**) lists **`research_results`** columns — same pool as the app for quick Neon verification without MCP.

**v42.4 — Profile/summary viewport lock, route loading, Zone resolve, ops pulse:**
- **`/profile` onboarding + `/profile/summary`:** Use the same **fixed viewport** contract as intro/home (`fixedViewportStage` in `app/global-layout.tsx`): `html.zz-intro-document-lock`, app shell `zz-intro-stage-lock` (`100dvh`, overflow hidden). Onboarding `<main>` is **`100dvh`** with **`overflow: hidden`** (no page scroll). Summary: **no skip/close control**; layout **`100dvh`** + overflow hidden.
- **Route transitions:** Root **`app/loading.tsx`** is **transparent** (no full-screen purple “Zero Zero” interstitial). **`app/profile/page.tsx`** Suspense fallback is **`null`** (no purple flash while streaming).
- **Zone `/zone`:** **`vmResolved`** flips **`true`** as soon as the **sync** `buildZoneViewModel` runs (wall visible immediately). **`zoneRevealCount`** is **derived** from `vmResolved` × `displayItems.length` (no effect-delay blank grid). Async pulse refresh no longer gates resolve on “exactly 9 journeys + locality”.
- **Ops:** **`/admin/pulse`** (session or gateway bearer) + **`GET /api/admin/pulse`** — Neon SQL ping, Gemini ping, Firecrawl scrape ping + latency JSON.

**v42.3 — Intro viewport, Zone wall, Settings hero, integration map:**
- **Intro `/` + `/intro`:** Document scroll is locked to the viewport: global `body` padding (20px / 40px desktop in `globals.css`) stack above `min-height: 100vh` and produced a vertical scrollbar. Intro routes add `html.zz-intro-document-lock` (overflow hidden, body padding 0) and `zz-intro-stage-lock` on the app shell (`height: 100dvh`, overflow hidden).
- **Zone `/zone`:** Card stagger/reveal (“one by one”) was removed — when `vmResolved`, all grid cells render immediately (`zoneRevealCount === displayItems.length`). Shell scrollbar styling remains via `html.zz-zone-document`.
- **Settings hero (`TOTAL ANNUAL` / £ + tCO₂):** Overview hero card uses **30px** inset (`padding-bento` lock); desktop horizontal gutter uses **30px** body padding when `.settings-page` is present (`body:has(.settings-page)`). Impact grid columns use `min-width: 0` to stop metric overflow.
- **Hermes / Oracle:** There are **no** separate services named Hermes or Oracle in this repository. External intelligence is routed through the integrations below (Gemini → generation/architect; Neon → Postgres/SQL; Firecrawl → scrape; Postcodes.io-style resolution via `/api/local-intelligence`).

**v42.1-v42.2 UI/UX lock refinements:**
- Expanded Solo Focus wrappers are hard-locked transparent (no secondary translucent panel/tint behind content or masthead text).
- Loading gate (`.zz-route-gate-shutter`) no longer applies blur/tinted fill; Zone background remains visible during load.
- Expanded offer label placement is standardized to render directly under the main heading, with a strict 4px rhythm to body copy.
- Expanded headings use a fuller cap (12 words), while Zone teaser headings remain compact (8-word clipping/ellipsis behavior in the view-model path).
- Solo Focus CTA labels are simplified to one-word actions (`Claim`, `Buy`, `Compare`) for button legibility.
- Solo Focus circle buttons (close/CTA/utility) now use invert-on-hover + focus-visible contrast rings to guarantee rollover readability on yellow and pink surfaces.
- Zone loading behavior avoids repeated shutter flicker once resolved; the grid renders fully when the view model is ready (no sequential card reveal).

## Product Intent

- Zero Zero is a UK-localized savings/carbon action app with a kinetic Zone wall.
- Users answer profile + journey questions; app computes dynamic potential savings/carbon and routes each card to a live action path.
- The core UX contract is:
  - immediate local answer commit
  - rapid Zone re-render
  - grounded source citation
  - no dead-end CTA.

## Canonical Architecture

- Canonical Zone build path:
  - UI orchestrator: `app/zone/page.tsx`
  - deterministic builder: `lib/zone/buildZoneViewModel.ts`
  - import facade: `lib/logic/zone.ts`
- Primary interaction surfaces:
  - Zone grid (hero + journeys + tips)
  - Solo Focus mother/child rails
  - Profile summary handoff into Zone.

## Data Model and Runtime Inputs

- Zone view model is assembled from:
  - profile snapshot (`AppContext` + localStorage mirror)
  - journey answers (`journey_*_answers`)
  - DB-backed scraped overlays (`scraped_summary`)
  - local intelligence (`/api/local-intelligence`)
  - market pulse (`fetchLivingPulseSnapshot`)
  - injected discovery cards (`/api/zone/injections`)
  - architect prose enrichment (`/api/zone/content-architect`)
- Money/carbon card values are dynamic:
  - baseline market rates × genome modifier + impact floor logic.
- Hero totals are recalculated from dynamic journey/tip values, not static labels.

## v41.0-v41.8 Functional Contracts

### v41.0 Postcode + Offer Bridge

- Postcode source-of-truth is `profile_postcode` in localStorage (plus context fallbacks).
- Zone refreshes when postcode changes via:
  - polling
  - `storage` cross-tab events
  - unified profile memory event.
- CTA priority order:
  1. live/discovery claim URL
  2. explicit partner link
  3. contextual `/zai` deep-link.

### v41.1 Dynamic Math Injection

- Hardcoded card money/carbon placeholders removed from view model logic.
- Market context includes:
  - April 2026 cap
  - regional grid intensity
  - live postcode.
- Cards carry explicit state:
  - `ESTIMATED_AUDIT` when genome inputs are incomplete
  - `LIVE_AUDIT` when resolved.

### v41.2 Performance Auditor Editorial

- Architect prompt enforces:
  - no dev-speak
  - no list formatting
  - 3-paragraph editorial sandwich
  - compact numeric format (`£1.4k`, `0.3t`).

### v41.3 Recursive Genome Feedback Loop

- On child-answer tap:
  - localStorage updates immediately
  - unified memory persists immediately
  - answer committed event dispatches immediately
  - server answer sync occurs in parallel
  - Zone model refreshes without waiting for full backend pipeline.

### v41.4 Lead-Gen Bridge Activation

- RECLAIM/CLAIM links never intentionally terminate at generic homepage placeholders.
- Fallback is contextual Zai route when no high-quality external destination exists.

### v41.6 UI Cleanup + Verified Audit Logic

- Locality de-duplication:
  - locality appears in the audit header label only (no secondary locality line).
- Solo Focus card header label:
  - `ESTIMATED AUDIT`
  - or `VERIFIED AUDIT — [LOCALITY]` when verified.
- Summary entry now uses `SHIMMER_FOCUS` + `soloFocusSlamMotionProps` for continuity.
- Canonical source footer lock:
  - `Source: UK Government Data April 2026`.

### v41.8 Vertical Card Normalization

- Zone grid equal-height contract at tablet and above:
  - `grid-auto-rows: 1fr`
  - card wrappers and cards stretch to `height: 100%`.
- Card internals use column flex with growable headline block so metric stacks remain baseline-aligned.
- Gap/radius lock remains:
  - 20px grid spacing
  - 60px card radius.

## Motion and Layout Locks

- `SHIMMER_FOCUS`: 20px blur to sharp reveal.
- `soloFocusSlamMotionProps`: shutter-style slam on question/result transitions.
- Zone grid: equal-height rows (tablet+), 20px rhythm, 60px radius.
- Solo Focus expanded shells remain transparent containers with journey slab colors inside.

## Connection Points — APIs and External Services

| Role | Surface / library | Purpose |
|------|-------------------|---------|
| **App Router APIs** | `app/api/**` | Browser-facing JSON routes (health, answers, zone, sentinel, scrape-sync, session-state, summary, zai, geocode, likes, etc.). |
| **Postgres (Neon)** | `@neondatabase/serverless`, `pg`, `DATABASE_URL` | Persistent users, sessions, scraped summaries, research rows, journey answers sync — see `lib/db.ts`, `lib/db/neon.ts`. |
| **Google Gemini** | `@google/genai`, `@google/generative-ai`, `GEMINI_API_KEY` | Content architect, discovery, Zai prompts — agents under `lib/agents/`. |
| **Firecrawl** | `@mendable/firecrawl-js`, `FIRECRAWL_API_KEY` | Crawled grants/offers for sentinel and zone enrichment. |
| **Local intelligence** | `GET/POST /api/local-intelligence`, `lib/local/getLocalData.ts` | Council/region/grid context from postcode (UK). |
| **Vercel** | Deployment (Fluid Compute), env via dashboard/`vercel env` | Hosting; `NEXT_PUBLIC_*` for client hints. |
| **Auth/session** | `lib/auth.ts`, `POST /api/auth/*`, session cookie | Cookie-backed sessions; `/api/answers` and likes require session where enforced. |

There is **no** dedicated “Hermes” or “Oracle” package — if those names appear in planning docs, map them to **Gemini** (LLM) and **Neon** (database) respectively unless a new adapter is added.

## API Runtime Status Notes (Current)

- Health endpoints:
  - `/api/health` DB check and liveness mode (`?live=1`).
  - `/api/health/diagnostics` reports booleans for Neon/Gemini/Firecrawl availability.
- Local intelligence:
  - `/api/local-intelligence` works with rate limiting and postcode validation.
- Architect endpoint:
  - `/api/zone/content-architect` sanitizes and returns by-journey enrichment.
- Answers endpoint:
  - `/api/answers` requires auth and drives genome/discovery/totals updates.
- Known issue observed in runtime logs:
  - `research_results` schema mismatch (`elec_unit_rate_gbp_per_kwh` missing) can cause `persistResearchResult` failures during scrape/research flows.

## Environment Contract

- Required for full live behavior:
  - `DATABASE_URL`
  - `GEMINI_API_KEY`
  - `FIRECRAWL_API_KEY` (or OpenClaw gateway equivalents).
- Supported alternates:
  - `OPENCLAW_API_KEY`
  - `OPENCLAW_GATEWAY_TOKEN`.
- Optional:
  - `NEXT_PUBLIC_APP_URL` for server-side absolute self-calls.

## Functional Reference: Onboarding, Summary Totals, Zone Cards, Expanded Views, Links

This section is the **implementation-facing** map for questions, numbers, card population, Solo Focus structure, and where URLs come from. Canonical code paths are cited so the spec stays aligned with the repo.

### Profile onboarding (pre-Zone)

- **UI:** `app/profile/ProfilePageClient.tsx` — stepped flow with `PROFILE_QUESTIONS` and `localStorage` keys (`profile_name`, `profile_postcode`, `profile_household`, etc.).
- **Questions in order:**
  1. **name** — free text (`profile_name`).
  2. **postcode** — free text (`profile_postcode`); triggers `POST /api/local-intelligence` to resolve council/region/grid for display context.
  3. **livingSituation** — `ALONE` | `COUPLE` | `FAMILY` | `SHARED` → stored as `profile_household`.
  4. **homeType** — `FLAT` | `HOUSE` → `profile_home_type`.
  5. **transport** — `WALK` | `BIKE` | `PUBLIC` | `CAR` | `MIX` → `profile_transport`.
  6. **age** — `JUNIOR` | `MID` | `RETIRED` → `profile_age` (persona for tips bias elsewhere).
  7. **employmentStatus** — `EMPLOYED` | `SELF_EMPLOYED` | `UNEMPLOYED` → `profile_employment_status`.
  8. **goal** — maps to `profile_goal`: `money` (SAVE), `carbon` (REDUCE), or `balanced` (BOTH), with optional money/carbon weighting metadata on the option objects.
- **Server:** completing the flow calls `createUser` → `POST /api/user`, which creates the DB row and issues a session cookie.

### Journey questions (Solo Focus / genome)

- **Canonical definitions:** `lib/journeys.ts` — `JOURNEYS` holds each `JourneyId`’s `questions[]` (`id`, `label`, `type`: `options` | `number`, `options[]`, optional `repeatLabel`).
- **Locked copy variant (some flows):** `lib/journeys/lockedQuestions.ts` — parallel `JOURNEY_QUESTIONS` with shorter prompts; keep in sync conceptually with `JOURNEYS`.
- **Per-journey question IDs (high level):**
  - **home:** `energy_type`, `home_insulation_level`, `electricity_provider`, `gas_provider`, `monthly_cost`, `green_tariff`.
  - **travel:** `primary_transport`, `fuel_type`, `distance_amount`, `distance_period`.
  - **food:** `diet_type`, `food_waste`.
  - **shopping:** `buy_new`, `secondhand`, `monthly_spend`.
  - **money:** `biggest_cost`, `finances_tight`.
  - **carbon:** `tracking`, `priority`.
  - **tech:** `upgrade_often`, `device_count`.
  - **waste:** `recycle`, `compost`.
  - **holidays:** `fly_frequency`, `long_haul`.
- Answers are stored per journey in localStorage as `journey_{journeyId}_answers` (JSON object) and synced to the server when the user is authenticated (`/api/answers`).

### How the Profile Summary amounts are worked out

- **Single source of truth for £ and kg:** `buildUserImpact({ profile, journeyAnswers })` in `lib/brains/buildUserImpact.ts`.
  - Sums **per-journey** results from `lib/brains/calculations.ts` (`calculateHome`, `calculateTravel`, …), each annualised where inputs are monthly.
  - Optional **scraped overlay:** `applyScrapedOverlay` (≤20% delta) when `options.scraped` is passed.
  - Optional **live home unit rates** from research/Neon: `options.homeUnitRates`.
  - **UK 2026 money-lead defaults:** if a journey would show zero after calculation, `UK_2026_MONEY_LEAD` fills sensible non-zero money/carbon so cards are never empty.
  - **Employment modifier:** `applyEmploymentFinancialPhysics` adjusts per journey after base calculation.
  - **Totals:** `totals.totalMoney` and `totals.totalCarbon` are **rounded** sums across all nine journeys.
- **Profile Summary page display math** (`app/profile/summary/page.tsx`):
  - `annualSpendLikeYou = max(BASELINE_2026_CAP_GBP, impact.totals.totalMoney)` with `BASELINE_2026_CAP_GBP = 1641`.
  - **Waste / “leak” style figures** shown in the kinetic summary: `annualWasteCash = round(annualSpendLikeYou * 0.22)`, `annualWasteCarbon = round(impact.totals.totalCarbon * 0.22)`.
  - **Local narrative:** `POST /api/local-intelligence` enriches copy via `lib/brains/summaryLogic.ts` (`buildSummaryKineticWords`, `resolveSummaryAreaLabel`, grid intensity line, employment-led beats).
- **Separate helper (not always the same as the page’s 22% display):** `getSummaryWaste(profile, employment)` in `buildUserImpact.ts` — seed-style “extra vs optimised home” heuristic for other consumers; do not confuse with the summary page’s cap-baseline + 22% formula above.
- **Post-summary behaviour:** the summary route clears **all** `journey_*_answers` from localStorage and refreshes profile before animating into Zone (fresh journey loop handoff).

### How Zone cards are populated

- **Entry:** `app/zone/page.tsx` loads profile + journey answers + scraped/injection context, then calls `buildZoneViewModel` (re-exported from `lib/logic/zone.ts`, implemented in `lib/zone/buildZoneViewModel.ts`).
- **Money and carbon on every card:** come **only** from `buildUserImpact` outputs (hero, nine journey cards, three tip slots). `buildZoneViewModel` does not invent new totals; it formats and labels.
- **Hero:** aggregates journey/general-card narrative, market context (April cap, regional grid, postcode), optional research meta (`deep_link`, `verified_saving`, `locality_context`), and audit state (`LIVE_AUDIT` vs `ESTIMATED_AUDIT`).
- **Journey rows:** titles can be **profile-driven** (e.g. flat vs house, renter, goal, employment) via `profileDrivenJourneyTitle`; headlines use `buildCompactHeadline` / leak framing. Scraped rows can set `insightLabel`, `insightAlert`, `fromScraper`, `localCouncilTip`, `claimOfferUrl`, `isPriorityAlert`.
- **Tips (three compact cards):** static tips are generated from the same impact pipeline, then **merged with injected discovery cards** via `mergeDiscoveryInjectionsIntoTips` — injected tips (IDs like `inject-*`) can replace same-journey tips; sorting can favour money or carbon by `profile.goal`; result capped to three tips.
- **Injections / live tips sources:**
  - `GET/POST /api/zone/injections` — discovery birth + stored injection store; can refresh via `tips-refresh` internally.
  - `POST /api/zone/tips-refresh` — regenerates tip deck (Gemini-backed pipeline when configured).
  - `POST /api/zone/tips-inject` — authenticated gateway inject into persist store.
  - Client heartbeat / discovery pulse (`lib/agents/heartbeat`, `DISCOVERY_INJECT_EVENT`) can append cards without a full page reload.
- **Content Architect:** client builds payloads with `buildContentArchitectCardPayload` → `POST /api/zone/content-architect` → `applyArchitectEnrichment` merges Gemini prose (`architectActionLine`, `architectSuppliedBy`) onto view-model rows.
- **ROCK habits:** liked catalog habits can occupy a tip slot (`lib/rock/habitsCatalog`, rotation helpers) — parallel path to static/injected tips.
- **Remote behavioural tips:** `buildRemoteBehavioralZoneTips` can supply additional tip-shaped cards from regional/remote logic.

### Expanded view (Solo Focus) — content structure

- **Grid card expand:** `app/components/JourneyBentoCard.tsx` opens the expanded shell (portal + motion). **Floating overlay:** `app/components/SoloFocusOverlay.tsx` uses the same content template (“kinetic grid” / mother–child rails).
- **Typical expanded stack (content-wise):**
  1. **Toolbar / back** — exit expanded, restore grid.
  2. **Mother column** — `MotherCardRenderer`: headline, formatted SAVE + CARBON (`StampedMoneyGbp` / `StampedCarbonKg`), auditor-style body copy (price cap references, locality), optional **VERIFIED** vs **ESTIMATED** labelling, source line (`formatVerifiedCitation` → “Source: UK Government Data April 2026”).
  3. **Pulse / diagnostics sync** — `PulseExpandedSync` when diagnostic provider/url exist.
  4. **Trinity → question loop** — `EmbeddedJourneyQuestion` drives the next question from `lib/zone/questionHandler` (`getNextQuestion`); answers commit through the same journey storage + `/api/answers` when logged in.
  5. **Morph / discovery handoff** — `getNextMorphCard`, sentinel mother refresh payloads, snapshot hydration (`lib/soloFocusSessionSnapshot`) so reload preserves rail state.
  6. **CTA row** — revenue-aware button labels (`inferRevenueCtaKind`, `resolveRevenueCtaLabel`) and resolved URLs (below).
- **Auditor narrative paragraphs:** built in `lib/zone/auditorNarrative.ts` and fed from zone/hero context where applicable.
- **Ask Zai from expanded:** `buildSoloFocusAskZaiQuestion` / `setAskZaiContext` in `lib/expandStorage.ts` prepares deep-link context for `/zai`.

### Where links come from (functionality)

- **Per-journey default sources (labels + URLs for copy):** `lib/content/sources.ts` — `getJourneySource`, `formatSourceLabel` (e.g. gov.uk, WRAP, DEFRA factors).
- **Verified revenue / partner fallbacks:** `lib/zone/verifiedRevenue.ts` — `PARTNER_URLS` (EST, GOV.UK ECO, Warm Home Discount, Ofgem cap, TfL ULEZ, Currys search, etc.); `pickFirstHttpUrl` prefers non-generic homepages; `resolvePartnerLink` chooses **learn** vs **grant** vs **switch** vs **reclaim** paths from `actionType`, `needsSwitching`, `claimOfferUrl`, London postcode, journey, and card variant (`hero` | `journey` | `tip`).
- **Trusted journey URLs (Solo Focus safeguards):** `lib/zone/trustedJourneyUrls.ts` — `trustedUrlForJourney`, category normalisation.
- **Card-native URLs:** Zone view model sets `actions.learnUrl` / `actions.actionUrl`, optional `cta.url`, `claimOfferUrl`, `partner_link` — discovery and scraper pipelines are expected to populate real `http(s)` targets; resolver layers above prevent naked generic homepages where possible.
- **Zai deep link:** `buildZaiAuditDeepLink` in `buildZoneViewModel.ts` builds `/zai?context=manual_audit&…` when contextual chat is the best handoff.

## Guardrails Going Forward

- Keep Zone logic centralized in `lib/zone/buildZoneViewModel.ts`.
- Keep CTA precedence deterministic and deep-link-first.
- Keep fallback behavior explicit (never silent generic drift).
- Preserve canonical source footer contract and audit label contract.

## Full Site Audit & Implementation Spec (v42.0)

This section is the canonical technical audit for what the app does, where data comes from, how user answers move through the system, and how UI/UX contracts are implemented.

### What the app is doing end-to-end

- User enters via intro (`/` or `/intro`), chooses create profile or skip.
- Profile flow (`/profile`) captures household context and writes local state immediately.
- Summary (`/profile/summary`) computes personalised kinetic narrative from profile + answers.
- Zone (`/zone`) is the primary operating surface:
  - hero totals
  - 9 journey cards
  - 3 tip/discovery slots
  - Ask Zai entry.
- Expanded cards (Solo Focus) run a question -> answer -> result loop, then return to Zone with updated totals/content.
- Zai (`/zai`) handles contextual assistant chat and discovery-win generation mode.

### Profile: full questions, answers, storage keys, and flow

Canonical file: `app/profile/ProfilePageClient.tsx`.

- Question order and local keys:
  1. `name` (input) -> `profile_name`
  2. `postcode` (input) -> `profile_postcode`
  3. `livingSituation`: `ALONE | COUPLE | FAMILY | SHARED` -> `profile_household`
  4. `homeType`: `FLAT | HOUSE` -> `profile_home_type`
  5. `transport`: `WALK | BIKE | PUBLIC | CAR | MIX` -> `profile_transport`
  6. `age`: `JUNIOR | MID | RETIRED` -> `profile_age`
  7. `employmentStatus`: `EMPLOYED | SELF_EMPLOYED | UNEMPLOYED` -> `profile_employment_status`
  8. `goal`: `money | carbon | balanced` (SAVE/REDUCE/BOTH) -> `profile_goal`
- Postcode step also calls `POST /api/local-intelligence` for council/region/local carbon context.
- Each step writes localStorage immediately and syncs unified profile memory (`lib/unifiedProfileMemory.ts`).
- Submit calls `POST /api/user` and then routes to `/profile/summary`.

### Journey questions and loop: full logic and answer flow

Canonical definitions:
- `lib/journeys.ts` (`JOURNEYS` per journey id)
- `lib/journeys/lockedQuestions.ts` (locked-copy variant)

Journey ids:
- `home`, `travel`, `food`, `shopping`, `money`, `carbon`, `tech`, `waste`, `holidays`

Per-journey answer storage:
- localStorage key format: `journey_{journeyId}_answers` (JSON object)

Question loop implementation:
- `app/components/EmbeddedJourneyQuestion.tsx`
- next-question logic: `lib/zone/questionHandler.ts`

On answer tap:
- Writes answer to localStorage immediately.
- Dispatches local/profile/session sync events.
- Calls `POST /api/answers` with `journey_key`, `question_id`, `answer_value` (auth path).
- Calls `POST /api/zone/generate-next` in parallel to maintain responsive morph/discovery behavior.
- Updates hero totals and expanded result content without waiting for slow external paths.

Loop/session keys:
- `zz_sf_view_{laneOrCard}` (QUESTION/RESULT view state)
- `zz_sf_lane_{laneOrJourney}`
- `zz_sf_q_{laneOrJourney}` (question count)

Per-session loop cap:
- `SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION` in `lib/animations.ts` (currently 3).

### Expanded cards (Solo Focus): behavior and button actions

Entry surfaces:
- Journey expansion: `app/components/JourneyBentoCard.tsx`
- Tip/discovery expansion: `app/components/SoloFocusOverlay.tsx`

Shared content logic includes:
- Mother card narrative and metrics (`MotherCardRenderer`)
- Trinity answer circles / embedded question loop (`EmbeddedJourneyQuestion`)
- Diagnostics/attribution footers (`PulseExpandedSync`, source footer, optional price cap footer)
- Morph/discovery handoff (`getNextMorphCard`, session snapshots, injected cards)

Buttons and where they go:
- Close button: returns to Zone and clears transient expanded state.
- Like button: toggles like via `/api/likes`.
- Primary action button:
  - label resolved by revenue/action-type helpers (`inferRevenueCtaKind`, `resolveRevenueCtaLabel`)
  - URL resolved from claim/deep-link/source/partner stacks (see CTA resolution below)
  - falls back to contextual `/zai` deep-link when no high-quality external URL exists.
- Ask Zai button:
  - writes contextual payload to session (`zz_ask_zai_context`)
  - navigates to `/zai`.

### Data provenance: where every key output comes from

Economic and carbon truth:
- `lib/brains/buildUserImpact.ts` is the main annualised money/carbon computation pipeline.
- Per-journey calculation functions live in `lib/brains/calculations.ts`.
- Engine-level wrappers and tier logic live in `lib/logic/engine.ts`.

Zone model assembly:
- `lib/zone/buildZoneViewModel.ts` (re-exported by `lib/logic/zone.ts`) builds hero/journey/tip rows from:
  - profile snapshot
  - journey answers
  - local intelligence (`/api/local-intelligence`)
  - market pulse/live rates (`lib/logic/pulse.ts`)
  - scraped/research overlays
  - discovery injections (`/api/zone/injections`)
  - optional architect enrichment (`/api/zone/content-architect`)

Summary numbers/text:
- `app/profile/summary/page.tsx` uses `buildUserImpact` + summary logic helpers in `lib/brains/summaryLogic.ts`.
- Summary handoff clears all `journey_*_answers` before Zone entry.

Source text/citations:
- journey source labels/URLs: `lib/content/sources.ts`
- verified source and partner resolution helpers: `lib/zone/verifiedRevenue.ts`
- auditor narrative generation: `lib/zone/auditorNarrative.ts`

### CTA and link resolution: full chain

Canonical path:
- Primary resolver: `lib/zone/verifiedRevenue.ts` (`resolvePartnerLink`, `pickFirstHttpUrl`, partner map)
- Trusted fallback URLs: `lib/zone/trustedJourneyUrls.ts`
- Zone model and expanded views consume:
  - `claimOfferUrl`
  - `actions.learnUrl` / `actions.actionUrl`
  - `cta.url`
  - `partner_link`
  - card/source citation URLs.

Precedence contract:
1. live or discovery claim URL / explicit action URL
2. vetted partner/source URL
3. trusted journey fallback URL
4. contextual `/zai` deep-link.

### API surface: routes, auth, and functional role

Auth/session:
- `/api/auth/signup` (POST): create account + session cookie
- `/api/auth/login` (POST): login + session cookie
- `/api/auth/me` (GET): current user
- `/api/auth/logout` (POST): clear session

Profile/session state:
- `/api/user` (POST): profile user creation + session bootstrap
- `/api/session-state` (GET/POST): guest/session mirror for profile/journey state
- `/api/reset` (POST): reset current user data

Answers/cards/summary:
- `/api/answers` (GET/POST): answer persistence, totals recompute, discovery/morph payloads
- `/api/journey` (POST): journey state updates
- `/api/cards` (GET): cards list/filter
- `/api/summary` (GET): profile summary totals

Zone/discovery/agents:
- `/api/zone/content-architect` (POST): prose/link enrichment
- `/api/zone/tips-refresh` (POST): regenerate tips
- `/api/zone/tips-inject` (POST): gateway-auth tip injection
- `/api/zone/injections` (GET/POST): read/create injection cards
- `/api/zone/generate-next` (POST): generate next morph cards
- `/api/discovery/pulse` (POST): re-patch discovery card values
- `/api/sentinel` (POST): sentinel refresh/sync
- `/api/agents/pulse` (GET/POST): pulse automation path
- `/api/brain` (POST): brain orchestration endpoint

Local intelligence and location:
- `/api/local-intelligence` (GET/POST): postcode -> region/council/local carbon
- `/api/local-offers` (GET): locality-specific offer cards
- `/api/geocode` (GET): reverse geocode helpers

Research/health/ops:
- `/api/scrape-sync` (GET/POST): scrape ingest/research sync
- `/api/health` (GET): runtime/db health
- `/api/health/diagnostics` (GET): dependency/diagnostic flags (session or gateway bearer)
- `/api/admin/pulse` (GET): live Neon + Gemini + Firecrawl probes + latency (session or same bearer tokens as diagnostics)
- `/api/memory/flush` (POST): memory bridge flush

Engagement/analytics:
- `/api/zai` (POST): assistant response + discovery mode
- `/api/likes` (GET/POST): liked cards
- `/api/actioned` (GET/POST): actioned cards
- `/api/analytics` (POST) and `/api/analytics/click` (POST): event tracking
- `/api/profile/mobile` (POST): UK/international mobile on `users.mobile` (Rock strip; guests OK — localStorage `zz_profile_mobile`; outbound Telegram/Hermes not wired in-repo)

Activity visibility controls:
- `/api/sso/activity/[activityId]/visibility/archive` (POST)
- `/api/sso/activity/[activityId]/visibility/activate` (POST)
- `/api/sso/activity/[activityId]/visibility/chronicle-hide` (POST)
- `/api/sso/activity/[activityId]/delete` (POST)

### Environment keys and runtime dependencies

Core runtime:
- `DATABASE_URL`
- `GEMINI_API_KEY`
- `FIRECRAWL_API_KEY`
- `OPENCLAW_API_KEY`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_GATEWAY_WS_URL`
- `GATEWAY_TOKEN`
- `CRON_SECRET`
- `SCRAPER_SECRET`
- `REVERSE_GEOCODING_API`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `VERCEL_ENV`
- `VERCEL_URL`
- `NODE_ENV`

Public/client flags used in UI paths:
- `NEXT_PUBLIC_JAM_SESSION_URL`
- `NEXT_PUBLIC_INSTAGRAM_URL`
- `NEXT_PUBLIC_PULSE_WIDGET`
- `NEXT_PUBLIC_DATA_VERSION`
- `NEXT_PUBLIC_VERCEL_ENV`

### Design system audit: colours, typography, effects, and motion

Primary token files:
- `app/globals.css`
- `lib/animations.ts`
- `lib/journeyColors.ts`
- `.cursor/rules/mechanical-pulse.mdc`

Core colours:
- Yellow: `#FDFD00`
- Pink: `#E80DAD`
- Purple: `#7800ce`
- Journey and expanded-tone helpers are mapped in `lib/journeyColors.ts` (`getJourneyColorHex`, `getExpandedAccentHex`, CTA color helpers).

Typography:
- Marvin Visions Bold for headings/data labels.
- Roboto (bold-heavy usage) for body and one-word controls.

Shape/layout locks:
- 60px card/pill radius in grid surfaces.
- Solo Focus expanded shell uses 0px outer chrome radius with journey-tone internals.
- No decorative box-shadow/text-shadow per mechanical pulse lock.

Motion/effects:
- Shimmer/lens-focus motion tokens (`SHIMMER_FOCUS_*`) and intro CTA spring presets in `lib/animations.ts`.
- Slam/bloom/tap families used across intro, summary, zone, and expanded transitions.
- Solo Focus zip/shut and question/result springs are centralized in animation exports and CSS hooks.

### Full local/session key inventory used by flow logic

localStorage (core examples):
- Profile: `profile_name`, `profile_postcode`, `profile_household`, `profile_home_type`, `profile_transport`, `profile_age`, `profile_employment_status`, `profile_goal`
- Answers: `journey_{journeyId}_answers`
- Session/profile mirrors: `userId`, `user_id`, `user_profile`, `zz_user_profile_memory_v1`
- Context caches: `heroTotals`, `zz_location_state_v1`, `completedJourneys`

sessionStorage (core examples):
- Summary handoff: `zz_summary_to_zone`
- Expanded loop: `zz_sf_view_*`, `zz_sf_lane_*`, `zz_sf_q_*`
- Ask context: `zz_ask_zai_context`
- Expansion context: `zz_expand_card`, `zz_expand_from`

### Infrastructure verification (Neon, keys, optional MCP)

- **Neon / `research_results`:** Load **`DATABASE_URL`** from **`.env.local`**, then run **`npm run db:columns`** (wraps `tsx scripts/list-research-results-columns.ts`). Confirms the pool matches production column layout without opening the Neon console.
- **App keys:** **`GEMINI_API_KEY`** and **`FIRECRAWL_API_KEY`** remain env-driven for agents and `/api` routes; pulse/admin diagnostics read the same vars where configured.
- **Cursor MCP:** Enable the Neon Postgres MCP in Cursor settings if you want SQL from chat (workspace ships **`plugin-neon-postgres-neon`** descriptors). Firecrawl and Gemini are **not** guaranteed to be bundled as MCP servers — keep using env vars and HTTP APIs unless you add third-party MCP plugins.
- **Oracle Cloud monitoring (`zerozero-auditor`, London):** Install client tooling locally (e.g. **`npx -y @oracle/mcp`**) and register an MCP server in Cursor that points at **`~/.oci/config`**. That wiring is **host-specific** and cannot be committed from the repo alone.

