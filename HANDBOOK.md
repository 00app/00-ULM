# Zero Zero (00-00) — Handbook

Single reference for product intent, user flow, architecture, integrations, motion pointers, and security. Implementation detail lives in code (`lib/`, `app/`); **verify animation timings in `lib/animations.ts`**.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # DATABASE_URL, GEMINI_API_KEY, etc. — never commit .env.local
npm run init-db              # applies lib/schema.sql via TCP (loads .env.local automatically)
npm run dev                  # http://127.0.0.1:3000 (see package.json for :3030 / :3001 variants)
```

**Canonical Git remote:** `https://github.com/00app/00-ULM.git` — push `main` here; Vercel Git integration (if enabled) builds on push. This repo has **no GitHub Actions workflows**; the production pipeline is **Vercel build + deploy** (`vercel ls` / dashboard for status).

**Neon empty branch / “No roles available”:** In [Neon Console](https://console.neon.tech) → your project → ensure **Roles** exist (create `neondb_owner` or reset password). Paste the **pooler** connection string into `DATABASE_URL`, then run `npm run init-db` again. If auth fails, paste a **fresh** URI from **Connection details** (passwords rotate when reset).

**`.env.local` vs shell:** `npm run init-db`, `npm run db:test`, and `npm run db:log-research` load `.env.local` with **`preferLocal: true`** (`scripts/load-env-local.ts`) so values in the file **override** a stale exported `DATABASE_URL`. Still **save** `.env.local` to disk after edits — the terminal reads the file, not an unsaved editor buffer.

**Build:** `npm run build` · **Deploy:** `npm run deploy` or `npm run ship` (build + Vercel prod). Production alias example: `https://00-ulm.vercel.app` (project-linked hostname).

**Typecheck:** `npm run check` · **Vulnerabilities:** `npm run audit` · **E2E:** `npm run test:e2e`

---

## What the app is

UK-first web app: **postcode** and **profile** drive local context; **Zone** shows a bento wall (hero, journeys, tips); **Solo Focus** expands one card into a **question → answer → result** loop; **Zai** (`/zai`) is the chat assistant. Goals: immediate answer commit, fast Zone refresh, grounded citations, actionable CTAs.

**Canonical Zone path:** `app/zone/page.tsx` → `lib/zone/buildZoneViewModel.ts` (logic facade: `lib/logic/zone.ts`). **Design lock:** `.cursor/rules/mechanical-pulse.mdc` + `lib/journeyColors.ts`.

---

## User flow

| Step | Route | Notes |
|------|--------|--------|
| Intro | `/`, `/intro` | Glitch logo → `IntroWordCycle` (SAVE → MONEY → …) → **CREATE** (`/profile`) or **SKIP** (`/zone`). `?skip=1` / `?step=message` skips logo. |
| Profile | `/profile` | Stepped onboarding (`ProfilePageClient`). **Full-sentence fade:** each step’s heading is **one block** (soft **y: 10→0** + opacity, `STACCATO_TWEEN`) — **not** word-by-word. Postcode → `POST /api/local-intelligence`. |
| Summary | `/profile/summary` | **`SummaryHeader`** → **`IntroWordCycle`** with **`opacityTicker`**: **one word on screen at a time**, opacity **0→1** only (Mechanical Snap ticker — **no** Style A glitch). Words from **`buildSummaryStaccatoWords`**; locality wrap via **`formatSummaryLocalityKineticToken`** + **`fitToViewportPaddingPx`**. Dwell/gap: **`SUMMARY_KINETIC_WORD_*`** in `lib/animations.ts`. Then Zone. **`lib/brains/summaryLogic.ts`**. |
| Zone | `/zone` | Main dashboard; bento grid uses **Style B** — **`STACCATO_*`** staggered mechanical assembly (`app/zone/page.tsx`). |
| Solo Focus | (overlay) | `JourneyBentoCard` / `SoloFocusOverlay` + `EmbeddedJourneyQuestion` — **`POST /api/answers`** runs the discovery race → **`injectNewDiscoveryCard`** for new Zone cards; **`/api/research/question-card`** is Ask-only. Zip-shut on answer → **fade-open** (opacity + **y**) for the next question when `soloFocusZipShut`. |
| Other | `/zai`, `/likes`, `/settings` | Chat, saved cards, reset/session. |

No `/journeys` or `/expand/*` product routes — journeys live on Zone.

---

## Journey questions (“the loop”)

- **Definitions:** `lib/journeys.ts` — ordered `questions` per journey id (`home`, `travel`, `food`, …).
- **Next question:** `lib/zone/questionHandler.ts` — `getNextQuestion(journeyId, answers)` returns the first question with no (or empty) answer.
- **UI (Solo Focus / embedded):** `app/components/EmbeddedJourneyQuestion.tsx` — session cap via `SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION` (`lib/animations.ts`). After a zip-shut answer, the **next** question label **fades open** (opacity + **y**), not the intro shimmer.
- **UI (`/profile` onboarding):** `ProfilePageClient.tsx` — **full-sentence** question copy per step (same fade contract as above).
- **Persist:** `POST /api/answers` — validates `isValidJourneyQuestion`, upserts `journey_answers_jsonb`, recomputes impact, discovery, optional research (`triggerSupplementalResearch`), Sentinel hooks, etc. **This is the canonical birth path** for discovery cards returned as `new_card_data` / `grid_pulse_card` in the JSON response → client **`injectNewDiscoveryCard`**.
- **Hydrate:** `GET /api/answers` — server answers merged on boot (`AppContext`) so Zone matches Neon.

---

## Data & view model

Zone VM blends: **AppContext** + **localStorage** mirror, **journey answers**, **scraped_summary**, **`/api/local-intelligence`**, pulse snapshot, zone injections, content-architect prose. Cards use **`LIVE_AUDIT`** vs **`ESTIMATED_AUDIT`** when genome inputs are incomplete vs research-backed (`lib/zone/buildZoneViewModel.ts`).

**Postcode:** Source of truth includes `profile_postcode` in localStorage; Zone refreshes on change (polling, `storage` events, unified profile memory).

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

| Piece | Location |
|-------|-----------|
| Title cleanup | **`stripExpandedCardTitleNoise`** — strips trailing **(Updated …)** so the H1 does not repeat body dates — **`lib/soloFocusCopy.ts`**; used in **`JourneyBentoCard`**, **`SoloFocusOverlay`** before **`headlineFromTitle`** |
| Three paragraphs | **`resolveExpandedTrueTipInsight`** — if Neon **`architect_prose`** matches verified audit → **`buildResearchResultsTrueTipBody`** (verified £ / CO₂e); else **`resolveSoloFocusInsightDisplay`**. Gemini triplet in **`lib/agents/researchAgent.ts`** locks **Zai** persona: exactly three paragraphs (What / Why / How), direct mostly-lowercase prose, no filler openers. |
| Layout | **`TRUE_TIP_SECTION_LABELS`** — **The What (The Discovery)** / **The Why (Money & Carbon)** / **The How (Action)** labels above each paragraph in **`JourneyBentoCard`** + **`SoloFocusOverlay`**. |
| Dedupe | **`stripExpandedCardTitleNoise`** (incl. fluff prefixes), **`stripAuditorFluffParagraph`**, **`polishTrueTipParagraphsForHeadline`** / **`dedupeTrueTipOpeningParagraph`** — headline vs first paragraph overlap |
| Links | **`offer_url`** / **`verifiedAuditSourceUrl`** / **`pickPrimaryHttpUrl`** — **`IndustrialHandoffButton`** uses **Claim / Buy / Get** via **`resolveRevenueCtaLabel`** (`lib/zone/verifiedRevenue.ts`); always passes a URL ( **`offer_url`** or **`/zai`** fallback). |

Full manifest (Hermes, Neon host token, caps): **`docs/INTELLIGENCE-LOOP-MANIFEST.md`**. Verify DB: **`npm run db:log-research`**. |

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
| **Personal audit** | `runPersonalAudit(userId)` in `lib/agents/auditor.ts` — Firecrawl seeds + Gemini JSON `{ prose, category, saving_amount_gbp, offer_url }` → persist (requires `GEMINI_API_KEY`, `FIRECRAWL_API_KEY`). |
| **Cron** | **`GET` or `POST`** `/api/cron/zone-research?limit=20` — Hermes / Vercel Cron; requires **`CRON_SECRET`** (min 16 chars) in `Authorization: Bearer …` or `x-cron-secret`. Seeds from **`users`** (postcode + profile columns + `user_genome`). |
| **Question → card** | `POST /api/research/question-card` (auth) — `{ journey_key, question }` triggers Firecrawl/Gemini discovery for that category; capped per user/journey (see Intelligence Loop). |

**Required for full live behaviour:** `DATABASE_URL`, `GEMINI_API_KEY`, `FIRECRAWL_API_KEY`. Optional: `GATEWAY_TOKEN` (internal inject/pulse webhooks). **Cron / admin gates:** `CRON_SECRET`. **Client URL hints:** `NEXT_PUBLIC_APP_URL`. See `.env.example`.

---

## Intelligence Loop (manifest)

- **Neon (London):** Canonical pooler host token is `MANIFEST_NEON_POOLER_HOST` in `lib/intelligence/manifest.ts` — it must match the hostname inside `DATABASE_URL` (set password only via Neon Console / Vercel env; never commit secrets).
- **Hermes / Oracle VPS:** Run a daily cron (e.g. **05:00**) that calls **`GET` or `POST`** `https://<deployment>/api/cron/zone-research?limit=20` with header **`Authorization: Bearer <CRON_SECRET>`** (same value as Vercel `CRON_SECRET`). A shell wrapper (e.g. `~/hermes/pulse.sh`) and **`psql "$DATABASE_URL"`** on the box are fine sanity checks; the app uses the same Neon URI in **`DATABASE_URL`**.
- **Nine categories:** Journey keys in `lib/journeys.ts` (`JOURNEY_ORDER`). Research persistence (`research_results`) requires **`saving_amount_gbp`**, **`offer_url`**, category, and prose fields as implemented in `lib/agents/researchAgent.ts` / `persistResearchResult`. **Carbon (kg)** on cards comes from Zone impact + scraped overlays; align Gemini prompts with GBP + HTTPS offer links.
- **Injection cap:** `MAX_DISCOVERY_INJECTIONS_PER_JOURNEY` (**3**) — enforced in `discovery_injections` per user per `journey_key` for both `POST /api/zone/injections` (answer loop → alternate journey) and `POST /api/research/question-card` (free question → same journey).
- **Locality scrape hints:** `runZeroResearch` prepends extra Firecrawl seeds when user context mentions **Littlehampton** / **Arun** or **Les Azerables** / **Creuse** (`lib/agents/researchAgent.ts`).

### Four-step loop (Hermes as orchestrator, not “just a timer”)

Hermes on the Oracle VPS is the **trigger** for a multi-step pipeline, not an isolated cron ping:

1. **Trigger (Hermes):** Scheduled job (e.g. 05:00) calls **`GET /api/cron/zone-research`** on Vercel with **`CRON_SECRET`** → kicks research refresh for queued users/postcodes.
2. **Extraction:** **Firecrawl** deep-scrapes locality/trust seeds; **Gemini** maps findings into the **nine journey categories**, producing persistable GBP, prose, `offer_url`, and citations (`lib/agents/researchAgent.ts`, `persistResearchResult`).
3. **Consumption (Zone):** Dashboard cards surface totals and tips; **Solo Focus** expanded view shows **three paragraphs** (`TRUE_TIP_SECTION_LABELS` + `architect_prose` when audit matches) and a **handoff CTA** (`IndustrialHandoffButton`).
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
| **`/` + `/intro`** | **Style A — Glitch logo** | `IntroScreen` ~469ms CSS glitch + `IntroWordCycle` with **`WORD_PULSE_APPEAR`** (blur pulse). **Do not** reuse this glitch on `/profile/summary`. |
| **`/profile/summary`** | **Staccato word ticker** | `SummaryHeader` → `IntroWordCycle` **`opacityTicker`**: one word at a time, **opacity only** (`STACCATO_*` timing). |
| **`/profile` questions** | **Full-sentence fade** | `ProfilePageClient`: whole label as one block, **y: 10→0** + opacity, **`STACCATO_TWEEN`**. |
| **Zone grid** | **Style B — Mechanical assembly** | `STACCATO_CONTAINER_VARIANTS` / **`STACCATO_CHILD_VARIANTS`** in `app/zone/page.tsx`; 20px gap, **60px** card radius, `grid-auto-rows: 1fr` on tablet+. |
| **Solo Focus** | **Zip-shut → fade-open** | `EmbeddedJourneyQuestion`: **`ZIP_SHUTTER_SPRING`** on the question stack when answering; next **`motion.h3`** uses **opacity + y** when **`soloFocusZipShut`** (no `zz-shimmer-focus`). 40px close circle; journey slab colours. |
| **Colours** | — | Yellow `#FDFD00`, pink `#E80DAD`, purple `#7800ce` — `:root` in `app/globals.css`. |

Timers: **`SUMMARY_KINETIC_WORD_*`**, **`SHIMMER_FOCUS_*`**, **`INTRO_DECISION_CTA_*`** in `lib/animations.ts` (intro/summary/CTA only — Zone sticks to **`STACCATO_*`** + layout springs).

---

## Zai persona (short)

Zai = UK energy / savings copilot: direct, lowercase where natural, value-first (£ / kg). Lead wins to **LEARN / SWITCH / CLAIM**. Do not apologise or “as an AI”. (Full prompt wiring: `lib/brains/zai/`, `/api/zai`.)

---

## Security

- Never commit `.env.local` or real secrets; rotate if exposed; use Vercel env for production.
- `GEMINI_API_KEY` and `DATABASE_URL` are **server-only** (no `NEXT_PUBLIC_` prefix).
- Sessions: httpOnly, secure in production, sameSite lax; logout via `POST /api/auth/logout`.
- Run **`npm run audit`** regularly and upgrade dependencies for patches.

---

## Repo map (high level)

| Path | Role |
|------|------|
| `app/components/ZoneIntelligenceStrip.tsx` | **Zone** + **Likes**: triangle FAB + `pulse-diagnostic-panel`; **Neon tick** = public `GET /api/health`; on failure, **`dbHealthHint`** explains (no secrets). Dev **`debugHudLine`**. `suppressOverlay` when Solo Focus / tip expanded. |
| `app/api/*` | Route handlers (answers, zone, zai, sentinel, scrape-sync, cron, …) |
| `lib/brains/summaryLogic.ts` | Profile summary kinetic + reveal copy |
| `lib/soloFocusCopy.ts` | Solo Focus headlines, True Tip paragraphs, title strip / polish |
| `lib/agents/*` | Research, discovery, auditor, sentinel |
| `lib/db/neon.ts` | Neon queries + invoke snapshots |
| `lib/schema.sql` | Reference schema (init-db) |
| `lib/logic/engine.ts` | Economic / grid truth helpers |
| `lib/intelligence/manifest.ts` | Neon host token + injection caps (no secrets) |
| `e2e/` | Playwright specs |

---

## Vercel / Next.js maintenance

- **Pipeline:** Builds run on Vercel when Git integration receives pushes to the connected branch (usually **`main`**) **or** when you run **`npm run deploy`** / **`npm run ship`**. If previews stop updating, confirm the Git link in the Vercel project and run **`vercel link`** locally so the CLI target matches **`gary-lomi-lomicos-projects/00-ulm`** (or your team project). There is **no** `.github/workflows` CI in-repo.
- **Smoke test:** **`GET /api/health`** on production (`database: connected` ⇒ Neon **`DATABASE_URL`** is valid in Vercel env).
- **Admin API gate:** Root **`proxy.ts`** (Next.js 16+) runs on `/api/admin/*` — same behaviour as the old `middleware.ts`; do not duplicate auth in two files.
- **Node version:** `package.json` **`engines.node`** is pinned to **`20.x`** so Vercel does not float onto a new major during redeploys. Bump intentionally when you upgrade the runtime.
- **npm transitive warnings** (e.g. `node-domexception`): usually clear when upstream packages update; run **`npm update`** on a branch when convenient.

---

## Contributing / agents

- After substantive TS changes: **`npm run check`**.
- Cursor project skill: `.cursor/skills/zero-zero-focus/SKILL.md`.
- **Hermes:** operational name for the VPS cron that hits `/api/cron/zone-research` — not a separate codebase artifact.
