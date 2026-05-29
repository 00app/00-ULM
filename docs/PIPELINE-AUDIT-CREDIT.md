# Pipeline audit — APIs, boundaries, scrape URLs, credit control

Single reference for **how data moves**, **what may trigger paid APIs** (Firecrawl / Gemini), and **hard ceilings**. Code is source of truth; this doc mirrors it for audits.

**Related:** [HANDBOOK.md](HANDBOOK.md) · [HYBRID-DATA-PIPELINE.md](HYBRID-DATA-PIPELINE.md) · [INTELLIGENCE-LOOP-MANIFEST.md](INTELLIGENCE-LOOP-MANIFEST.md) · [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md)

---

## 1. End-to-end pipeline (user → Neon → UI)

```mermaid
flowchart TB
  subgraph onboard [Onboarding — Tier A free]
    P[/profile 8 steps/]
    LI[POST /api/local-intelligence]
    GEO[GET /api/geocode/postcode]
    P --> LI
    P --> GEO
  end

  subgraph zone [Zone — Tier B free maths]
    Z[/zone]
    SS_GET[GET /api/scrape-sync]
    VM[buildZoneViewModel]
    IMP[buildUserImpact]
    Z --> SS_GET
    SS_GET --> VM
    IMP --> VM
  end

  subgraph earn [Earned research — Tier B prime / C]
    ANS[POST /api/answers]
    SS_POST[POST /api/scrape-sync]
    FC[Firecrawl scrape]
    GEM[Gemini triplet]
    NEON[(research_results)]
    ANS --> SS_POST
    SS_POST --> FC
    FC --> GEM
    GEM --> NEON
    NEON --> SS_GET
  end

  subgraph zai [Zai — Tier D read-only]
    ZAI[POST /api/zai]
    ZAI -.->|no Firecrawl| NEON
  end

  onboard --> zone
  zone --> earn
  zone --> zai
```

| Tier | When | Firecrawl | Gemini |
|------|------|-----------|--------|
| **A** | Profile postcode step | No | No |
| **B** | Zone grid £/kg | No | No (uses cached `research_results` if present) |
| **B′** | Empty Neon row | Surgical seed URL(s) only | Triplet on persist |
| **C** | `POST /api/answers` | Category + profile locked | Hybrid / discovery race |
| **D** | `/zai` chat | **Never** | Chat only |
| **Hermes** | Weekly cron repair | `?repair=1` backfill | Repair copy only |

---

## 2. API connection map

### Identity & profile

| Route | Method | Connects to | Credit |
|-------|--------|-------------|--------|
| `/api/user` | POST/GET | Session, `user_profiles` | No |
| `/api/local-intelligence` | POST | Postcodes.io, council context | No |
| `/api/geocode/postcode` | GET | Server Nominatim proxy | No |

### Zone hydrate & research

| Route | Method | Connects to | Credit |
|-------|--------|-------------|--------|
| `/api/scrape-sync` | GET | Neon `research_results`, `scraped[]`, coverage | Read; `?repair=1` may Firecrawl+Gemini |
| `/api/scrape-sync` | POST | `validateSurgicalScrapeContext` → Firecrawl → `persistResearchResult` | **Yes** (surgical) |
| `/api/scrape-sync` | GET `?force=true` | Broad `runZeroResearch` | **Blocked** in `bucket_failover` unless `ALLOW_BROAD_SCRAPE=1` |
| `/api/answers` | POST | `buildUserImpact`, discovery race, optional `triggerScrapeSyncForCategory` | Gemini on race; scrape optional |
| `/api/answers` | GET | Hydrate `journey_answers_jsonb` | No |

### Supplemental (capped)

| Route | Method | Role | Cap |
|-------|--------|------|-----|
| `/api/zone/injections` | POST | Trap follow-up card | 3/journey |
| `/api/research/question-card` | POST | Free-form Ask card | 3/journey |
| `/api/zone/content-architect` | POST | Polish `architect_prose` | Batch/async |
| `/api/zone/tips-refresh` | POST | Refresh tip tiles | Throttled |

### Cron & ops

| Route | Method | Role |
|-------|--------|------|
| `/api/cron/zone-research` | GET/POST | Hermes batch; use `?repair=1` |
| `/api/cron/repair-mechanical` | GET | Backfill £/headline without full crawl |
| `/api/health/diagnostics` | GET | `bucket_failover` status (Bearer `CRON_SECRET` or session) |

### Zai & Sentinel

| Route | Method | Firecrawl | Notes |
|-------|--------|-----------|-------|
| `/api/zai` | POST | **No** | `research_results` URLs/£ only — not `architect_prose` |
| `/api/sentinel` | POST | Optional single gov.uk page | Tip rail only — not main copy path |

### Client CORS rule

Browser **must not** call Ofgem or Nominatim directly. Use `/api/pulse/living`, `/api/geocode/postcode`, `/api/scrape-sync`.

---

## 3. Research path matrix (what births cards vs burns credits)

| Path | Trigger | Firecrawl | Discovery card? | Cap |
|------|---------|-----------|-----------------|-----|
| **`POST /api/answers`** → `injectNewDiscoveryCard` | MC / loop answer | Optional category JIT | **Yes — canonical** | 3/journey |
| **`POST /api/scrape-sync`** (POST body) | Answer, tip +1, dev bootstrap | Surgical | Persists row; may feed VM | Rate 24/min |
| **`GET /api/scrape-sync?repair=1`** | Zone load, Hermes | Backfill missing fields | No inject | Visited skip |
| **`POST /api/zone/injections`** | Trap close | Sometimes | Supplemental | 3/journey |
| **`POST /api/research/question-card`** | Ask Zai free-form | Sometimes | Supplemental | 3/journey |
| **`runRebirthVaultDiscovery`** | Discovery race entrant | Action Vault URLs | Race winner only | — |
| **Sentinel `inject-sentinel-*`** | `useSentinel` | Rare | Tip rail | Not loop birth |
| **Hermes cron** | Weekly | `repair-mechanical` | Backfill Neon | Batch limit |

**Code:** `lib/agents/discoveryBirthRace.ts` · `lib/zone/patternShiftClose.ts` · `lib/zone/visitedCards.ts`

---

## 4. Scrape surfaces (allowed vs forbidden)

**Module:** `lib/zai/chatBoundaries.ts`

### Allowed to trigger JIT scrape

| Surface | Entry |
|---------|--------|
| `zone_answer_loop` | `POST /api/answers` → server discovery / supplemental |
| `tip_verification_plus_one` | `runTipVerificationDeepScrape` |
| `ask_zai_deep_dive_search_deeper` | Deep Dive sheet only |
| `profile_postcode_step` | Profile locality seed |
| `zone_hydration_get` | `GET /api/scrape-sync` read/repair |

### Forbidden (no new Firecrawl)

| Surface | Why |
|---------|-----|
| `zai_chat_turn` | Read Neon + transcript only |
| `zai_chat_continue_in_zai` | Handoff read-only |
| `zai_close_audit_complete` | VM refresh only |
| `visited_card_close` | Pink lock — no inject/scrape burn |

**Assert:** `assertNoScrapeOnZaiChat()` throws if chat tries to scrape.

---

## 5. Surgical scrape gates (`bucket_failover`)

**Module:** `lib/intelligence/scrapeBoundaries.ts`

| Check | Rule |
|-------|------|
| Postcode | ≥ 4 chars, uppercased — **POSTCODE DNA** |
| `journey_key` | Required — **one category per request** (Topic Shield) |
| `profileData` | Required anchor (postcode + profile fields) |
| Broad scrape | `GET ?force=true` and full cron batch **blocked** unless `ALLOW_BROAD_SCRAPE=1` |
| `MAX_ITERATIONS` | Default **5** (env, max 12) |
| `SKIP_FIRECRAWL=1` or missing key | Mechanical + Neon fallback only |
| `shouldSkipDeepGeminiSearch` | True in bucket mode |

**Verify production:**

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  'https://00-ulm.vercel.app/api/health/diagnostics' | jq '.bucket_failover'
```

Expect: `enabled: true`, `broadScrapeAllowed: false`, `skipDeepGemini: true` (when env set).

### Env vars (credit control)

| Variable | Purpose |
|----------|---------|
| `MODEL_STRATEGY=bucket_failover` | Enables surgical gates + provider failover |
| `MAX_ITERATIONS=5` | Caps research loop iterations |
| `ALLOW_BROAD_SCRAPE=1` | **Dev only** — allows `?force=true` |
| `SKIP_FIRECRAWL=1` | No Firecrawl HTTP |
| `FIRE_CRAWL_KEY_2` / `FIRECRAWL_API_KEY` | Firecrawl auth |
| `GEMINI_API_KEY` | Gemini (server-only) |
| `BUCKET_SKIP_GEMINI=1` | Failover skips Gemini |
| `BUCKET_SKIP_DEEP_GEMINI=1` | No second-pass deep search |
| `VERCEL_FORCE_NO_BUILD_CACHE=1` | Optional — clean Vercel build (dashboard checks unrelated) |

---

## 6. ULM ceilings (product + Neon)

**Module:** `lib/zone/ulmLimits.ts` · `lib/intelligence/manifest.ts`

| Ceiling | Value |
|---------|-------|
| Bento cells (hero excluded) | **24** |
| Discovery injects per user per journey | **3** |
| Discovery tips visible per journey on wall | **1** |
| Rock rail cold start | **6** |
| Rock rail absolute max | **12** |
| Cards per category on wall | **2** (design target — `perCategoryCardCap`) |

---

## 7. Scrape URL catalogue (control spend)

Only **HTTPS** seeds below. Surgical POST uses **`buildCategoryFirecrawlSeedUrls`** (`lib/intelligence/researchProfilePayload.ts`) — merges journey seeds + employment + trusted fallback; **max ~8 URLs** per broad `runZeroResearch` batch (`researchAgent.ts`).

### 7.1 Per-journey surgical seeds (`JOURNEY_FIRECRAWL_SEEDS`)

| Journey | URLs (priority order) |
|---------|------------------------|
| **utilities** | MSE switch · Ofgem cap · EST |
| **home** | BUS apply · EST · Which? energy |
| **grants** | BUS · ECO · EST grants |
| **travel** | National Rail railcards · Trainline · gov.uk rail fares |
| **holidays** | Eurostar · Visit Britain · National Rail |
| **food** | Love Food Hate Waste · Which? food |
| **money** | MSE utilities · Warm Home Discount |
| **shopping** | Which? shopping |
| **tech** | Back Market |
| **waste** | gov.uk recycling |
| **water** | Waterwise |
| **solar** | gov.uk solar publication |
| **carbon** | Ofgem |

### 7.2 Trusted CTA fallbacks (`TRUSTED_JOURNEY_URLS`)

**Module:** `lib/zone/trustedJourneyUrls.ts` — used when model omits `offer_url` or sanitizer blocks bad gov paths.

| Journey | Fallback URL |
|---------|----------------|
| home | energysavingtrust.org.uk/reducing-home-heat-loss |
| utilities | moneysavingexpert.com/utilities/how-to-switch |
| grants | gov.uk/apply-boiler-upgrade-scheme |
| solar | mcscertified.com/find-an-installer |
| travel | nationalrail.co.uk/railcards |
| holidays | eurostar.com/uk-en/deals |
| food | lovefoodhatewaste.com |
| shopping | wrap.org.uk/food-waste |
| money | moneysavingexpert.com/utilities/how-to-switch |
| tech | backmarket.co.uk |
| water | waterwise.org.uk/save-water |
| waste | recyclenow.com |
| carbon | carbontrust.com/resources |

Default: `https://www.gov.uk/`

### 7.3 UK 2026 core batch (`UK_2026_SEED_URLS`)

**Module:** `lib/agents/researchAgent.ts` — used in broad research / auditor (max **5** URLs in auditor, **8** in ZeroResearch batch).

| URL |
|-----|
| Ofgem live price cap (see `OFGEM_LIVE_PRICE_CAP_URL` in `scraper.ts`) |
| gov.uk/apply-boiler-upgrade-scheme |
| gov.uk/energy-company-obligation |
| energysavingtrust.org.uk |
| which.co.uk/money/saving-energy |
| moneysavingexpert.com/utilities |
| octopus.energy/blog |
| consumerreports.org/money/energy |

### 7.4 Nine-domain grid seeds (`NINE_DOMAIN_GRID_SEED_URLS`)

**Module:** `lib/agents/nineDomainResearchSeeds.ts` — researcher / grid bootstrap mix.

- ofgem.gov.uk/energy-advice-households/energy-price-cap  
- moneysavingexpert.com/cheapenergyclub  
- moneysavingexpert.com/utilities  
- gov.uk/find-energy-grants-help-pay-bills  
- gov.uk/improve-energy-efficiency  
- gov.uk/energy-company-obligation  
- olioex.com  
- hiyacar.co.uk  
- justpark.com  
- ccwater.org.uk/.../leaks-and-save-water  
- gov.uk/.../recycling-rubbish-waste  
- gov.uk/.../road-freight-logistics-emissions  
- gov.uk/.../vehicle-tax-exemption-for-electric-vehicles  
- moneysavingexpert.com/shopping  

### 7.5 Employment-aware extra seeds

**Module:** `buildEmploymentAwareResearchSeeds` in `researchProfilePayload.ts`

**Employed / not low income:** EST solar/export, Octopus smart/agile/export, cycle-to-work, MSE, Which? energy.

**Unemployed / low income:** Warm Homes Local Grant, ECO, Warm Home Discount, EST grants, find-energy-grants.

**Rule:** Employed users **skip grant-heavy URLs** on non-grants journeys (`skipGrantSeeds`).

### 7.6 Dynamic locality (postcode-driven)

| Pattern | Example |
|---------|---------|
| Local council finder | `gov.uk/find-local-council/{POSTCODE}` |
| Council org page | `gov.uk/government/organisations/{council-slug}` |
| International context | ecologie.gouv.fr (only when user context mentions FR regions) |

### 7.7 Rebirth Action Vaults (`actionVaults.ts`)

Used by **`runRebirthVaultDiscovery`** (race entrant, not default path). Max **5** URLs per vault:

| Vault | Journeys | Hosts |
|-------|----------|-------|
| **A** | home, carbon, waste | Ofgem, gov.uk efficiency/grants/BUS, MSE, EST |
| **B** | travel, holidays, tech | gov.uk EV tax, Hiyacar, Liftshare, Karshare, Turo |
| **C** | food, shopping, money | Olio, Too Good To Go, Ethical Consumer, Freegle, MSE shopping |

### 7.8 Sentinel (adjunct)

- `https://www.gov.uk/energy-advice-households`  
- Scotland heat pump: `homeenergyscotland.org/...` when applicable  

### 7.9 Free-tier APIs (no Firecrawl)

| API | Route | Module |
|-----|-------|--------|
| Carbon Intensity | — | `lib/intelligence/nesoGridClient.ts` |
| Postcodes.io | `/api/local-intelligence` | geocode stack |
| OpenEPC (optional) | profile hydrate | `lib/intelligence/openEpcClient.ts` |
| Ofgem pulse proxy | `/api/pulse/living` | `lib/logic/pulse.ts` |

---

## 8. Visited / pink guards (no credit burn)

| Guard | Module | Behaviour |
|-------|--------|-----------|
| Visited journey keys on repair | `scrape-sync` GET | Skips re-scrape categories already visited |
| `shouldSkipInjectionOnCardClose` | `visitedCards.ts` | No inject on tip close |
| `shouldCloseMarkPinkOnly` | `directorsOrder.ts` | Discovery child → pink, no loop |
| `cardVisitedLock` | Zone page | No follow-up scrape on re-open |
| Rate limit | `scrape-sync` | **24** requests/minute per id |

---

## 9. Solo Focus copy rules (no extra API spend)

| Rule | Code |
|------|------|
| Max **2** prose blocks (H4 lead + 1 Roboto body) | `MAX_SOLO_FOCUS_PROSE_BLOCKS`, `resolveSoloFocusDisplayProse` |
| No third `architectActionLine` in Solo Focus | `shouldShowSoloFocusArchitectActionLine` → false |
| £ in prose → hide payoff duplicate | `proseContainsMoneyStamp`, `shouldOmitPayoffLine` |
| Zai never repeats card 3-beat | `ZAI_READ_ONLY_TRUTH_RULES` |

---

## 10. Audit commands

```bash
npm run verify
npm run db:test
npm run db:log-research
npm run db:audit
export CRON_SECRET="$(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)"
curl -sS -H "Authorization: Bearer ${CRON_SECRET}" \
  'https://00-ulm.vercel.app/api/health/diagnostics' | jq
bash scripts/verify-env-and-health.sh   # BASE_URL=https://00-ulm.vercel.app
curl -sS 'https://00-ulm.vercel.app/api/geocode/postcode?postcode=SW1A1AA' | jq
```

**SQL (Neon):** latest research row per category — see [DEV-TEST-AUDIT.md](DEV-TEST-AUDIT.md).

---

## 11. File index (pipeline code)

| Path | Role |
|------|------|
| `lib/intelligence/scrapeBoundaries.ts` | Bucket / surgical / Firecrawl skip |
| `lib/intelligence/researchProfilePayload.ts` | Per-journey Firecrawl URL builder |
| `lib/agents/researchAgent.ts` | Firecrawl HTTP, persist, UK_2026_SEED_URLS |
| `lib/agents/actionVaults.ts` | Rebirth vault URL sets |
| `lib/zone/trustedJourneyUrls.ts` | CTA fallbacks |
| `lib/zai/chatBoundaries.ts` | Scrape allow/forbid surfaces |
| `lib/researchSyncClient.ts` | Client `triggerScrapeSyncForCategory` |
| `app/api/scrape-sync/route.ts` | Hydrate, repair, POST trigger |
| `app/api/answers/route.ts` | Canonical discovery birth |
| `lib/brains/buildUserImpact.ts` | £/kg engine |
| `lib/zone/buildZoneViewModel.ts` | Zone VM |
| `lib/zone/mechanicalTruth.ts` | COMPUTING vs stream |
| `lib/soloFocusCopy.ts` | Headlines, prose dedupe, max-2 |
