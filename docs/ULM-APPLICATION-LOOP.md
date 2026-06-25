# Zero Zero (00-00) — ULM application loop

Production blueprint: **free API intercept → deterministic engine → surgical premium tier**.  
Zai is the **only** product bot (no secondary chat widget).

**Code map:** `lib/zone/ulmLimits.ts`, `lib/zone/engineDataRouter.ts`, `lib/intelligence/freeTierHydration.ts`, [HYBRID-DATA-PIPELINE.md](HYBRID-DATA-PIPELINE.md), [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md), [SENTINEL.md](SENTINEL.md), [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md), [ZAI-AND-QUESTIONS-RULES.md](ZAI-AND-QUESTIONS-RULES.md).

---

## Credit guardrails (enforced)

| Layer | Cost | Modules |
|-------|------|---------|
| Free intercept | 0 tokens | `openEpcClient`, `nesoGridClient`, `pvgisClient`, `defraWasteClient`, `getLocalData` |
| Deterministic £/kg | 0 tokens | `buildUserImpact`, `engineDataRouter` deltas |
| Premium | Gemini + capped Firecrawl | `premiumEditorialExtraction`, Deep Dive **Search deeper** only |

**Hermes:** weekly `repair=1` backfill only — no change when ULM ships.

---

## Hard ceilings (`lib/zone/ulmLimits.ts`)

| Constant | Value |
|----------|-------|
| `MAX_ZONE_BENTO_CELLS` | **24** (journey + tip cells; hero excluded) — `clipGroovyGridToCeiling` |
| `MAX_DISCOVERY_INJECTIONS_PER_JOURNEY` | **3** per `journey_key` |
| `INITIAL_ROCK_SAVING_TIPS` | **6** (rotation seeds) |
| `MAX_ROCK_SAVING_TIPS_RAIL` | **12** |
| `ULM_KWH_PER_TONNE_CO2E` | **12_000** (12k/1t auditor copy) |

Grid discovery tips on wall: still **1 earned inject per category** via `perCategoryCardCap` (13 journeys + injects ≤ 24).

---

## 1. Profile (`/profile`)

- 8 steps → `buildUserImpact` baseline; no Gemini/Firecrawl on onboarding.
- Postcode step: optional **house number** (`profile_house_number`) on the same screen — disambiguates OpenEPC rows when a postcode has multiple dwellings.
- Postcode (+ optional house number) → `POST /api/local-intelligence` (`house_number` in body; GET `?house_number=`) → `hydrateFreeStructuralContext` → `fetchOpendataEpcProfile(postcode, { houseNumber })` → `user_genome.open_data_anchor`.
- When EPC `addressMatched` and `home_type` unset, onboarding may pre-select **FLAT** / **HOUSE** from register `propertyType` (`lib/epc/mapEpcToProfileHints.ts`) — user can override on the next step.
- Motion: `STACCATO_TWEEN` questions; summary uses `IntroWordCycle` / `opacityTicker`.

---

## 2. Zone (`/zone`)

- **Vertical stack (DOM):** welcome → profile hero card → **today's tips** heading + Rock rail → **recommendations** heading + category bento → mobile signup. Headings live in `zone-rock-strip` / `zone-category-wall` — **not** inside `groovy-zone-grid`. Gates: `wallSectionsReady` + `zoneRevealCount >= 1` (`app/zone/page.tsx`). Test ids: `zone-section-welcome`, `zone-section-today-tips`, `zone-section-recommendations`, `zone-section-signup`.
- **13 domains:** `JOURNEY_ORDER` in `lib/journeys.ts` (`home` → `utilities` → … → `carbon`). All 13 mother tiles render in the recommendations grid; **utilities** stays `COMPUTING` until profile **power type** is set (`lib/zone/utilitiesZoneUnlock.ts`).
- **Grid order:** `buildGroovyGridItems` (`lib/zone/gridOrder.ts`) — hero excluded; mothers sorted by goal-weighted £ then `JOURNEY_ORDER`; discovery `inject-*` tips nest after parent; **max 2 cells/category**, **24 cells** total ceiling.
- **Mechanical truth:** empty Neon → `COMPUTING — JOURNEY` / `—`; no fake £.
- **Visited:** `visited_cards` → pink `#FF00FF` / yellow `#FDFD00` (`.zone-card--visited`).
- **Rock rail:** navy + yellow; 6-slot rotation; display capped at 12; grid titles from catalog (`clampRockTipHeadline`); rail excludes wall headline duplicates (`prepareRockHabitsForRail`).
- **Nav:** `ZoneDesktopNavRail` + `<Link>` routes from **768px**; floating nav hidden on Zone at same breakpoint.

---

## 3. Loop & spawn

- **1 card = 1 question** — Solo Focus isolation.
- **POST /api/answers** → exactly **one** discovery card in JSON; hybrid race when `MODEL_STRATEGY=bucket_failover`.
- **Zip-shut** → next loop beat (`ZIP_SHUTTER_SPRING`).
- **Visited close guard:** `shouldSkipInjectionOnCardClose` — no inject/scrape on tip close.

---

## 4. Headlines (`lib/soloFocusCopy.ts`)

| Surface | Words |
|---------|-------|
| Zone bento | **5–8** — `enforceHeadlineWordLimits(text, false)` |
| Today's Tips grid | **3–10** — `clampRockTipHeadline` (catalog title; not wall hook) |
| Solo Focus / expanded hook (mother) | **20–24** — `headlineFromExpandedHook` + `EXPANDED_JOURNEY_HOOK` when weak; else `enforceHeadlineWordLimits(text, true)` |
| Solo Focus / expanded hook (Rock) | **20–24** — `headlineFromRockHabit(title, insight)` — **no** `EXPANDED_JOURNEY_HOOK` |
| Solo Focus Marvin lead | **≤30** — `resolveSoloFocusDisplayProse`; `buildAuditorDetectionParagraph` when lead lacks town opener |
| Prose beats | ≤ **40** words / paragraph |

Full scrape → copy → presentation pipeline: **[ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md)**.

---

## 5. Zai (`/zai`)

- **Persona:** active auditor with a pint — `ZAI_PERFORMANCE_AUDITOR_V3_MATRIX` in `lib/brains/zai/prompts.ts`.
- **Read-only chat:** no Firecrawl on `POST /api/zai`.
- **JIT scrape exception:** `AskZaiDeepDiveSheet` → **Search deeper** only.
- **Stream UI:** `postZaiChat` + `readZaiStream` (not a floating third-party bot).
- **Fallback:** `i don't have enough information to be confident on that one. let's stick to your bills or travel moves.`

---

## Env

```env
MODEL_STRATEGY=bucket_failover
HYBRID_DATA_PIPELINE=1
OPENEPC_EMAIL=
OPENEPC_API_KEY=
```

---

## Verify

```bash
npm run verify
npm run db:audit
```
