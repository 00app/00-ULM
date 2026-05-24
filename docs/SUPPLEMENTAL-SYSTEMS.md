# Supplemental systems — Gary mode, pattern shift, rebirth vault, research paths

Short reference for **systems that sit beside** the main Zone content pipeline ([ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md)) and Sentinel ([SENTINEL.md](SENTINEL.md)). No duplicate of those specs — only what is easy to miss.

---

## 1. Research path matrix

| Path | Trigger | Births discovery card? | Cap |
|------|---------|------------------------|-----|
| **`POST /api/answers`** → `raceDiscoveryBirth` / `injectNewDiscoveryCard` | Solo Focus / bento answer | **Yes — canonical** | `MAX_DISCOVERY_INJECTIONS_PER_JOURNEY` (3) |
| **`triggerSupplementalResearch`** | After answer (sync or void), tips-refresh, gateway | Persists `research_results`; may feed VM, not always grid inject | Same manifest caps when inject |
| **`POST /api/research/question-card`** | Free-form Ask | Supplemental inject | Capped |
| **`POST /api/zone/injections`** | Trap / pattern follow-up | Supplemental | Capped |
| **`runRebirthVaultDiscovery`** | Discovery race participant in answers route | Optional high-impact tip card | Race winner only |
| **Sentinel `inject-sentinel-*`** | `useSentinel` on Zone | Tip rail only | Not loop-answer birth (`perCategoryCardCap`) |
| **Hermes cron** | `repair-mechanical` / `zone-research` | Backfill Neon rows | Server batch |

---

## 2. Gary / demo mode

**Module:** `lib/zone/garyMode.ts`

| Constant | Value |
|----------|--------|
| `GARY_RESEARCH_USER_ID` | `00000000-0000-4000-a000-000000000000` |
| Activation | Postcode **`BN17*`** or `zz_gary_mode=1` in localStorage |

**Behaviour:**

- Scrape-sync GET/POST append **`user_id`** so BN17 testers share one Neon research partition
- `ensureClientResearchUserId` mints or reuses UUID for trigger POSTs without session
- **`ZoneIntelligenceStrip`** (dev FAB) polls with Gary `user_id` when active

**Ops:** `npx tsx scripts/link-gary-bn17-research.ts` — relink orphan `research_results` rows (uses `DATABASE_URL` only).

**Handbook:** [HANDBOOK.md](HANDBOOK.md) § Data & view model (Gary / demo identity).

---

## 3. Pattern shift close

**Module:** `lib/zone/patternShiftClose.ts`

When user closes Solo Focus from a **visited** card (`visitedClose: true`):

- **No** loop takeover question on the Zone shell
- **No** `spawnAchievementWhenLoopPoolExhausted`
- **No** `/api/zone/injections` from close path

**UI:** `app/zone/page.tsx` — `patternShiftJourneyId` overlay for non-visited close flow; `JourneyBentoCard` / `SoloFocusOverlay` pass `onPatternShiftClose`.

Credit guard aligned with [ZAI-AND-QUESTIONS-RULES.md](ZAI-AND-QUESTIONS-RULES.md) (visited flip + close credit guard).

---

## 4. Rebirth vault discovery

**Module:** `lib/agents/rebirthVaultDiscovery.ts`

Optional **discovery race** entrant from `POST /api/answers` (`discoveryBirthRace.ts`):

- Firecrawl **Action Vault** URLs per journey (`lib/agents/actionVaults.ts`)
- Gemini pro profile (**12k/1t** auditor framing) → high-impact `ZoneTipCard`
- Persists `research_results` with **`is_high_impact`**
- Models: `GEMINI_REBIRTH_MODEL` or fallback `gemini-1.5-flash`

**Not** the default birth path — runs in parallel race; first valid payload wins inject.

---

## 5. Tier 2 mother/child swap

**Module:** `lib/zone/tier2RecursiveSpawner.ts`

After a **child** Solo Focus answer (mother/child morph deck):

1. `persistTier2AnswerLocal`
2. Scoped **`GET /api/scrape-sync`** with `category`, `answer`, `question_id`, optional `repair=1`
3. `buildTier2MorphCard` → morph deck append
4. `refreshZoneTotalsAfterTier2` + `zz-tier2-profile-refresh` event

**Tip +1:** `lib/zone/tipVerificationDeepScrape.ts` — same scrape-sync with **repair** pass (Estimated → Verified).

**Handbook:** [HANDBOOK.md](HANDBOOK.md) § Tier 2 mother/child swap.

---

## 6. Discovery birth race

**Module:** `lib/agents/discoveryBirthRace.ts`

`POST /api/answers` may race:

- Standard discovery pipeline
- Optional **`rebirthVault`** callback
- Hybrid spawn (`lib/zone/engineDataRouter.ts` when `bucket_failover`)

First successful **`DiscoveryBirthPayload`** → response `new_card_data` / `grid_pulse_card` → client **`injectNewDiscoveryCard`**.

---

## 7. Content Architect (async polish)

Not supplemental — **primary presentation polish** after VM build. Documented in **[ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md)** §9.

Client: fingerprinted batch per Zone load (`architectBatchKeyRef`) to avoid duplicate Gemini spend.

---

## 8. Zone UI adjuncts

| Component | Role |
|-----------|------|
| **`ZoneAskZaiDock`** | Fixed Ask Zai entry on Zone (portal / dock) |
| **`AppFloatingNav`** | Likes, Zai, Settings — portaled nav |
| **`FixedViewportPortal`** | Overlay mounting for fixed UI |
| **`ZoneIntelligenceStrip`** | Dev scrape-sync poll (Gary-aware) |

---

## 9. Fallback tips

**Module:** `lib/zone/fallbackZoneTips.ts`

Server-only tip payloads when research/inject paths fail — used by `app/api/zone/tips-refresh` and `injections` (not exported from route files — Next.js 16 route export rule).

---

## 10. Related docs

| Doc | Topic |
|-----|--------|
| [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) | Scrape, copy, cards, tone |
| [SENTINEL.md](SENTINEL.md) | Sentinel live layer |
| [HYBRID-DATA-PIPELINE.md](HYBRID-DATA-PIPELINE.md) | Cost tiers |
| [ULM-APPLICATION-LOOP.md](ULM-APPLICATION-LOOP.md) | Ceilings, spawn |
| [ZAI-AND-QUESTIONS-RULES.md](ZAI-AND-QUESTIONS-RULES.md) | Boundaries + questions |
| [HANDBOOK.md](HANDBOOK.md) | Index + ops |

---

*Update when adding new inject paths, demo modes, or discovery race entrants.*
