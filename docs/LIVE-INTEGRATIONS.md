# Live integrations — Neon, Gemini, Firecrawl, Hermes (VPS), Oracle

This doc tells you **what runs in the repo** vs **what you configure outside** (VPS, Cursor MCP, Vercel env).

## Environment variables (Vercel + `.env.local`)

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Neon Postgres — **required** for users, `journey_answers_jsonb`, `research_results`, cron. |
| `GEMINI_API_KEY` | Content Architect, Zai, researcher parse paths, admin pulse. |
| `FIRECRAWL_API_KEY` | `runZeroResearch` seed scrapes, hybrid zone tips, admin pulse. |
| `CRON_SECRET` | **Required** for `GET /api/cron/zone-research` (min 16 chars). Hermes/VPS or Vercel Cron sends this header. |
| `OPENCLAW_GATEWAY_URL` / `OPENCLAW_GATEWAY_TOKEN` | Optional OpenClaw gateway (preferred over raw Firecrawl when set). |
| `GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_TOKEN` | Admin pulse + some API gates (see `middleware` / pulse routes). |

After changing Neon schema, run migrations in Neon SQL Editor or your pipeline:

- `db/migrations/20260511_research_results_user_id.sql` — adds `research_results.user_id` so research rows are **per user**, not only postcode.
- `db/migrations/20260511_init_auditor_schema.sql` — adds **`offer_url`** and **`saving_amount_gbp`** on `research_results` (auditor-friendly aliases; backfilled from `deep_link` / `source_url` and `verified_saving`). Does **not** duplicate `users` or `journey_answers` tables — those already exist.

## What was wired in code (database-first loop)

1. **`research_results.user_id`** — Research persisted from answers, discovery, scrape-sync, and cron is stamped with the logged-in user when a session exists.
2. **`GET /api/answers`** — Already returns Neon `journey_answers_jsonb`. **App boot** now merges server answers into React state + `localStorage` so Zone uses the same genome as the DB (for users with a real UUID session).
3. **`POST /api/user`** — Accepts optional **`goal`** (`money` \| `carbon` \| `balanced`) and stores it in **`users.user_genome.profile_goal`**.
4. **`GET /api/scrape-sync?postcode=…`** — If the browser sends the **session cookie**, loads **`journey_answers_jsonb`** from Neon, adds it to Firecrawl research **`userContext`**, and passes **`userId`** into `runZeroResearchWithProfile` so new rows are user-scoped.
5. **`POST /api/zone/content-architect`** — Merges **server journey answers** into each card payload before Gemini, and loads unit rates with **`getLatestResearchUnitRates(postcode, userId)`** so user-scoped research wins over generic postcode rows.
6. **`triggerSupplementalResearch`** — Accepts **`userId`** so discovery / answers paths persist research on behalf of that user.

## Hermes (your VPS “watchman”) — no special prompt file in repo

Hermes is **not** a service inside this Next app. You run **HTTP** on a schedule (cron on Oracle Linux, systemd timer, etc.):

```bash
# Example: nightly refresh for up to 20 users (replace host and secret)
curl -sS -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR_VERCEL_DOMAIN/api/cron/zone-research?limit=20"
```

Or:

```bash
curl -sS -H "x-cron-secret: YOUR_CRON_SECRET" \
  "https://YOUR_VERCEL_DOMAIN/api/cron/zone-research?limit=20"
```

**You do not need a separate “Hermes prompt”** in the terminal unless your VPS wrapper expects one — the app only checks **secret headers**. Set `CRON_SECRET` in Vercel to a long random string; use the **same** value in `curl`.

## Oracle Cloud (London / “Lincoln”)

- **Runtime:** Oracle does **not** receive pushes from this repo automatically. Use **curl** (above) from the VPS, or Oracle **Events** + **Functions** to hit your Vercel URL.
- **Cursor MCP:** `@oracle/mcp` + `~/.oci/config` is for **your IDE** (monitoring), not for end-user Zone data.

## Personal auditor (`lib/agents/auditor.ts`)

Server utility **`runPersonalAudit(userId)`**: loads **`users`** + **`user_genome.profile_goal`** + **`journey_answers_jsonb`**, scrapes trusted **`UK_2026_SEED_URLS`** via **`@mendable/firecrawl-js`**, asks **Gemini** for JSON `{ prose, saving, url }`, then **`persistResearchResult`** → **`research_results`** (including **`offer_url`** / **`saving_amount_gbp`**). Requires **`GEMINI_API_KEY`** and **`FIRECRAWL_API_KEY`**. Intended to be called from a secured cron or internal route (not exposed publicly without auth).

## Firecrawl + Gemini “is it live?”

- **Firecrawl:** Works when `FIRECRAWL_API_KEY` is set; verify with **`GET /api/admin/pulse`** (Basic or gateway auth) or **`GET /api/scrape-sync?postcode=SW1A1AA`** (rate-limited).
- **Gemini:** Works when `GEMINI_API_KEY` is set; Zone calls **`POST /api/zone/content-architect`** from the client after the view model is built.

## Deploy checklist

1. Apply Neon migration `20260511_research_results_user_id.sql`.
2. Set **`DATABASE_URL`**, **`GEMINI_API_KEY`**, **`FIRECRAWL_API_KEY`**, **`CRON_SECRET`** on Vercel (Production + Preview as needed).
3. Deploy the app (`git push` to your default branch if CI deploys to Vercel).
4. From Hermes/VPS, `curl` the cron URL once manually; expect **`200`** JSON with `ok: true` and `results`.
5. Log in on the site, complete onboarding, answer a journey question — confirm **`research_results`** gains rows with **`user_id`** set in Neon.

## Git push

This repository does not push to your remotes automatically. From your machine:

```bash
git add -A && git status
git commit -m "feat: user-scoped research, DB journey hydrate, cron zone-research"
git push origin <your-branch>
```

Use your real remote name (`origin`) and branch (`main` / `production`).
