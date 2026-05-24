# Zero Zero (00-00) — Handbook

Single reference for product intent, user flow, architecture, integrations, motion pointers, and security. This file is [HANDBOOK.md](HANDBOOK.md) in the repo. Implementation detail lives in code (`lib/`, `app/`); **verify animation timings in `lib/animations.ts`**.

**Repo entry:** root **[README.md](../README.md)** · all product docs under **`docs/`**.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # DATABASE_URL, GEMINI_API_KEY, etc. — never commit .env.local
npm run init-db              # lib/schema.sql + research_snapshot migration (loads .env.local)
npm run dev                  # http://127.0.0.1:3000 (see package.json for :3030 / :3001 variants)
```

**Canonical Git remote:** `https://github.com/00app/00-ULM.git` — push `main` here; Vercel Git integration (if enabled) builds on push. **GitHub Actions:** `.github/workflows/ci.yml` runs **lint** + **typecheck** on push/PR (backup to Vercel native checks). Production pipeline is **Vercel build + deploy** (`npm run deploy` / dashboard).

**Neon empty branch / “No roles available”:** In [Neon Console](https://console.neon.tech) → your project → ensure **Roles** exist (create `neondb_owner` or reset password). Paste the **pooler** connection string into `DATABASE_URL`, then run `npm run init-db` again. If auth fails, paste a **fresh** URI from **Connection details** (passwords rotate when reset).

**`.env.local` vs shell:** `npm run init-db`, `npm run db:test`, and `npm run db:log-research` load `.env.local` with **`preferLocal: true`** (`scripts/load-env-local.ts`) so values in the file **override** a stale exported `DATABASE_URL`. Still **save** `.env.local` to disk after edits — the terminal reads the file, not an unsaved editor buffer.

**Build:** `npm run build` (runs **`verify`** = `typecheck` + `lint:ci` before Next build) · **Typecheck:** `npm run check` / `npm run typecheck` · **Lint:** `npm run lint` · **Prep:** `npm run prep:live` · **Deploy:** `npm run deploy` or `npm run deploy:force` (`scripts/deploy-production.sh` → `vercel deploy --prod`). Production: **`https://00-ulm.vercel.app`**.

**Dev / test / audit runbook:** [DEV-TEST-AUDIT.md](DEV-TEST-AUDIT.md) (SQL + Hermes + clean build + local smoke).

**Wake stack (Mac):** `npm run db:test` (Neon) · `npm run hermes:ping` (Vercel auth) · `BASE_URL=https://00-ulm.vercel.app bash scripts/verify-env-and-health.sh` · `npm run hermes:pulse` (full cron smoke, `limit=1`). **VPS Hermes:** `bash scripts/deploy-hermes-to-vps.sh` — see [HERMES-VPS-SETUP.md](HERMES-VPS-SETUP.md).

**Full application specification (architecture, APIs, DB, Hermes, mother/child cards):** [FULL-APP-SPEC.md](FULL-APP-SPEC.md).

**Technical deep-dive (profile, 12×3 questions, answers API, mechanical truth):** [PROFILE-ANSWERS-ZONE-TECH.md](PROFILE-ANSWERS-ZONE-TECH.md).

**Zone content & data (scrape, copy, cards, Solo Focus, tone):** [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md).

### Documentation index

All paths relative to **`docs/`** unless noted.

| Doc | Topic |
|-----|--------|
| **`HANDBOOK.md`** (this file) | Index, quick start, ops, repo map |
| **`ZONE-CONTENT-AND-DATA.md`** | Scrape triggers, Neon fields, £/kg vs copy, bento + expanded presentation, Architect / True Tip / Zai voice, offer URLs |
| **`PROFILE-ANSWERS-ZONE-TECH.md`** | 12×3 questions, profile flow, mechanical truth, scrape-sync pending |
| **`ZAI-AND-QUESTIONS-RULES.md`** | Boundaries, visit rules, full question registry, integrated flow |
| **`HYBRID-DATA-PIPELINE.md`** | Tier A–D cost map (free vs premium APIs) |
| **`ULM-APPLICATION-LOOP.md`** | Ceilings, spawn, headline limits, credit guardrails |
| **`INTELLIGENCE-LOOP-MANIFEST.md`** | Hermes, Firecrawl, Gemini persist, verification curls |
| **`FULL-APP-SPEC.md`** | Architecture, APIs, DB, mother/child cards |
| **`DEPLOY-VERCEL.md`** | Checks Failed / Staged, promote, Node 24 |
| **`DEV-TEST-AUDIT.md`** | Local smoke, SQL, Hermes, clean build |
| **`HERMES-VPS-SETUP.md`** | Oracle VPS cron |
| **`HERMES-ULM-JIT-BRIEF.md`** | JIT scrape vs Hermes scope |
| **`SENTINEL.md`** | Live-Impact, home deck, `inject-sentinel-*` tips, `POST /api/sentinel` |
| **`SUPPLEMENTAL-SYSTEMS.md`** | Gary mode, pattern shift, rebirth vault, research path matrix |

**DB init:** `npm run init-db` applies **`lib/schema.sql`** then runs **`db/migrations/20260513_research_snapshot_column.sql`** as a single batch (legacy JSONB column → **`research_snapshot`** merge/rename). Files under `db/migrations/` are otherwise for Neon SQL editor / manual history unless wired here.

**Typecheck:** `npm run check` · **Vulnerabilities:** `npm run audit` · **E2E:** `npm run test:e2e`

---

## What the app is

UK-first web app: **postcode** and **profile** drive local context; **Zone** shows a bento wall (hero, journeys, tips); **Solo Focus** expands one card into a **question → answer → result** loop; **Zai** (`/zai`) is the chat assistant. Goals: immediate answer commit, fast Zone refresh, grounded citations, actionable CTAs.

**Canonical Zone path:** `app/zone/page.tsx` → `lib/zone/buildZoneViewModel.ts` (logic facade: `lib/logic/zone.ts`). **Content & data spec:** [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md). **Design lock:** `.cursor/rules/mechanical-pulse.mdc` + `lib/journeyColors.ts`.

---

## User flow

| Step | Route | Notes |
|------|--------|--------|
| Intro | `/`, `/intro` | **Style A glitch logo** (`GlitchLogo` / `.app-boot-glitch`) → `IntroWordCycle` (SAVE → MONEY → …) → **CREATE** (`/profile`) only (no SKIP CTA). `?skip=1` / `?step=message` still skips logo via URL. |
| Profile | `/profile` | Stepped onboarding (`ProfilePageClient`). **Full-sentence fade:** each step’s heading is **one block** (soft **y: 10→0** + opacity, `STACCATO_TWEEN`) — **not** word-by-word. Postcode → `POST /api/local-intelligence`. |
| Summary | `/profile/summary` | **`SummaryHeader`** → **`IntroWordCycle`** with **`opacityTicker`**: **one word on screen at a time**, opacity **0→1** only (Mechanical Snap ticker — **no** Style A glitch). Words from **`buildSummaryStaccatoWords`**; locality wrap via **`formatSummaryLocalityKineticToken`** + **`fitToViewportPaddingPx`**. Dwell/gap: **`SUMMARY_KINETIC_WORD_*`** in `lib/animations.ts`. Then Zone. **`lib/brains/summaryLogic.ts`**. |
| Zone | `/zone` | **Ask Zai** pill (anchor) → inline **`GlitchLogo`** loader under pill until first card ready (`revealedCardCount ≥ 1`); bento wall hidden until then, then **staggered** card reveal (`ZONE_GRID_STAGGER_CHILD_DELAY_SEC`). Summary handoff: architectural pulse → punch when `isZoneReady`. **`GET /api/scrape-sync`** hydrates (`vmResolved`). **Mechanical truth:** no fake £ when Neon empty — § below. Style B: **`STACCATO_*`** (`app/zone/page.tsx`). **`ZoneCard`** = `JourneyBentoCard`. |
| Solo Focus | (overlay) | **`JourneyBentoCard`** (QUESTION/RESULT chamber; inject tips use **`SoloFocusOverlay`**). Expanded **Marvin H3** architect headline (6–12 words). **Ask Zai** Trinity → **`AskZaiDeepDiveSheet`**; **Continue in Zai** → **`setAskZaiContext`** + `/zai`. MC answer → **`POST /api/answers`** → RESULT; **grid birth** after close → loop → **`DiscoveryTakeover`** → **`injectNewDiscoveryCard`**. **Tier 2:** **`runTier2MotherChildSwap`**. Zip-shut → fade-open loop question. |
| Other | `/zai`, `/likes`, `/settings` | Chat (consumes ask-handoff context), saved cards, reset/session. **`AppFloatingNav`** on Zone, Likes, Zai, Settings — **40×40px** circles, portaled pink bar; `ROUTES` (`likes`, `chat` → `/zai`, `summary` → `/settings`). |

No `/journeys` or `/expand/*` product routes — journeys live on Zone.

---

## Journey questions (“the loop”)

- **Definitions:** `lib/journeys.ts` — **13 domains**, **3 questions each** (`JOURNEY_ORDER`: `home`, `utilities`, `grants`, `solar`, `travel`, `holidays`, `food`, `shopping`, `money`, `tech`, `water`, `waste`, `carbon`). Profile leading question **`home_power`** (GAS / ELECTRIC / MIX / OTHER) seeds utilities + `home.energy_type`. Question labels are behavioural only — **no £/kg in copy**.
- **Full question map:** [PROFILE-ANSWERS-ZONE-TECH.md](PROFILE-ANSWERS-ZONE-TECH.md) §1.
- **Next question:** `lib/zone/questionHandler.ts` — `getNextQuestion(journeyId, answers)` returns the first question with no (or empty) answer.
- **UI (Solo Focus):** `app/components/JourneyBentoCard.tsx` — one registry question per open (`getSoloFocusNextQuestion`); profile-style **`ProfileAnswerBtn`** + **`profile-question-headline`**. After MC answer → **RESULT**; after **close** → **`DiscoveryTakeover`** loop beat (fade-open, `ZIP_SHUTTER_SPRING`).
- **UI (`/profile` onboarding):** `ProfilePageClient.tsx` — **full-sentence** question copy per step (same fade contract as above).
- **Persist:** `POST /api/answers` — validates `isValidJourneyQuestion`, upserts `journey_answers_jsonb`, recomputes impact, discovery, optional research (`triggerSupplementalResearch`), Sentinel hooks, etc. **This is the canonical birth path** for discovery cards returned as `new_card_data` / `grid_pulse_card` in the JSON response → client **`injectNewDiscoveryCard`**.
- **Hydrate:** `GET /api/answers` — server answers merged on boot (`AppContext`) so Zone matches Neon.

---

## Mechanical truth (Zone £ / carbon)

The Zone wall must **not** show placeholder savings when Neon has no research stream.

| Layer | Behaviour |
|-------|-----------|
| **`uk2026Defaults`** | All `money_value` / `carbon_value` = **0**; leads = **Computing...** (shape only). |
| **`buildUserImpact`** | Does **not** back-fill from UK defaults when totals are 0. |
| **`mechanicalTruth.ts`** | `journeyHasStreamData` — true only when `research_results` / scraped row has £, prose, or tip. |
| **`buildZoneViewModel`** | Per-journey formula £ runs **only** if stream exists; else **COMPUTING — JOURNEY**, metrics **—**. |
| **`GET /api/scrape-sync`** | Postcode + empty DB → `{ scraped: [], source: "pending" }` (not fake £12k tiles). |
| **Fill screen** | `POST /api/scrape-sync?postcode=…&force=true`, cron `/api/cron/zone-research`, or answer-loop discovery after persist. |

After a clean DB, expect an **empty honest Zone** until pulse — then tiles populate from Neon. Details: [PROFILE-ANSWERS-ZONE-TECH.md](PROFILE-ANSWERS-ZONE-TECH.md).

---

## Enforced loop & credit boundaries

Locked product contract for **use less, more** (Ulm JIT) and multi-tester safety. Code: `lib/intelligence/scrapeBoundaries.ts`, `lib/intelligence/bucketFailover.ts`, `lib/zone/bootstrapZoneResearch.ts` (bootstrap disabled).

### Onboarding → true baseline

| Rule | Implementation |
|------|----------------|
| Profile questions feed **real £ / kg** | **`buildUserImpact`** (`lib/brains/buildUserImpact.ts`) on **`POST /api/answers`**, **`/api/summary`**, **`buildZoneViewModel`** |
| Postcode + locality | **`POST /api/local-intelligence`** (`ProfilePageClient`, intro) |
| Persist answers | **`journey_answers_jsonb`** via **`POST /api/answers`** |
| Summary motion | Full-sentence fade (`STACCATO_TWEEN`); **`IntroWordCycle`** + **`opacityTicker`** on `/profile/summary` (one word at a time, no glitch) |
| Tile headlines before scrape | **Mechanical truth** still applies per journey until Neon stream exists → **`COMPUTING — JOURNEY`**, metrics **`—`** (`lib/zone/mechanicalTruth.ts`) |

### Zone grid (12 domains)

| Rule | Implementation |
|------|----------------|
| **13 domains** | **`JOURNEY_ORDER`** in `lib/journeys.ts` — `home`, `utilities`, `grants`, `solar`, `travel`, `holidays`, `food`, `shopping`, `money`, `tech`, `water`, `waste`, `carbon` |
| **One question per card** | **`getNextQuestion`** / **`getSoloFocusNextQuestion`** (`lib/zone/questionHandler.ts`) |
| **Visited lock** | **`visited_cards`** (localStorage) + **`isCardVisited`** → pink **`#FF00FF`** / yellow **`#FDFD00`** (`.zone-card--visited`); no re-scrape on re-open (`SoloFocusOverlay` **`cardVisitedLock`**) |
| **24-card ceiling** | *Design target* — enforce in `buildGroovyGridItems` when grid grows (hero + journeys + tips + discovery) |
| **No fake £ on empty Neon** | See **Mechanical truth** above |

### Saving tips & Rock rail

| Rule | Implementation |
|------|----------------|
| Tips styling | Deep navy + yellow on tip/rock surfaces (`lib/journeyColors.ts`, Rock + injection components) |
| Rail heading | **Today's Tips** (`RockSavingTips`) — habits rail separate from 12 journey bentos |
| Baseline ranked tips | VM expects **3** category tips (`buildZoneViewModel`); **Rock** habits are a separate rail (`RockSavingTips`) |
| Tip +1 earned scrape | **`runTipVerificationDeepScrape`** → scoped **`POST /api/scrape-sync`** with **`journey_key`** + repair pass |
| Close without re-burn | Visited tips: **`cardVisitedLock`** disables follow-up scrape; do not call broad cron/`?force=true` on close |

### Discovery birth (canonical path)

```
POST /api/answers → buildUserImpact + Neon JSONB
       → (optional) triggerSupplementalResearch / discovery race
       → new_card_data / grid_pulse_card → injectNewDiscoveryCard
       → ZIP_SHUTTER_SPRING → next single question (fade-open)
```

- **Caps:** **`MAX_DISCOVERY_INJECTIONS_PER_JOURNEY` = 3** (`lib/intelligence/manifest.ts`); **24** bento cells (`lib/zone/ulmLimits.ts`); Rock rail **6→12**; grid shows **1** earned discovery tip per category on wall (`perCategoryCardCap`).
- **Supplemental only:** **`POST /api/zone/injections`**, **`POST /api/research/question-card`** (not the MC answer-loop birth).

### API bucket failover (credit protection)

Set on **Vercel Production** (and `.env.local` for dev):

| Variable | Value |
|----------|--------|
| `MODEL_STRATEGY` | `bucket_failover` (must be exact — empty string disables bucket) |
| `MAX_ITERATIONS` | `5` |
| `GEMINI_*_MODEL` | `gemini-2.5-flash` |
| `GROQ_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY` | Optional fallbacks after Gemini quota errors |

**Blocked in bucket mode (unless `ALLOW_BROAD_SCRAPE=1`):** `GET /api/scrape-sync?force=true`, full multi-user **`/api/cron/zone-research`** batch (use **`?repair=1`** or **`/api/cron/repair-mechanical`**).

**Verify:**

```bash
export CRON_SECRET="$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)"
curl -sS -H "Authorization: Bearer ${CRON_SECRET}" \
  'https://00-ulm.vercel.app/api/health/diagnostics' | jq '.bucket_failover'
```

Expect **`enabled: true`**, **`broadScrapeAllowed: false`**, **`skipDeepGemini: true`**.

### Hermes (VPS)

Hermes only holds **`CRON_SECRET`** — not Groq/Mistral keys. **Recommended crontab:** Monday 05:00 UTC → **`repair-mechanical?limit=6`** (or `hermes-pulse.sh --repair-only`). Remove any daily **`hermes-pulse.sh`** line without repair. See [HERMES-VPS-SETUP.md](HERMES-VPS-SETUP.md).

### Multi-user testing

- Each tester: **own signup** / browser profile (do not share one demo UUID).
- Concurrent sessions: supported (serverless + per-route rate limits).
- **Neon tables:** keep all — storage is cheap; API calls cost credits.

---

## Data & view model

**Canonical content + presentation spec:** [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) (scrape → Neon → VM → bento / Solo Focus / Today's Tips, tone, URL guards).

Zone VM blends: **AppContext** + **localStorage** mirror, **journey answers**, **`GET /api/scrape-sync`** (`scraped_summary` + `research_category_coverage`), **`/api/local-intelligence`**, pulse snapshot, zone injections, content-architect prose. Cards use **`LIVE_AUDIT`** vs **`ESTIMATED_AUDIT`** when genome inputs are incomplete vs research-backed (`lib/zone/buildZoneViewModel.ts`). **`streamPending`** on journey cards drives the “Computing…” strip on the bento face.

**Postcode:** Source of truth includes `profile_postcode` in localStorage; Zone refreshes on change (polling, `storage` events, unified profile memory).

**Locality:** `GET /api/geocode/postcode?postcode=…` (server Nominatim proxy) → **`profile_locality_name`** in localStorage via **`lib/geocode/resolvePostcodeLocality.ts`**. Summary + Zone headers read cache; fallback = formatted postcode.

**Gary / demo identity:** Postcode **BN17** (or `zz_gary_mode=1`) pins research to UUID **`00000000-0000-4000-a000-000000000000`**. All scrape-sync GET/POST append **`user_id`** when active (`lib/zone/garyMode.ts`). Link DB rows: **`npx tsx scripts/link-gary-bn17-research.ts`** (uses `DATABASE_URL` only — never commit passwords).

---

## Neon hot path (what actually fills)

| Table | Role |
|-------|------|
| **`research_results`** | Per-category £, prose, `offer_url`, `architect_prose`, `user_id`, postcode |
| **`journey_answers`** + **`journey_answers_jsonb`** | Normalized MC answers (`upsertJourneyAnswerJsonb`) |
| **`user_profiles`** | Optional mirror of `journey_answers_jsonb` (Hermes / audit-complete) |
| **`scraped_summary`** | Legacy hero aggregates when populated |
| **`guest_sessions`** | Pre-login profile + answers by `zz_sid` cookie |

**`insightReady` (scrape-sync):** true when a category row has prose, headline, £, or offer URL — Zone hides “Computing…” once settled. **`GET ?repair=1`** backfills missing headlines/prose without a full `force` research run.

**Also required:** `discovery_injections`, `likes`, `journey_questions`, `journey_state`.

**Legacy (safe to drop after `npm run db:audit` shows 0 rows):** `card_views`, `micro_answers`, `zai_messages` — see `db/migrations/20260521_drop_legacy_unused_tables.sql`. **`cards`** + **`/api/cards`** have no UI callers; keep or drop later.

**Hermes:** VPS cron only HTTP-triggers **`/api/cron/zone-research`** (`repair=1`, weekly). Zai read-only and Deep Dive JIT scrape do **not** require a Hermes config change — see [HERMES-ULM-JIT-BRIEF.md](HERMES-ULM-JIT-BRIEF.md).

**Audit:** `npm run db:audit` · **Verify Zai tables:** `npm run db:verify-discovery`

**ULM loop (canonical spec):** [ULM-APPLICATION-LOOP.md](ULM-APPLICATION-LOOP.md) · **Hybrid pipeline:** [HYBRID-DATA-PIPELINE.md](HYBRID-DATA-PIPELINE.md) · **Zone content & copy:** [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) · **Sentinel:** [SENTINEL.md](SENTINEL.md) · **Gary / rebirth / pattern shift:** [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md) · `lib/zone/engineDataRouter.ts` · ceilings in `lib/zone/ulmLimits.ts`

---

## CORS & client fetches

Browser code must **not** call `ofgem.gov.uk` or Nominatim directly.

| Need | Route |
|------|--------|
| Living pulse (Ofgem + grid) | **`GET /api/pulse/living?postcode=…`** (`lib/logic/pulse.ts` client branch) |
| Postcode locality | **`GET /api/geocode/postcode?postcode=…`** |
| Research / Zone tiles | **`GET /api/scrape-sync?postcode=…`** (+ optional `user_id`, Tier 2: `category`, `answer`, `question_id`) |

---

## Sentinel (live layer)

Parallel to scrape-sync / Content Architect — **not** the main `research_results` copy path.

| Piece | Role |
|-------|------|
| **`useSentinel`** | Zone client priorities + optional rural grant tip + grid low pulse |
| **`POST /api/sentinel`** | Live-Impact brain refresh + `syncUserZone` |
| **`advanceHomeJourneySentinelAfterAnswer`** | Home `journey_state` deck after `POST /api/answers` |
| **`inject-sentinel-*`** | Tip IDs excluded from loop-answer birth cap |

**Full spec:** [SENTINEL.md](SENTINEL.md). **Other adjuncts (Gary, rebirth vault):** [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md).

---

## Tier 2 mother/child swap

1. User answers child question in Solo Focus (`EmbeddedJourneyQuestion`).
2. Client: **`runTier2MotherChildSwap`** (`lib/zone/tier2RecursiveSpawner.ts`) — localStorage answer + **`GET /api/scrape-sync`** scoped refresh.
3. Server: persists answer to **`journey_answers`** when `user_id` + valid `question_id`; runs **`runTriggerResearchForCategory`**; returns updated **`research_category_coverage`**.
4. UI: morph deck append + **`zz-tier2-profile-refresh`** event → Zone hero totals refresh without full reload.

---

## Integrations — Neon, Gemini, Firecrawl, Hermes (one pipeline)

These are **not** four separate services talking past each other. They meet inside the **deployed Next.js app** (and your local **`npm run dev`**) via env vars and route handlers:

| Layer | What it does | Contract |
|-------|----------------|----------|
| **Neon** | PostgreSQL: users, `journey_answers_jsonb`, **`research_results`** (includes **`research_snapshot`** JSONB for invoke metadata). | `DATABASE_URL` must use the **pooler** host; canonical hostname check: **`MANIFEST_NEON_POOLER_HOST`** in `lib/intelligence/manifest.ts`. |
| **Gemini** | Models for `/api/zai`, research triplet (`agent_headline`, `architect_prose`), auditor JSON, discovery. | **`GEMINI_API_KEY`** (server-only). Default model **`gemini-2.5-flash`** (`GEMINI_*_MODEL`). Set **`MODEL_STRATEGY=bucket_failover`** for Gemini → Groq → Mistral → OpenRouter failover; JIT scrapes stay **category + profile** (POST scrape-sync with `journey_key`); broad **`?force=true`** and cron full batch blocked unless **`ALLOW_BROAD_SCRAPE=1`** / **`?full=1`**. |
| **Firecrawl** | Scrapes UK-trusted seeds for research, sentinel, and cron-driven refresh. | **`FIRE_CRAWL_KEY_2`** or **`FIRECRAWL_API_KEY`** — both are read in **`lib/sentinel/api-config.ts`** (`FIRE_CRAWL_KEY_2` wins when set). Same value must be present on Vercel if production scrapes run. |
| **Hermes** | Name for the **Oracle VPS cron** — it only **HTTP-triggers** the app; it does not hold DB credentials itself. | **`GET` or `POST`** `/api/cron/zone-research?limit=…` with **`Authorization: Bearer <CRON_SECRET>`** (same secret as Vercel). The **app** then uses **`DATABASE_URL`** + API keys to run the pipeline. |

**End-to-end flow:** Hermes (schedule) → **cron route** → research jobs → **Firecrawl** scrape → **Gemini** structure → **`persistResearchResult`** → **Neon**. Separately, **`POST /api/answers`** remains the **canonical** discovery birth path for MC answers (Solo Focus / bento) → `injectNewDiscoveryCard`; Ask (`/api/research/question-card`) and trap injects are supplemental and share the injection cap (see manifest).

**Verify without exposing secrets:** `bash scripts/verify-env-and-health.sh` (set `BASE_URL` for prod smoke tests). **`GET /api/health/diagnostics`** returns booleans `neon`, `gemini`, `firecrawl` plus DB latency and last research row hints — auth: signed-in session **or** `Authorization: Bearer` matching **`CRON_SECRET`** or **`GATEWAY_TOKEN`**.

---

## Wiring map (connections)

Read this when tracing **profile summary**, **expanded Solo Focus**, or **research rows**.

### Profile summary (`/profile/summary`)

| Piece | Location |
|-------|-----------|
| Impact + waste slack | **`lib/brains/buildUserImpact.ts`** (journeys from localStorage) |
| Narrative input | **`lib/brains/summaryLogic.ts`** — `ProfileSummaryNarrativeInput` includes **`displayName`**, **`annualWasteCash` / `annualWasteCarbon`**, **`local`** from intelligence |
| Kinetic sequence | **`buildSummaryStaccatoWords`** → **`SummaryHeader`** / **`IntroWordCycle`** with **`opacityTicker`** (one word visible at a time; **no** blur / glitch). |
| Locality overflow | **`formatSummaryLocalityKineticToken`** splits long **single-word** placenames; **`app/components/IntroWordCycle.tsx`** — balanced wrap, **`overflow-wrap`**, viewport fit scale with **`fitToViewportPaddingPx`** |
| Local API | **`POST /api/local-intelligence`** — council, ward, **`localCarbonG`**, etc. |

### Solo Focus expanded (True Tip prose)

Full presentation contract: [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) §7–9.

| Piece | Location |
|-------|-----------|
| Title cleanup | **`stripExpandedCardTitleNoise`** — strips trailing **(Updated …)** so the H1 does not repeat body dates — **`lib/soloFocusCopy.ts`**; used in **`JourneyBentoCard`**, **`SoloFocusOverlay`** before **`headlineFromTitle`** |
| Three paragraphs | **`resolveExpandedTrueTipInsight`** — if Neon **`architect_prose`** matches verified audit → **`buildResearchResultsTrueTipBody`** (verified £ / CO₂e); else **`resolveSoloFocusInsightDisplay`**. Gemini **article-tier** triplet in **`lib/agents/researchAgent.ts`**: **`EDITORIAL_MAGAZINE_CONSTRAINT`** + exactly three label-free paragraphs (what / why / how embedded in prose only; ≤40 words each). |
| Category label | Same as collapsed tile: **`card-top-label`** / **`formatZoneCategoryLabel`** above expanded H1. |
| Headline limits | Zone bento **`agent_headline`**: **6–8 words** (`MIN_ZONE_CARD_HEADLINE_WORDS` / `MAX_ZONE_CARD_HEADLINE_WORDS`). Expanded Solo Focus H1: **6–12 words** (`MAX_EXPANDED_VIEW_HEADLINE_WORDS`). Enforced in **`headlineFromTitle`** + Gemini prompt. |
| Dedupe | **`dedupeZoneTipCards`** — no duplicate ids or normalized headline on the tip rail; inject handler on Zone filters before merge. |
| Question cap | **3 questions per journey** (`lib/journeys.ts`); Solo Focus session stops after **`SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION` (3)** per category (`EmbeddedJourneyQuestion`). |
| Layout | Expanded: **Marvin H3** headline (`text-marvin` / `.solo-focus-architect-headline`) + three **Roboto Bold** **`solo-focus-architect-prose`** paragraphs (≤ **`MAX_TRUE_TIP_PARAGRAPH_WORDS` (40)** each). Raw tariff dumps stripped via **`isRawResearchDump`**. |
| Ask Zai | **`AskZaiDeepDiveSheet`** → **Continue in Zai** → `/zai`; chat is read-only (scrape only on **Search deeper**). Zone answers birth cards via **`POST /api/answers`**; Zai interprets stored state. **Integrated flow + all questions:** [ZAI-AND-QUESTIONS-RULES.md](ZAI-AND-QUESTIONS-RULES.md) (Part 0 boundaries + **How it all works together**). Code: `lib/zai/chatBoundaries.ts`. |
| Scroll | Single scroll on **`.solo-focus-grow-layer`** (no nested rail clip). |
| Links | **`offer_url`** / **`verifiedAuditSourceUrl`** / **`pickPrimaryHttpUrl`** — **`IndustrialHandoffButton`** uses **Claim / Buy / Get** via **`resolveRevenueCtaLabel`** (`lib/zone/verifiedRevenue.ts`); always passes a URL ( **`offer_url`** or **`/zai`** fallback). |

Full manifest (Hermes, Neon host token, caps): [INTELLIGENCE-LOOP-MANIFEST.md](INTELLIGENCE-LOOP-MANIFEST.md). Verify DB: **`npm run db:log-research`**. |

### Intelligence Loop cross-links

- **`POST /api/research/question-card`** — free-form **Ask** path; capped injections (not the MC answer-loop birth).
- **`persistResearchResult`** → **`research_results`** (includes **`research_snapshot`** JSON, **`source_url`**) consumed when building Zone cards and **`architect_prose`** for Solo Focus.
- **Hermes** cron → **`GET` or `POST`** `/api/cron/zone-research` — refreshes queued research; same DB feeds expanded copy.

---

## APIs & env (summary)

| Area | Notes |
|------|--------|
| **Auth** | `lib/auth.ts`, `/api/auth/*`, httpOnly session cookie. |
| **Answers** | `POST /api/answers` (auth), `GET /api/answers` (hydrate). |
| **Health** | **`GET /api/health`** — DB ping (`database: connected` when Neon is reachable); add **`?live=1`** for HTTP 200 liveness only (no DB). **`GET /api/health/diagnostics`** — richer booleans + timestamps; requires **signed-in session** *or* **`Authorization: Bearer`** matching **`GATEWAY_TOKEN`** or **`CRON_SECRET`** (same pattern as `lib/agents` gates). |
| **Research** | `persistResearchResult` in `lib/agents/researchAgent.ts` → `research_results` (`user_id`, `category`, `offer_url`, `source_url`, `saving_amount_gbp`, rates, markdown, **`research_snapshot`** JSON invoke payload, …). Optional Gemini triplet extraction when params do not already supply all three. |
| **Personal audit** | `runPersonalAudit(userId)` in `lib/agents/auditor.ts` — Firecrawl seeds + Gemini JSON `{ prose, category, saving_amount_gbp, offer_url }` → persist (requires `GEMINI_API_KEY` + Firecrawl via `FIRE_CRAWL_KEY_2` or `FIRECRAWL_API_KEY`). |
| **Cron** | **`GET` or `POST`** `/api/cron/zone-research?limit=20` — Hermes / Vercel Cron; requires **`CRON_SECRET`** (min 16 chars) in `Authorization: Bearer …` or `x-cron-secret`. Seeds from **`users`** (postcode + profile columns + `user_genome`). |
| **Question → card** | `POST /api/research/question-card` (auth) — `{ journey_key, question }` triggers Firecrawl/Gemini discovery for that category; capped per user/journey (see Intelligence Loop). |

**Required for full live behaviour:** `DATABASE_URL`, `GEMINI_API_KEY`, and Firecrawl (`FIRE_CRAWL_KEY_2` or `FIRECRAWL_API_KEY`). Optional: `GATEWAY_TOKEN` (internal inject/pulse webhooks). **Cron / admin gates:** `CRON_SECRET`. **Client URL hints:** `NEXT_PUBLIC_APP_URL`. See `.env.example`.

---

## Intelligence Loop (manifest)

- **Neon (London):** Canonical pooler host token is `MANIFEST_NEON_POOLER_HOST` in `lib/intelligence/manifest.ts` — it must match the hostname inside `DATABASE_URL` (set password only via Neon Console / Vercel env; never commit secrets).
- **Hermes / Oracle VPS:** [HERMES-VPS-SETUP.md](HERMES-VPS-SETUP.md). **Mac:** `npm run hermes:ping` (auth-only), `npm run hermes:repair-pulse` (mechanical backfill). **Deploy/sync VPS:** `bash scripts/deploy-hermes-to-vps.sh`. **On box:** crontab **`0 5 * * 1`** → **`repair-mechanical`** or `hermes-pulse.sh --repair-only` → **`~/hermes-pulse.log`**. Do **not** run full `zone-research?limit=12` on a schedule. Target: **`https://00-ulm.vercel.app/api/cron/repair-mechanical`**.
- **Neon project:** **`00-ULM`** (London `eu-west-2`); pooler host **`MANIFEST_NEON_POOLER_HOST`**. Wake: `npm run db:test` or any API hit; compute auto-resumes on query.
- **Twelve categories:** Journey keys in `lib/journeys.ts` (`JOURNEY_ORDER` — 12 domains × 3 questions). Research persistence (`research_results`) requires **`saving_amount_gbp`**, **`offer_url`**, category, and prose fields as implemented in `lib/agents/researchAgent.ts` / `persistResearchResult`. **Carbon (kg)** on cards comes from stream + impact only when `journeyHasStreamData` — no UK placeholder wall figures.
- **Injection cap:** `MAX_DISCOVERY_INJECTIONS_PER_JOURNEY` (**1**) — enforced in `discovery_injections` per user per `journey_key` for both `POST /api/zone/injections` (answer loop → alternate journey) and `POST /api/research/question-card` (free question → same journey). Main grid keeps ranked `tip-*` off the bento wall (`SHOW_BASELINE_TIPS_ON_MAIN_GRID`).
- **Locality scrape hints:** `runZeroResearch` prepends extra Firecrawl seeds when user context mentions **Littlehampton** / **Arun** or **Les Azerables** / **Creuse** (`lib/agents/researchAgent.ts`).

### Four-step loop (Hermes as orchestrator, not “just a timer”)

Hermes on the Oracle VPS is the **trigger** for a multi-step pipeline, not an isolated cron ping:

1. **Trigger (Hermes):** Scheduled job (e.g. 05:00) calls **`GET /api/cron/zone-research`** on Vercel with **`CRON_SECRET`** → kicks research refresh for queued users/postcodes.
2. **Extraction:** **Firecrawl** deep-scrapes locality/trust seeds; **Gemini** maps findings into the **twelve journey categories**, producing persistable GBP, prose, `offer_url`, and citations (`lib/agents/researchAgent.ts`, `persistResearchResult`).
3. **Consumption (Zone):** Dashboard cards surface totals and tips; **Solo Focus** expanded view shows **6–12 word** architect headline + **three prose paragraphs** (`architect_prose` when audit matches) + **verified source link**, and a **handoff CTA** (`IndustrialHandoffButton`).
4. **Expansion (user):** **`POST /api/answers`** remains the **canonical** server path that returns discovery payloads for **`injectNewDiscoveryCard`**. **`POST /api/zone/injections`** (trap follow-up) and **`POST /api/research/question-card`** (Ask) are **supplemental** and share the **`MAX_DISCOVERY_INJECTIONS_PER_JOURNEY`** cap.

**UX:** While injections run after a trap answer, Solo Focus shows **“Targeted scrape running…”** and disables duplicate taps. **£ column** shows a **✓ True data** pill when **`verifiedDataBadge`** (Neon-aligned audit).

**Optional:** A 05:00 **email digest** of new cards is product ops only — not implemented in-repo; could use Vercel Cron + Resend etc. later.

---

## Neon migrations (recent / research)

Apply in Neon (or your pipeline) as needed:

- `db/migrations/20260513_research_snapshot_column.sql` — ensures **`research_snapshot`** (rename/merge from legacy JSONB column if present)
- `db/migrations/20260512_research_results_verified_generated.sql` — verified / generated alignment on `research_results`
- `db/migrations/20260512_research_results_architect_prose_numeric.sql` — architect prose / numeric alignment
- `db/migrations/20260511_research_results_user_id.sql` — `research_results.user_id`
- `db/migrations/20260511_init_auditor_schema.sql` — auditor-related columns if not already present
- `db/migrations/20260508_research_results_category.sql` — `research_results.category`
- `db/migrations/20260506_research_intelligence_alignment.sql` — research ↔ intelligence alignment
- Older numbered SQL under `db/migrations/` — schema history

**Verify DB connectivity:** `npm run db:test` (Neon HTTP ping + table list). **Research columns:** `npm run db:columns`.

---

## Motion & layout (Mechanical Snap DNA)

| Surface | Animation | Implementation |
| --- | --- | --- |
| **`/` + `/intro`** | **Style A — Glitch logo** | `IntroScreen` / **`GlitchLogo`** (~469ms CSS glitch, `GLITCH_ANIM_MS`). **Do not** reuse on `/profile/summary`. |
| **Route loading** | **Boot glitch** | `app/loading.tsx` + `app/zone/loading.tsx` → **`AppBootGlitch`** (fullscreen purple + looping logo). |
| **Zone hydrate** | **Inline glitch** | Under Ask Zai pill (`.zone-inline-loading-logo`, 40px vertical rhythm) until first bento card reveals. |
| **`/profile/summary`** | **Staccato word ticker** | `SummaryHeader` → `IntroWordCycle` **`opacityTicker`**: one word at a time, **opacity only** (`STACCATO_*` timing). |
| **`/profile` questions** | **Full-sentence fade** | `ProfilePageClient`: whole label as one block, **y: 10→0** + opacity, **`STACCATO_TWEEN`**. |
| **Zone grid** | **Style B — Mechanical assembly** | `STACCATO_CONTAINER_VARIANTS` / **`STACCATO_CHILD_VARIANTS`** in `app/zone/page.tsx`; 20px gap, **60px** card radius, `grid-auto-rows: 1fr` on tablet+. |
| **Solo Focus** | **Zip-shut → fade-open** | `EmbeddedJourneyQuestion`: **`ZIP_SHUTTER_SPRING`** on the question stack when answering; next **`motion.h3`** uses **opacity + y** when **`soloFocusZipShut`** (no `zz-shimmer-focus`). 40px close circle; journey slab colours. |
| **Floating nav** | **Static precision lock** | `FloatingNav` / `AppFloatingNav`: **40×40px** item circles (`padding: 0`), **18px** icons, **12px** gap, pink bar portaled to `body`. Hidden on Zone when Solo Focus / tip / pattern-shift overlays are open. |
| **Colours** | — | Yellow `#FDFD00`, pink `#FF00FF`, purple `#7800ce` — `:root` in `app/globals.css`. |

Timers: **`SUMMARY_KINETIC_WORD_*`** and **`SHIMMER_FOCUS_*`** in `lib/animations.ts` (intro/summary/CTA only — Zone sticks to **`STACCATO_*`** + fussy snap).

---

## Zai Active Auditor Persona (Brain Stomach & Logic)

Zai operates as the **Active Auditor** for Zero Zero. This goes beyond a static chat assistant; it is the "brain stomach" digesting local data into actionable intelligence.

**1. The 12k/1t Logic (Core Engine)**
All insights and recommendations are strictly evaluated against the **12,000 kWh / 1 tonne CO₂e** baseline. Zai must ground every suggestion in measurable £ and CO₂e reductions.

**2. Gemini Rules (Extraction & Persona)**
- **Strict Parsing**: Gemini acts as a forensic triplet extractor (What, Why, How) to process user inputs and scraped data.
- **Tone**: Direct, lowercase where natural, value-first (£ / kg). No fluff.
- **Prose formatting**: All output must be label-free. Structural headings are forbidden. The trinity of logic lives *inside* the prose.
- **No AI Apologies**: Never use "As an AI..." or "Here is..." padding.

**3. Firecrawl Rules (Locality & Triggers)**
- **Dynamic Locality**: `user_profiles.postcode` / profile postcode is the coordinate for all Firecrawl research triggers. No static postcode anchor is allowed.
- **Targeted Scraping**: The cron engine and discovery pipeline invoke Firecrawl with strict URL seeds to pull verified local grants, tariffs, and EV infrastructure logic.

**4. The "Fussy" Motion DNA**
The application UI reflects the Auditor's precision: mechanical, low-latency, and precise. 
- **Linear Fades**: `0.12s linear`. No floaty physics.
- **2px Snaps**: Elements fade in (`opacity: 0` to `1`) with a strict `2px` vertical snap (`y: 2` to `y: 0`).

---

## Security

- Never commit `.env.local` or real secrets; rotate if exposed; use Vercel env for production.
- `GEMINI_API_KEY` and `DATABASE_URL` are **server-only** (no `NEXT_PUBLIC_` prefix).
- Sessions: httpOnly, secure in production, sameSite lax; logout via `POST /api/auth/logout`.
- Run **`npm run audit`** regularly and upgrade dependencies for patches.

---

## Repo map (high level)

**Keep these trees; do not duplicate logic elsewhere.**

| Path | Role |
|------|------|
| `app/` | App Router pages, API routes, UI components |
| `app/components/ZoneCard.tsx` | Zone export + Tier 2 helpers |
| `app/components/AppBootGlitch.tsx` | Segment loading — glitch logo (`app/loading.tsx`, `app/zone/loading.tsx`) |
| `app/components/AppFloatingNav.tsx` | Shared floating nav mount (Zone, Likes, Zai, Settings) |
| `app/components/AskZaiDeepDiveSheet.tsx` | Expanded Ask Zai sheet + Continue in Zai handoff |
| `app/components/LoadingHeartbeat.tsx` | Legacy heartbeat component (Zone uses inline `GlitchLogo` gate) |
| `app/components/ZoneIntelligenceStrip.tsx` | Dev FAB; polls scrape-sync with Gary `user_id` when active |
| `lib/zone/` | Zone VM, Tier 2, Gary mode, scrape parsers, bento persona |
| `lib/brains/` | Impact engine, summary, constants, Zai router (**not** `lib/brain/` — single legacy API) |
| `lib/agents/` | Research, discovery, Firecrawl, Gemini persist |
| `lib/db/neon.ts` | Answer upserts + research reads |
| `lib/geocode/resolvePostcodeLocality.ts` | Nominatim label + localStorage cache |
| `lib/soloFocusCopy.ts` | Headline limits (6–8 bento / 6–12 expanded), dedupe, True Tip prose |
| `lib/architecturalPulse.ts` | Summary→Zone pulse, font preload, `isZoneReady`, glitch timing |
| `lib/researchSyncClient.ts` | POST trigger + re-exports Tier 2 fetch |
| `lib/schema.sql` + `db/migrations/` | Schema reference + Neon SQL history |
| `scripts/` | Ops only — see **Scripts** below |
| [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) | Scrape, copy, cards, Solo Focus, tone, URLs |
| [PROFILE-ANSWERS-ZONE-TECH.md](PROFILE-ANSWERS-ZONE-TECH.md) | Profile + 12×3 + mechanical truth |
| [ZAI-AND-QUESTIONS-RULES.md](ZAI-AND-QUESTIONS-RULES.md) | Zai + questions + boundaries |
| [HYBRID-DATA-PIPELINE.md](HYBRID-DATA-PIPELINE.md) | Tier A–D cost map |
| [ULM-APPLICATION-LOOP.md](ULM-APPLICATION-LOOP.md) | ULM ceilings + spawn |
| [INTELLIGENCE-LOOP-MANIFEST.md](INTELLIGENCE-LOOP-MANIFEST.md) | Hermes loop manifest |
| [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) | Vercel checks / promote |
| [SENTINEL.md](SENTINEL.md) | Sentinel live layer |
| [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md) | Gary, pattern shift, rebirth vault |
| `e2e/` | Playwright specs |

### Scripts (npm / ops)

| Command | Script |
|---------|--------|
| `npm run init-db` | `scripts/init-db.ts` |
| `npm run db:test` | `scripts/db-test.ts` |
| `npm run db:log-research` | `scripts/log-latest-research-row.ts` |
| `npm run verify` | `typecheck` + `lint:ci` (also runs inside `npm run build`) |
| `npm run typecheck` | `tsc -p tsconfig.typecheck.json` |
| `npm run lint` / `lint:ci` | ESLint on `app` + `lib` |
| `npm run deploy` | `scripts/deploy-production.sh` |
| `npm run verify:env` | `scripts/verify-env-and-health.sh` |
| `npm run hermes:ping` | `scripts/hermes-pulse.sh --auth-only` |
| `npm run hermes:pulse` | `scripts/hermes-pulse.sh --smoke` |
| `bash scripts/deploy-hermes-to-vps.sh` | Rsync Hermes scripts + secret to Oracle VPS |
| Gary BN17 link | `scripts/link-gary-bn17-research.ts` (manual; `DATABASE_URL` env) |

Other files under `scripts/` are optional one-offs (seed, curl helpers) — not required for production runtime.

### Removed / legacy (do not restore)

- `lib/geocode.ts` — use `lib/geocode/resolvePostcodeLocality.ts` + `/api/geocode/postcode`
- `tailwind.config.js` — use `tailwind.config.ts` only
- `pages/_app.js` — App Router only (`app/`)
- Root `hooks/` — use `app/hooks/` + `lib/hooks/`
- `vercel-deploy*.log`, `deploy-trigger.*` — gitignored local noise

---

## Vercel / Next.js maintenance

- **Project:** **`gary-lomi-lomicos-projects/00-ulm`** · alias **`https://00-ulm.vercel.app`**. Deploy: **`npm run deploy`** (tolerates CLI timeout if build log shows **Deployment completed** / **Aliased**).
- **Pipeline:** Push **`main`** (Git integration) or **`npm run deploy`**. **`vercel.json`**: `installCommand: npm ci`, `buildCommand: npm run build` (includes **`verify`**).
- **Node version:** **`engines.node`**: **`24.x`**, **`.node-version`**: **`24`** — must match Vercel **Project Settings → Node.js Version** (dashboard currently **24.x**). Mismatch can break native Deployment Checks.
- **Native Deployment Checks (Lint / Typecheck):** Vercel runs **`npm run lint`** and **`npm run typecheck`** in *parallel* with the build (separate jobs). **`eslint`** + **`typescript`** live in **`dependencies`**; scripts use **`node node_modules/...`**. **`.nvmrc`**, **`.node-version`**, and **`engines.node`** must all be **24** (drift causes “internal error”).
- **“Checks Failed” + “Staged” (build OK):** Open the deployment → confirm **Build** step finished (not exit 1) → **Promote to Production**. The app build already ran **`npm run verify`** inside **`npm run build`**. Red **Lint/Typecheck** rows that say *“An internal error occurred”* are a Vercel check-runner glitch, not your code — see [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).
- **Disable duplicate checks (recommended):** Project **00-ulm** → **Settings** → **Build & Deployment** → **Deployment Checks** → remove or disable native **Lint** + **Typecheck** (or replace with **`GET /api/health?live=1`** smoke only).
- **GitHub CI:** `.github/workflows/ci.yml` — lint + typecheck on push/PR (Node 24).
- **Smoke test:** **`GET /api/health`** (`database: connected` ⇒ Neon OK). **`bash scripts/verify-env-and-health.sh`** with **`BASE_URL=https://00-ulm.vercel.app`** for diagnostics.
- **Stale JS chunks:** After deploy, users may see **Loading chunk … failed** if HTML references an old hash — **`app/error.tsx`** auto-reloads once; hard refresh or clear site data fixes it.
- **Admin API gate:** **`proxy.ts`** (Next.js 16+) on `/api/admin/*` — do not duplicate auth in `middleware.ts`.
- **Env / redeploy:** **503** + **`API auth not configured`** ⇒ **`SCRAPER_SECRET`** or **`CRON_SECRET`** (≥16 chars) on Production, then redeploy. **503** + **`Scraper not configured`** ⇒ **`FIRE_CRAWL_KEY_2`** or **`FIRECRAWL_API_KEY`**. Bearer = scraper/cron secret, **not** the Firecrawl key.
- **Wrong hostname:** **`Cannot POST /api/scrape-sync`** on **`00-01.vercel.app`** etc. — wrong deployment; use **`00-ulm.vercel.app`**.
- **zsh + curl:** Avoid **`!`** in double-quoted Bearer; use single quotes or **`bash scripts/curl-scrape-sync-trigger.sh`**.

---

## Contributing / agents

- After substantive TS changes: **`npm run check`**.
- Cursor project skill: `.cursor/skills/zero-zero-focus/SKILL.md`.
- **Hermes:** operational name for the VPS cron that hits `/api/cron/zone-research` — not a separate codebase artifact.
