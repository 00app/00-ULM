# Hybrid data pipeline (cost reduction + streaming fidelity)

Full product loop: **`docs/ULM-APPLICATION-LOOP.md`**.

**Principle:** Math and structure are free; raw scrape and LLM analysis cost money.

| Tier | Surface | Premium (Gemini / Firecrawl) |
|------|---------|------------------------------|
| **A** | Profile onboarding (8 steps + postcode) | **None** — Postcodes.io, Carbon Intensity API, optional OpenEPC |
| **B** | Zone grid (`buildZoneViewModel`) | **None** for baseline £/kg on 12 journey tiles |
| **B′** | Cached `research_results` tip copy | **Only if row empty** — surgical seed URL + Gemini triplet |
| **C** | Solo Focus answer (`POST /api/answers`) | **Hybrid spawn** when `MODEL_STRATEGY=bucket_failover` — locked £/kg + editorial Gemini |
| **D** | `/zai` chat | **None** — read-only Neon + genome; no Firecrawl |

## Code map

| Module | Role |
|--------|------|
| `lib/intelligence/nesoGridClient.ts` | Regional gCO₂/kWh (Carbon Intensity API) |
| `lib/intelligence/openEpcClient.ts` | EPC register (needs `OPENEPC_EMAIL` + `OPENEPC_API_KEY`) |
| `lib/intelligence/freeTierHydration.ts` | Tier A parallel hydrate → `user_genome.open_data_anchor` |
| `lib/zone/engineDataRouter.ts` | `processCalculatedLoopSpawn` — deterministic deltas + one discovery card |
| `lib/agents/premiumEditorialExtraction.ts` | Gemini prose only; £/kg passed in as locked facts |
| `lib/brains/buildUserImpact.ts` | Single source of truth for Zone tile £/kg |
| `lib/intelligence/scrapeBoundaries.ts` | `bucket_failover` gates broad scrape |

## Env

```env
MODEL_STRATEGY=bucket_failover   # enables hybrid Solo Focus spawn + scrape gates
# Optional explicit toggle (also on when bucket_failover):
HYBRID_DATA_PIPELINE=1

# OpenEPC (England & Wales) — skip silently if unset
OPENEPC_EMAIL=you@example.com
OPENEPC_API_KEY=your-register-key
```

## Hermes

No VPS change. Hermes still calls `GET/POST /api/cron/zone-research?repair=1` for **backfill** on incomplete `research_results`. Day-to-day discovery is earned in-app (Tier C), not cron.

## Neon

- **`user_genome.open_data_anchor`** — EPC + grid snapshot at postcode hydrate
- **`research_results`** — premium editorial rows with `invokePayload.trigger: hybrid-pipeline`
- Keep **`journey_answers`** + **`journey_answers_jsonb`** (dual-write)

## Run audit

```bash
npm run db:audit
npm run verify
```
