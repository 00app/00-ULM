# Zero Zero — internal agent config (optional)

The live product uses **Neon** (persistence), **Firecrawl** (scrapes), **Gemini** (structured prose / Zai), and **Vercel Cron** (`/api/cron/zone-research`) — not a separate research gateway.

## Environment (see root `.env.example`)

- **`DATABASE_URL`** — Neon Postgres.
- **`GEMINI_API_KEY`** — Gemini for research triplet + chat.
- **`FIRECRAWL_API_KEY`** — UK grant / supplier page scrapes.
- **`CRON_SECRET`** — Authorizes cron routes and some diagnostics (`Authorization: Bearer …`).
- **`GATEWAY_TOKEN`** — Optional; authorizes internal POST routes such as `/api/zone/tips-inject` and `/api/agents/pulse`.

Legacy `config/openclaw/` paths may still exist on disk from older clones; they are **not** required for the Intelligence Loop in this repo.
