# Zero Zero — internal agent config (optional)

The live product uses **Neon** (persistence), **Firecrawl** (scrapes), **Gemini** (structured prose / Zai), and **Vercel Cron** (`/api/cron/zone-research`) — not a separate research gateway.

## Environment (see root `.env.example`)

- **`DATABASE_URL`** — Neon Postgres.
- **`GEMINI_API_KEY`** — Gemini for research triplet + chat.
- **`FIRECRAWL_API_KEY`** — UK grant / supplier page scrapes.
- **`SESSION_SECRET`** — Signs `session` + `zz_sid` cookies and HMAC restore proofs (≥16 chars; required in production).
- **`CRON_SECRET`** — **Cron routes only** (`/api/cron/*`, `Authorization: Bearer …`). Must differ from `SCRAPER_SECRET` in production.
- **`SCRAPER_SECRET`** — **Scrape-sync service triggers only** (`POST /api/scrape-sync` with `force=true`, Hermes lifestyle_shift). Send as `Authorization: Bearer …` or `x-scraper-secret`.
- **`GATEWAY_TOKEN`** — Optional; authorizes internal POST routes such as `/api/zone/tips-inject` and `/api/agents/pulse`.
- **`ADMIN_PASSWORD`** — Basic auth for `/api/admin/*` and `/admin/pulse` (≥16 chars recommended in production).

Legacy `config/` paths from older clones may still exist on disk; they are **not** required for the Intelligence Loop in this repo.
