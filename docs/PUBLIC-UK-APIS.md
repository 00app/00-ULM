# Public UK APIs — zero auth, server-only

All endpoints below require **no API keys**. The browser must **not** call them directly (CORS + policy). Use server routes and `lib/data/*` modules.

**Live smoke:** `npm run test:uk-apis`

**Catalog (usefulness + app wiring):** `lib/data/publicUkApisUsage.ts`

---

## Are they all useful?

| # | API | Useful? | Why |
|---|-----|---------|-----|
| 1 | Carbon Intensity `/intensity` | **High** | Core mechanical truth — live gCO₂/kWh for electric heat, EV, and carbon tile. |
| 2 | Carbon Intensity `/generation` | **High** | Explains *why* intensity moves (wind/solar/gas mix). |
| 3 | EA flood readings | **Medium** | Water **journey** ambient signal only — not household bill £. |
| 4 | Octopus `/products/` | **Medium** | Tariff **catalogue** baseline for utilities JIT — one supplier, indicative. |
| 5 | Octopus Agile `standard-unit-rates` | **High** (electric/mixed) | Half-hourly p/kWh for time-shift copy; useless for gas-only homes. |
| 6 | Air quality (Open-Meteo EAQI fallback) | **Low** | Defra `current-aqi-regional.json` is **404**; app uses Open-Meteo at postcode for optional carbon/travel prose. |

**Skip or deprioritize:** Defra for utilities £ math; EA readings for tariff switching; Octopus products alone without Firecrawl/Gemini offers for verified `saving_amount_gbp`.

---

## How the app uses them

```mermaid
flowchart TB
  subgraph profile [Profile]
    P[home_power GAS/ELECTRIC/MIX]
  end
  subgraph server [Server only]
    U[fetchUtilitiesPublicSnapshot]
    I[fetchUkInfrastructureFeed]
    O[fetchOctopusMarketSnapshot]
    G[formatUtilitiesPublicFeedBlock]
  end
  subgraph consumers [Consumers]
    SS[GET /api/scrape-sync]
    RA[runTriggerResearchForCategory utilities]
    PL[GET /api/pulse/living]
    LD[getLocalData / nesoGridClient]
  end
  P --> U
  U --> I
  U --> O
  U --> G
  G --> RA
  U --> SS
  I --> LD
  PL --> Ofgem HTML
```

### UTILITIES lane (13th card)

1. User sets **power type** on `/profile` → unlocks UTILITIES on `/zone`.
2. **Zone load / JIT:** `GET /api/scrape-sync?postcode=…` returns `utilities_public_feed` when session has `home_power`.
3. Feed includes:
   - `ukInfrastructure` — carbon, generation mix, EA water sample, Defra AQI sample
   - `octopusMarket` — product count + Agile half-hourly slots (electric / mixed only)
   - Postcode-local grid via `nesoGridClient`
   - July 2026 **reference** cap (£1,862 typical dual-fuel) from `lib/brains/constants` (`TRUTH_2026_JULY`); unit p/kWh from same module (not invented from Octopus alone)
4. **Gemini / Firecrawl:** `formatUtilitiesPublicFeedBlock()` is prepended in `runTriggerResearchForCategory` via `buildUtilitiesResearchContext` — lane lock forbids re-asking power type.

### Other journeys

| Journey | APIs loaded | Purpose |
|---------|-------------|---------|
| `carbon` | Infrastructure feed (carbon + mix + Defra) | Grid + air context in prose |
| `water` | EA readings sample | Hydrology ambient — not bill savings |
| `solar` | Generation mix + regional intensity | Export / yield timing |
| `home` | Postcodes + Ofgem constants / pulse | Fabric + cap citations |
| `gas-only utilities` | Infrastructure, **no** Octopus market bundle | Skip Agile when `home_power=GAS` |

### Code map

| Module | Functions |
|--------|-----------|
| `lib/data/ukPublicInfrastructureApis.ts` | `getLiveCarbonIntensity`, `getGenerationMix`, `getLatestWaterReadings`, `getAirQualityData` |
| `lib/data/octopusPublicApis.ts` | `getActiveEnergyProducts`, `getLiveTariffHalfHourlyRates`, `fetchOctopusMarketSnapshot` |
| `lib/data/utilitiesFreeApis.ts` | `fetchUtilitiesPublicSnapshot`, `formatUtilitiesPublicFeedBlock`, `UTILITIES_FREE_API_REGISTRY` |
| `lib/data/publicUkApisUsage.ts` | `PUBLIC_UK_API_CATALOG`, `publicApiBundleForJourney` |

---

## Terminal tests (Cursor)

```bash
npm run test:uk-apis
npm run test:utilities
```

No `.env` keys required for APIs 1–6. Firecrawl/Gemini still need keys for **scraped** £/yr and architect prose.
