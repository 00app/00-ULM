# Zero Zero — Intelligence Loop (project manifest)

Operational contract for infra, data flow, UX, and verification. **Secrets belong only in `.env.local` / Vercel** — never commit passwords or paste them into docs or chat.

---

## 1. Infrastructure

| Piece | Detail |
|--------|--------|
| **Hermes (Oracle VPS)** | Daily trigger (e.g. **05:00**) → **`GET /api/cron/zone-research`** with header **`Authorization: Bearer <CRON_SECRET>`** (same value as Vercel `CRON_SECRET`). |
| **Neon (London)** | Canonical pooler hostname is **`MANIFEST_NEON_POOLER_HOST`** in `lib/intelligence/manifest.ts`. It **must** match the host inside `DATABASE_URL` (password only via Neon Console / `vercel env`). |
| **Credentials** | Set `DATABASE_URL` (full URI). Do **not** commit real passwords; rotate immediately if exposed. |

---

## 2. Scraper and logic loop

- **Firecrawl + Gemini:** Research runs category discovery (nine journey keys in `lib/journeys.ts`); locality seeds include Littlehampton / Arun and Les Azerables / Creuse where configured (`lib/agents/researchAgent.ts`).
- **Expansion (canonical birth):** Journey answers in Solo Focus / bento use **`POST /api/answers`** → discovery race → `injectNewDiscoveryCard` when the API returns `new_card_data` / `grid_pulse_card`. **`POST /api/research/question-card`** is the **free-form Ask** path only (not the MC answer birth). **`POST /api/zone/injections`** handles trap follow-ups — all paths share the **`MAX_DISCOVERY_INJECTIONS_PER_JOURNEY`** (**3**) cap per user per journey (`lib/intelligence/manifest.ts`).
- **Data mapping:** On persist, **`saving_amount_gbp`** and **`verified_saving`** are aligned (`lib/agents/researchAgent.ts` → `persistResearchResult`). **`offer_url`** must be HTTPS where possible. Invoke payload JSON is stored in **`research_snapshot`**.

---

## 3. UX / UI

- **Mobile locality:** Long placenames use **`formatSummaryLocalityKineticToken`** (`lib/brains/summaryLogic.ts`) + **`IntroWordCycle`** with **`opacityTicker`** on `/profile/summary` (word-by-word opacity only — no intro glitch). **`/` + `/intro`** keep the logo glitch (Style A). Kinetic order is **HELLO → name → locality** then bridge + waste beats; single-word towns **over seven characters** get Marvin clamp + squeeze (Littlehampton path).
- **Expanded Solo Focus:** **Zai Architect** layout — **League Gothic** ~20-word **`agent_headline`** (H1) + three **Inter** paragraphs from Neon **`architect_prose`** (no “The What / Why / How” UI labels; trinity lives only in prose). **`JourneyBentoCard`** + **`SoloFocusOverlay`** + **`lib/soloFocusCopy.ts`**. Gemini triplet prompt in **`lib/agents/researchAgent.ts`** emits **`agent_headline`** + label-free three paragraphs on new research rows.
- **CTA:** Expanded cards use **`MotherCardRenderer`** + **`IndustrialHandoffButton`** with **`ctaUrl`** from **`offer_url`** / verified source, falling back to **`/zai`** audit URL when no partner link exists (`JourneyBentoCard`).

---

## 4. Verification

From repo root with **`DATABASE_URL`** in `.env.local`:

```bash
npm run db:log-research
```

Logs the latest **`research_results`** row (including **`saving_amount_gbp`**, **`verified_saving`**, **`architect_prose`**, **`offer_url`**) to the console.

See also: **`npm run db:test`**, **`npm run db:columns`**.
