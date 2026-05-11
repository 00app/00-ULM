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

**Neon empty branch / “No roles available”:** In [Neon Console](https://console.neon.tech) → your project → ensure **Roles** exist (create `neondb_owner` or reset password). Paste the **pooler** connection string into `DATABASE_URL`, then run `npm run init-db` again. If auth fails, paste a **fresh** URI from **Connection details** (passwords rotate when reset).

**Build:** `npm run build` · **Deploy:** `npm run deploy` or `npm run ship` (build + Vercel prod).

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
| Profile | `/profile` | Stepped onboarding (`ProfilePageClient`); postcode → `POST /api/local-intelligence`. |
| Summary | `/profile/summary` | Kinetic handoff → Zone. |
| Zone | `/zone` | Main dashboard; grid from profile + answers + local/research/discovery. |
| Solo Focus | (overlay) | `JourneyBentoCard` / `SoloFocusOverlay` + `EmbeddedJourneyQuestion`. |
| Other | `/zai`, `/likes`, `/settings` | Chat, saved cards, reset/session. |

No `/journeys` or `/expand/*` product routes — journeys live on Zone.

---

## Journey questions (“the loop”)

- **Definitions:** `lib/journeys.ts` — ordered `questions` per journey id (`home`, `travel`, `food`, …).
- **Next question:** `lib/zone/questionHandler.ts` — `getNextQuestion(journeyId, answers)` returns the first question with no (or empty) answer.
- **UI:** `app/components/EmbeddedJourneyQuestion.tsx` — renders next question in Solo Focus; session cap via `SOLO_FOCUS_MAX_QUESTIONS_PER_SESSION` (`lib/animations.ts`).
- **Persist:** `POST /api/answers` — validates `isValidJourneyQuestion`, upserts `journey_answers_jsonb`, recomputes impact, discovery, optional research (`triggerSupplementalResearch`), Sentinel hooks, etc.
- **Hydrate:** `GET /api/answers` — server answers merged on boot (`AppContext`) so Zone matches Neon.

---

## Data & view model

Zone VM blends: **AppContext** + **localStorage** mirror, **journey answers**, **scraped_summary**, **`/api/local-intelligence`**, pulse snapshot, zone injections, content-architect prose. Cards use **`LIVE_AUDIT`** vs **`ESTIMATED_AUDIT`** when genome inputs are incomplete vs research-backed (`lib/zone/buildZoneViewModel.ts`).

**Postcode:** Source of truth includes `profile_postcode` in localStorage; Zone refreshes on change (polling, `storage` events, unified profile memory).

---

## APIs & env (summary)

| Area | Notes |
|------|--------|
| **Auth** | `lib/auth.ts`, `/api/auth/*`, httpOnly session cookie. |
| **Answers** | `POST /api/answers` (auth), `GET /api/answers` (hydrate). |
| **Health** | `/api/health`, `/api/health/diagnostics?…` |
| **Research** | `persistResearchResult` in `lib/agents/researchAgent.ts` → `research_results` (`user_id`, `category`, `offer_url`, `saving_amount_gbp`, rates, markdown, …). Optional Gemini triplet extraction when params do not already supply all three. |
| **Personal audit** | `runPersonalAudit(userId)` in `lib/agents/auditor.ts` — Firecrawl seeds + Gemini JSON `{ prose, category, saving_amount_gbp, offer_url }` → persist (requires `GEMINI_API_KEY`, `FIRECRAWL_API_KEY`). |
| **Cron** | `GET /api/cron/zone-research` — requires `CRON_SECRET` (min 16 chars) in `Authorization: Bearer …` or `x-cron-secret`. |

**Required for full live behaviour:** `DATABASE_URL`, `GEMINI_API_KEY`, `FIRECRAWL_API_KEY` (or OpenClaw gateway vars). **Cron / admin gates:** `CRON_SECRET`. **Client URL hints:** `NEXT_PUBLIC_APP_URL`. See `.env.example`.

There is **no** in-repo service named Hermes or Oracle — use **curl + Vercel URL + `CRON_SECRET`** from a VPS or Vercel Cron for scheduled jobs.

---

## Neon migrations (recent / research)

Apply in Neon (or your pipeline) as needed:

- `db/migrations/20260511_research_results_user_id.sql` — `research_results.user_id`
- `db/migrations/20260511_init_auditor_schema.sql` — auditor-related columns if not already present
- `db/migrations/20260508_research_results_category.sql` — `research_results.category`
- Older numbered SQL under `db/migrations/` — schema history

**Verify DB connectivity:** `npm run db:test` (Neon HTTP ping + table list). **Research columns:** `npm run db:columns`.

---

## Motion & layout (pointers)

- **Intro:** `IntroScreen`, `IntroWordCycle`; glitch **~670ms** CSS; v6 shimmer: `SHIMMER_FOCUS_*`, `INTRO_DECISION_CTA_*` in `lib/animations.ts`.
- **Zone grid:** 20px gap, 60px card radius, equal-height rows on tablet+ (`grid-auto-rows: 1fr`).
- **Solo Focus:** Transparent expanded shell; zip-shut transitions; 40px close circle; journey slab colours.
- **Colours:** Yellow `#FDFD00`, pink `#E80DAD`, purple `#7800ce` — `:root` in `app/globals.css`.

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
| `app/api/*` | Route handlers (answers, zone, zai, sentinel, scrape-sync, cron, …) |
| `lib/agents/*` | Research, discovery, auditor, sentinel |
| `lib/db/neon.ts` | Neon queries + invoke snapshots |
| `lib/schema.sql` | Reference schema (init-db) |
| `lib/logic/engine.ts` | Economic / grid truth helpers |
| `e2e/` | Playwright specs |

---

## Vercel / Next.js maintenance

- **Admin API gate:** Root **`proxy.ts`** (Next.js 16+) runs on `/api/admin/*` — same behaviour as the old `middleware.ts`; do not duplicate auth in two files.
- **Node version:** `package.json` **`engines.node`** is pinned to **`20.x`** so Vercel does not float onto a new major during redeploys. Bump intentionally when you upgrade the runtime.
- **npm transitive warnings** (e.g. `node-domexception`): usually clear when upstream packages update; run **`npm update`** on a branch when convenient.

---

## Contributing / agents

- After substantive TS changes: **`npm run check`**.
- Cursor project skill: `.cursor/skills/zero-zero-focus/SKILL.md`.
- **Hermes / outbound messaging:** not wired as a named product; no Telegram batch in this repo unless you add it.
