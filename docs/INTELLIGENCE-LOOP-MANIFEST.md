# Zero Zero — Intelligence Loop (project manifest)

Operational contract for infra, data flow, UX, and verification. **Secrets belong only in `.env.local` / Vercel** — never commit passwords or paste them into docs or chat.

**Profile, journey questions, answers, and Zone mechanical truth:** [PROFILE-ANSWERS-ZONE-TECH.md](PROFILE-ANSWERS-ZONE-TECH.md). **Zone scrape → copy → presentation:** [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md). **Sentinel (parallel):** [SENTINEL.md](SENTINEL.md). **Gary / rebirth / inject paths:** [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md). **Index:** [HANDBOOK.md](HANDBOOK.md).

---

## 1. Infrastructure

| Piece | Detail |
|--------|--------|
| **Hermes (Oracle VPS) / Vercel Cron** | **Weekly** Monday **05:00** (`0 5 * * 1`) → **`GET /api/cron/zone-research`** with **`Authorization: Bearer <CRON_SECRET>`**. Per-category JIT scrape still fires on Solo Focus Tip +1 answer. |
| **Neon (London)** | Canonical pooler hostname is **`MANIFEST_NEON_POOLER_HOST`** in `lib/intelligence/manifest.ts`. It **must** match the host inside `DATABASE_URL` (password only via Neon Console / `vercel env`). |
| **Credentials** | Set `DATABASE_URL` (full URI). Do **not** commit real passwords; rotate immediately if exposed. |
| **Firecrawl** | API key: `FIRE_CRAWL_KEY_3` → `FIRE_CRAWL_KEY_2` → `FIRECRAWL_API_KEY` (`lib/sentinel/api-config.ts`). `SKIP_FIRECRAWL=1` disables scrapes (mechanical fallbacks only). |
| **Gemini** | `GEMINI_API_KEY` — extraction, Zai, research triplet. |

---

## 2. Scraper and logic loop

- **Firecrawl + Gemini:** Research runs category discovery across **twelve** journey keys in `lib/journeys.ts` (`JOURNEY_ORDER`); locality seeds include Littlehampton / Arun and Les Azerables / Creuse where configured (`lib/agents/researchAgent.ts`).
- **Mechanical truth:** Zone tiles and hero totals only show non-zero £/kg when `journeyHasStreamData` (`lib/zone/mechanicalTruth.ts`) — Neon `research_results`, `scraped_summary`, or scrape-sync repair. Empty DB + postcode → `GET /api/scrape-sync` returns `source: "pending"`, `scraped: []`. UK shape defaults in `lib/scraper/uk2026Defaults.ts` are **zero**, not marketing £.
- **Expansion (canonical birth):** Journey answers in Solo Focus / bento use **`POST /api/answers`** → discovery race → `injectNewDiscoveryCard` when the API returns `new_card_data` / `grid_pulse_card`. **`POST /api/research/question-card`** is the **free-form Ask** path only (not the MC answer birth). **`POST /api/zone/injections`** handles trap follow-ups — all paths share the **`MAX_DISCOVERY_INJECTIONS_PER_JOURNEY`** (**3**) cap per user per journey (`lib/intelligence/manifest.ts`).
- **Data mapping:** On persist, **`saving_amount_gbp`** and **`verified_saving`** are aligned (`lib/agents/researchAgent.ts` → `persistResearchResult`). **`offer_url`** must be HTTPS where possible. Invoke payload JSON is stored in **`research_snapshot`**.

---

## 3. UX / UI

Presentation contract (bento headlines, three-paragraph Solo Focus, Today's Tips rail, offer URL guards, tone): **[ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md)** §6–10.

- **Mobile locality:** Long placenames use **`formatSummaryLocalityKineticToken`** (`lib/brains/summaryLogic.ts`) + **`IntroWordCycle`** with **`opacityTicker`** on `/profile/summary` (word-by-word opacity only — no intro glitch). **`/` + `/intro`** keep the logo glitch (Style A). Kinetic order is **HELLO → name → locality** then bridge + waste beats; single-word towns **over seven characters** get Marvin clamp + squeeze (Littlehampton path).
- **Expanded Solo Focus:** **Marvin** hook H1 (**20–24 words** — **`headlineFromExpandedHook`** + per-journey **`EXPANDED_JOURNEY_HOOK`** when title is thin) + **Marvin H4 lead** (**≤30 words**; town from **`locationState.locationName`**, not postcode) + optional **Roboto** body (max 2 prose blocks; metrics row owns £/CO₂). Zone bento: **5–8 words** via **`headlineFromTitle`**. Voice: **`lib/zone/zoneVoice.ts`**. Gemini triplet in **`lib/agents/researchAgent.ts`** → **`architect_prose`**; locality fallbacks are warm UK prose (no CTA-bridge scaffolding).
- **CTA:** Expanded cards use **`MotherCardRenderer`** + **`IndustrialHandoffButton`** with **`ctaUrl`** from **`offer_url`** / verified source, falling back to **`/zai`** audit URL when no partner link exists (`JourneyBentoCard`).

---

## 4. Verification

From repo root with **`DATABASE_URL`** in `.env.local`:

```bash
npm run db:log-research      # latest research_results row
npm run db:test              # Neon connectivity
npm run db:evolve-12-domains # journey_questions for all 12 keys
```

**Honest empty Zone (production smoke):**

```bash
curl -sS "https://00-ulm.vercel.app/api/scrape-sync?postcode=BN17" | jq '.source, (.scraped | length), .research_category_coverage'
# pending + 0 scraped rows + {} coverage  ⇒  UI should show COMPUTING tiles, not £12.5k
```

**Fill stream (server; use your Bearer secret, single-quoted in zsh):**

```bash
bash scripts/curl-scrape-sync-trigger.sh https://00-ulm.vercel.app BN17
```

Logs the latest **`research_results`** row (including **`saving_amount_gbp`**, **`verified_saving`**, **`architect_prose`**, **`offer_url`**) via **`npm run db:log-research`**.

See also: **`npm run db:columns`**, **[PROFILE-ANSWERS-ZONE-TECH.md](PROFILE-ANSWERS-ZONE-TECH.md)**.
