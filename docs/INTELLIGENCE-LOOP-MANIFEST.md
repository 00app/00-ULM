# Zero Zero — Intelligence Loop (project manifest)

Operational contract for infra, data flow, UX, and verification. **Secrets belong only in `.env.local` / Vercel** — never commit passwords or paste them into docs or chat.

**Profile, journey questions, answers, and Zone mechanical truth:** `docs/PROFILE-ANSWERS-ZONE-TECH.md`.

---

## 1. Infrastructure

| Piece | Detail |
|--------|--------|
| **Hermes (Oracle VPS)** | Daily trigger (e.g. **05:00**) → **`GET /api/cron/zone-research`** with header **`Authorization: Bearer <CRON_SECRET>`** (same value as Vercel `CRON_SECRET`). |
| **Neon (London)** | Canonical pooler hostname is **`MANIFEST_NEON_POOLER_HOST`** in `lib/intelligence/manifest.ts`. It **must** match the host inside `DATABASE_URL` (password only via Neon Console / `vercel env`). |
| **Credentials** | Set `DATABASE_URL` (full URI). Do **not** commit real passwords; rotate immediately if exposed. |
| **Firecrawl** | API key: `FIRE_CRAWL_KEY_2` **or** `FIRECRAWL_API_KEY` — both read by `lib/sentinel/api-config.ts` (primary name wins). |
| **Gemini** | `GEMINI_API_KEY` — extraction, Zai, research triplet. |

---

## 2. Scraper and logic loop

- **Firecrawl + Gemini:** Research runs category discovery across **twelve** journey keys in `lib/journeys.ts` (`JOURNEY_ORDER`); locality seeds include Littlehampton / Arun and Les Azerables / Creuse where configured (`lib/agents/researchAgent.ts`).
- **Mechanical truth:** Zone tiles and hero totals only show non-zero £/kg when `journeyHasStreamData` (`lib/zone/mechanicalTruth.ts`) — Neon `research_results`, `scraped_summary`, or scrape-sync repair. Empty DB + postcode → `GET /api/scrape-sync` returns `source: "pending"`, `scraped: []`. UK shape defaults in `lib/scraper/uk2026Defaults.ts` are **zero**, not marketing £.
- **Expansion (canonical birth):** Journey answers in Solo Focus / bento use **`POST /api/answers`** → discovery race → `injectNewDiscoveryCard` when the API returns `new_card_data` / `grid_pulse_card`. **`POST /api/research/question-card`** is the **free-form Ask** path only (not the MC answer birth). **`POST /api/zone/injections`** handles trap follow-ups — all paths share the **`MAX_DISCOVERY_INJECTIONS_PER_JOURNEY`** (**3**) cap per user per journey (`lib/intelligence/manifest.ts`).
- **Data mapping:** On persist, **`saving_amount_gbp`** and **`verified_saving`** are aligned (`lib/agents/researchAgent.ts` → `persistResearchResult`). **`offer_url`** must be HTTPS where possible. Invoke payload JSON is stored in **`research_snapshot`**.

---

## 3. UX / UI

- **Mobile locality:** Long placenames use **`formatSummaryLocalityKineticToken`** (`lib/brains/summaryLogic.ts`) + **`IntroWordCycle`** with **`opacityTicker`** on `/profile/summary` (word-by-word opacity only — no intro glitch). **`/` + `/intro`** keep the logo glitch (Style A). Kinetic order is **HELLO → name → locality** then bridge + waste beats; single-word towns **over seven characters** get Marvin clamp + squeeze (Littlehampton path).
- **Expanded Solo Focus:** **Zai Architect** layout — **Marvin Visions** H1 (**6–12 words** expanded / **6–8 words** zone bento via **`headlineFromTitle`**) + three **Roboto Bold** paragraphs from Neon **`architect_prose`** (≤40 words each, no UI labels; trinity lives only in prose). **`JourneyBentoCard`** + **`SoloFocusOverlay`** + **`lib/soloFocusCopy.ts`**. Gemini **article-tier** triplet in **`lib/agents/researchAgent.ts`** emits **`agent_headline`** + label-free three paragraphs on new research rows (profile-aware editorial framing).
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

See also: **`npm run db:columns`**, **`docs/PROFILE-ANSWERS-ZONE-TECH.md`**.
