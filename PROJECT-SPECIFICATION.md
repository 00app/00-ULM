# Zero Zero — Project Specification

**Version:** 1.2  
**Last Updated:** February 2026  
**Status:** Production Locked

Single source of truth for product overview, user flow, design system, data model, calculations, app logic, APIs, and deployment.

---

## 1. Overview

**Zero Zero** is a mobile-first web app that helps people understand and reduce their everyday impact on **money**, **energy**, **carbon**, and **home life**. Users complete a short profile and up to nine “journeys” (home, travel, food, shopping, money, carbon, tech, waste, holidays). The app calculates personalised annual carbon (kg CO₂e) and money (£) impact using UK data and shows a Zone dashboard with a hero total, per-journey cards, and tips.

### Principles

- **Progressive disclosure:** Intro → Profile → Zone → Journeys
- **Single source of truth:** All impact calculations via `buildUserImpact()` in `lib/brains/buildUserImpact.ts`
- **UK data only:** Government and industry sources (DEFRA, Energy Saving Trust, WRAP, etc.)
- **Partial answers supported:** UK averages used when data is missing
- **Real-time updates:** Impact updates as the user answers questions

### Tech Stack

- **Framework:** Next.js (App Router)
- **Database:** Neon PostgreSQL
- **State:** React Context (`AppContext`) + `localStorage` for profile and journey answers
- **Styling:** Tailwind CSS + design tokens in `app/globals.css`

---

## 2. Deploy & Connections

| Service | Details |
|--------|---------|
| **Neon** | Postgres via `DATABASE_URL`; database **neondb** (pooler). Copy `.env.example` → `.env.local`. |
| **Vercel** | Project **00-ULM**; production URL **https://00-ulm.vercel.app**. Set `DATABASE_URL` and `GEMINI_API_KEY` in env. |
| **GitHub** | Remote **origin**: `git@github.com:00app/00-ULM.git`. Push to `main` triggers Vercel deploy. |

**Commands:** `npm run build` (local build), `npm run dev` (http://localhost:3000), `npm run init-db` (schema), `npm run deploy` or `vercel --prod --yes` (deploy).

---

## 3. User Flow

| Step | Route | Description |
|------|--------|-------------|
| 1 | `/intro` | Intro screen (auto-advance) |
| 2 | `/profile` | 6 profile questions (name, postcode, household, home, transport, age) |
| 3 | `/profile/summary` | Profile summary; CTA: “go to zone” |
| 4 | `/zone` | Zone dashboard: hero, Groovy Grid (journey cards + Pulse), tips |
| 5 | `/journeys/[journeyId]` | Journey questions; live summary; then return to Zone |

**Sequence:** Intro → Profile (localStorage + AppContext) → Summary → Zone. Tapping a journey card opens questions; completing them updates Zone hero and cards. Tips are biased by profile age (Junior → tech/food, Retired → home/holidays).

---

## 4. Routes & Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Root (redirect/splash) |
| `/intro` | Onboarding intro |
| `/profile` | Profile setup (6 questions) |
| `/profile/summary` | Profile summary; entry to Zone |
| `/zone` | Main dashboard (hero + Groovy Grid + tips) |
| `/fork` | Fork entry (design-spec entry point) |
| `/journeys` | Journeys list |
| `/journeys/[journeyId]` | Single journey questions & summary |
| `/zai` | Zai chat / assistant |
| `/likes` | Liked cards |
| `/settings` | Settings |

Zone view model: `lib/zone/buildZoneViewModel.ts` (calls `buildUserImpact()`).

---

## 5. Design System

### Colors

- **ICE** #FDFDFF — Surfaces, backgrounds  
- **COOL** #F8F8FE — Buttons, cards  
- **BLUE** #000AFF — Actions, CTAs, headings  
- **DEEP** #141268 — Copy, section labels  
- **PINK** #E80DAD — Completed journey state  
- **Burnt** #0a0a0a — Text on color panels (labels/numbers)  
- **Journey palette:** `--color-j-home` … `--color-j-holidays` in `app/globals.css`; map in `lib/journeyColors.ts`.  
- **60s Groovy:** Atomic Orange, Sunshine Yellow, Paprika, Turquoise (see globals + Tailwind).

### Typography (Groovy scale — stabilized hierarchy)

| Level | Size (Mobile / Desktop) | Font | Usage |
|-------|-------------------------|------|--------|
| **H1** | 100px / 200px | Roboto 900 | Hero totals, Splash titles |
| **H2** | 80px / 120px | Roboto 900 | Section headers (Zone) |
| **DATA** | 60px / 90px | Marvin Visions | Key metrics (£, kg) |
| **LABEL** | 12px / 14px | Marvin Visions | Sub-headers, units, journey names |
| **BODY** | 18px / 20px | Roboto 400 | Descriptions, chat text |

- **Roboto** 900 (headings), 400 (body). **Marvin Visions Bold** for DATA and LABEL (`.text-data`, `.zz-data`, `.zz-label`).

### Spacing

| Token | Value | Usage |
|-------|-------|--------|
| gap-xs/sm/md/lg/xl | 2px–40px | Gaps and section spacing |
| padding-sm/md/lg | 12px–30px | Containers |
| margin-top-xl | 40px | Section labels, “40px below Hero” in expanded cards |

### Components

- **zero-** prefixed classes; 80px circular CTAs; flat design (no shadows).  
- **Groovy Grid:** Asymmetrical 2-column layout; Hero span 2, Pulse span 1, Long (Home/Travel) span 2, Square span 1. Bouncy spring (`--easing-groovy`), 48px radius, twist on press.

---

## 6. Data & Storage

### Client

- **localStorage:** `userId`, `userPostcode`, `profile_name`, `profile_postcode`, `profile_household`, `profile_home_type`, `profile_transport`, `profile_age`, `journey_{id}_answers` (JSON), `completedJourneys`.

### Server

- **Neon PostgreSQL:** `users`, `journey_answers`, `likes`, etc. Sync via `/api/user`, `/api/answers`, `/api/likes`.

### Calculation Engine

- **Entry:** `buildUserImpact(userData)` in `lib/brains/buildUserImpact.ts`  
- **Per-journey:** `lib/brains/calculations.ts` — `calculateHome`, `calculateTravel`, … (one per journey).  
- **Output:** `UserImpact` — `perJourneyResults` (carbon + money + source + explanation), `totals` (annual kg CO₂e, annual £). Scraped overlay via `lib/brains/scrapedOverlay.ts` and optional `scraped` in `buildUserImpact`.  
- **Zone:** `buildZoneViewModel({ profile, journeyAnswers, scraped, localData })` returns hero, journeys, tips.

---

## 7. Profile Questions (6)

**Route:** `/profile`. **Storage:** `profile_*` in localStorage; synced to Neon `users` via `/api/user`.

| # | ID | Question | Type | Options / notes |
|---|----|----------|------|------------------|
| 1 | name | what's your name? | input | — |
| 2 | postcode | your postcode? | input | UK postcode |
| 3 | livingSituation | who do you live with? | options | ALONE, COUPLE, FAMILY, SHARED |
| 4 | homeType | your home? | options | FLAT, HOUSE |
| 5 | transport | how do you get around? | options | WALK, BIKE, PUBLIC, CAR, MIX |
| 6 | age | how old are you? | options | JUNIOR, MID, RETIRED |

**Neon:** `name`, `postcode`, `household`, `home_type`, `transport_baseline`, `age_group`.

---

## 8. Journey Questions (9)

**Source:** `lib/journeys.ts`. **Storage:** `journey_{journeyId}_answers` (JSON); sync via `/api/answers`. **Order:** home, travel, food, shopping, money, carbon, tech, waste, holidays.

### Home (5)

energy_type (GAS|ELECTRIC|MIXED|SOLAR|UNKNOWN), electricity_provider, gas_provider, monthly_cost (number; re-ask if &lt; 10), green_tariff (YES|NO|UNKNOWN).

### Travel (4)

primary_transport (skipped if `profile_transport` exists), fuel_type, distance_amount (number; re-ask if 0), distance_period (WEEK|MONTH).

### Food (2)

diet_type (OMNIVORE|FLEXI|VEGETARIAN|VEGAN), food_waste (LOW|MEDIUM|HIGH).

### Shopping (3)

buy_new (OFTEN|SOMETIMES|RARELY), secondhand (YES|NO), monthly_spend (number; re-ask if &lt; 5).

### Money (2)

finances_tight (YES|NO), biggest_cost (HOUSING|ENERGY|FOOD|TRAVEL).

### Carbon (2)

priority (LOW|MEDIUM|HIGH), tracking (YES|NO).

### Tech (2)

upgrade_often (YES|NO), device_count (FEW|AVERAGE|MANY).

### Waste (2)

recycle (ALWAYS|SOMETIMES|NEVER), compost (YES|NO).

### Holidays (2)

fly_frequency (NEVER|YEARLY|OFTEN), long_haul (YES|NO).

---

## 9. Calculation Logic

**Single source of truth:** `lib/brains/calculations.ts`. Rules: annual values only (kg CO₂e/year, £/year); money and carbon ≥ 0; rounded; source always present.

### Summary

- **Home:** Carbon from annual spend × 0.45; +400 kg if not green/Octopus. Money: +£120 if no green tariff; +£180 if provider switch. UK fallback monthly_cost £120.  
- **Travel:** Carbon = milesPerYear × factor (PETROL 0.404, DIESEL 0.447, ELECTRIC 0.05, etc.). Money: £300 if CAR. Fallbacks: 50 miles, WEEK.  
- **Food:** Carbon by diet (VEGAN 800 … OMNIVORE 1800 kg). Money: waste HIGH £300, MEDIUM £150.  
- **Shopping:** Carbon = annualSpend × 2.5; money by buy_new (OFTEN 20%, etc.). Fallback monthly_spend £200.  
- **Money:** £250 if finances_tight YES.  
- **Carbon:** 300 kg if tracking NO.  
- **Tech:** 400 kg / £200 if upgrade_often YES.  
- **Waste:** Carbon by recycle (NEVER 350 … ALWAYS 0); £100 if compost NO.  
- **Holidays:** Carbon by fly_frequency (OFTEN 2000 … NEVER 0); money by long_haul.

**General cards** (profile-only, for Zone “act now.”): general home living, general transport, general home extra — formulas in `calculations.ts`.

---

## 10. App Logic

### Deduplication

- **Travel:** If `profile_transport` in localStorage, skip first question `primary_transport` and use profile value.  
- **Home:** Prefill `home_type` from `profile_home_type` when present.

### Completion

- **Sheet “Start learning”:** Hidden when `isJourneyComplete` or when `journey_{journey}_answers` exists in localStorage.  
- **Completed journeys:** Stored in `completedJourneys` (localStorage); used for progress and Zone display.

### Zone View Model

- **Input:** Profile + all journey answers (+ optional `scraped`, `localData`).  
- **Hero:** Totals; hero journey = max by `carbonKg×0.6 + moneyGbp×0.4`.  
- **Journey cards:** One per journey in `JOURNEY_ORDER`; general cards from profile.  
- **Tips:** Top 3 by impact with **age persona boost** — JUNIOR: tech/food +600; RETIRED: home/holidays +600; MID: no boost.

### Sheet CTA Row

Order: [Start learning] (if shown) → [Action] (if actionUrl) → [Heart] → [Learn]. Heart toggles like via `/api/likes`; haptic success on save.

---

## 11. API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/health | Database connectivity |
| POST | /api/user | Create/update user profile |
| POST | /api/answers | Save journey answer |
| POST | /api/journey | Update journey state |
| GET | /api/cards | Card definitions |
| GET / POST | /api/likes | Get or toggle liked cards |
| GET | /api/space | Space items (6) |
| GET | /api/summary | Summary data |
| GET | /api/analytics | Analytics |
| GET | /api/local-offers | Local offers (postcode) |
| GET | /api/local-intelligence?postcode= | Postcodes.io + Carbon Intensity (council, localCarbonG) |
| GET / POST | /api/scrape-sync | Scraped 2026 data |
| POST | /api/zai | Zai chat (Gemini 2.0 Flash) |
| GET | /api/zone | Zone data |
| GET | /api/journey | Journey data |
| POST | /api/reset | Reset |

---

## 12. Key Files

| Area | Files |
|------|--------|
| Questions & structure | `lib/journeys.ts`, `lib/journeys/lockedQuestions.ts`, `app/profile/page.tsx` |
| Calculations | `lib/brains/buildUserImpact.ts`, `lib/brains/calculations.ts`, `lib/brains/scrapedOverlay.ts` |
| Zone & tips | `lib/zone/buildZoneViewModel.ts`, `app/zone/page.tsx` |
| Journey colors | `lib/journeyColors.ts`, `lib/journeyColorMap.json` |
| State & sync | `app/context/AppContext.tsx`, `/api/user`, `/api/answers` |
| Flow | `app/intro/page.tsx`, `app/profile/page.tsx`, `app/profile/summary/page.tsx`, `app/journeys/[journeyId]/page.tsx` |
| Local / scraped | `lib/local/getLocalData.ts`, `lib/scraper/uk2026Defaults.ts` |

---

## 13. S Update (Feb 2026)

- **Economic-first:** Zone cards lead with £ when money saving &gt; carbon; 5s flip £/kg. Scraped defaults: Warm Homes (£0 cost), EV £500 grant, Food £1k/yr, Carbon £117 cap drop.  
- **Local Living:** Postcodes.io + Carbon Intensity via `/api/local-intelligence`; council + regional gCO₂/kWh; “Local” tag (Home/Travel); Local Context Bar 40px below Hero; “Claim Offer” 80px with GOV.UK deep-link.  
- **Expanded card:** Hero (slot-machine count-up) → Local Context Bar (40px) → scraped offer (.text-data, 40px) → 80px CTA. Squish (scaleY 0.8), heavy haptic; spring expand; light haptic on settle. Priority: Home + council → pulsing gold border; 80px can pulse green.  
- **Zai:** Context includes postcode → council; haptic success on save to Likes.

---

## 14. Groovy Grid (60s Zone)

- **Layout:** 2-column asymmetrical grid. Hero span 2 (full width); Pulse (live carbon) span 1 when `localCarbonG` set; Home/Travel span 2 (Long); other journeys span 1 (Square).  
- **Palette:** Atomic Orange (hero), Turquoise (pulse), journey colors.  
- **Kinetics:** `.bento-card-groovy` — 48px radius, bouncy spring (`--easing-groovy`), `:active` scale(0.92) rotate(-1deg). Journey cards with `groovy` use same spring and twist on press; expanded state floods with card color.

### Card expansion and collapse (fixed, in-place)

- **Single data per card (no bouncing):** Each journey card shows **one** stable view: **money and carbon together** (e.g. £ and kg CO₂e side by side or stacked), at a **reduced size** so both fit in the collapsed card. No 5s flip between two values — no cards “bouncing” between different data.
- **Fixed expansion:** Tapping a card expands it **in place**. The expanded card fills a defined portion of the grid (e.g. full width, min height); it does not open as an overlay.
- **Grid reflow:** When a card expands, **all other cards move out of the way** (reflow) to make space; the grid layout updates (e.g. expanded cell gets `grid-column: 1 / -1`) and sibling cells wrap or shift with layout animation.
- **Pop-back:** When the user closes the expanded card, it collapses and **all cards pop back into place**; the grid returns to its previous layout with the same layout animation so nothing “jumps” or shows duplicate data.
- **Implementation:** `app/zone/page.tsx` (single `expandedCardId`); `app/components/JourneyBentoCard.tsx` (kinetic grid: collapsed = money + carbon together, no flip; expanded = full content). CSS: `.card-expanded` spans full width; Framer `layout` + `layoutId` on grid and cards for reflow and pop-back.

### Route-specific polish

- **`/profile/summary`:** Final “Audit” before Zone. Hero numbers use **DATA** scale (60/90px); stacked 60s-colored panels (48px radius); “Go to Zone” = massive screen-wide pill in **BLUE** (#000AFF).
- **`/zone`:** Collapsed cards: **white** text; expanded: **white** background, text in **journey color**. Data pairing: £ and kg at **LABEL** size (no flip). Reflow spring: stiffness 500, damping 30.
- **`/zai`:** Immersive **ICE** (#FDFDFF) screen. Message bubbles: **32px** radius. **Agent (Zai)** responses: **BLUE** background for prominence.

### Unified Kinetic “Total Screen Bloom”

- **Expansion:** Tapping a card or nav icon (Zone, Zai, Settings, Likes) triggers a `layoutId` transition. The element expands to **100vw × 100vh**, pushing the rest of the app out of view (no standard overlays).
- **Pop-back:** Closing uses a high-tension spring (`stiffness: 500`, `damping: 30`) so content “pops back” into its 80px circular anchor or grid cell. CSS: `.bloom-expansion`, `--spring-bloom` / `--spring-bloom-damping` in `app/globals.css`.
- **Uniformity:** Same physics for `/zone` (card expand), `/zai`, `/settings`, `/likes` — each can “bloom” from its nav icon into a full-screen immersive panel (ICE for Zai, journey color for Zone cards).

---

## 15. Setup

1. **Prerequisites:** Node.js 18+, Neon Postgres.  
2. **Install:** `npm install`.  
3. **Env:** Copy `.env.example` → `.env.local`; set `DATABASE_URL`, `GEMINI_API_KEY`.  
4. **DB:** `npm run init-db`.  
5. **Run:** `npm run dev` → http://localhost:3000.  
6. **Build:** `npm run build`.  
7. **Deploy:** `npm run deploy` or `vercel --prod --yes`; set env vars in Vercel.

**Troubleshooting:** If DB fails, check `DATABASE_URL` and `npm run init-db`. If build fails, run `npm run lint`.

---

## 16. S Update Master Layer — Physicality & Live Orchestration

The UI is a **singular mechanical organism**: same squish-bloom logic everywhere, real-time local data, production-locked typography.

### Kinetic Anchor Navigation

- **Living dock:** `FloatingNav` uses **80px** perfect circles (not 54px). Tap = squish (scale 0.92); navigation “blooms” into full-screen (router + layoutId).
- **Active states:** If Zai has a new scraped tip, the chat circle **pulses** with `var(--color-blue)` and a slow liquid wobble (`hasNewTipForZai` prop).
- **Haptic gravity:** On hover, circles slightly “lean” (scale 1.08) via Framer Motion; spring `stiffness: 500`, `damping: 30`.

### Impact Scale (Typography)

| Element | Rule |
|--------|------|
| **Hero Totals** | **200px** (desktop) / **100px** (mobile) Marvin Visions Bold. Classes: `.hero-total`, `.zone-hero-total`. |
| **Bento Numbers** | **DATA 50px** (`.bento-data`). On expand, numbers “slot machine” count up from 0 to target. |
| **Labels** | **LABEL 10px** (`.zz-label`) all-caps Marvin Visions — technical markers. |
| **Reverse-Out** | Expanded cards: white background, journey-colored text for legibility. |

### Proportional Impact Card & Deep Content

- **Collapsed card:** Background is a **live bar**: top = **Atomic Orange** (Money), bottom = **Turquoise** (Carbon). Proportion = `moneyGbp / (moneyGbp + carbonKg)` so the bigger “win” fills more height. **White** text (Marvin Visions Bold); Money value in top section, Carbon in bottom.
- **Push-aside expansion:** Tap → card expands in place (`grid-column: 1 / -1`); siblings reflow down. **Reverse-Out:** background floods to **White**, text to journey color.
- **Deep content stack (expanded):** (1) **Top Hero** — £ and kg, H1 Marvin Visions. (2) **40px down** — Scraped offer / local tip, BODY Roboto 400. (3) **Action Row** — **Trinity of 80px circles:** **ACTION** (BLUE, “Claim”/“Go”), **LIKE** (ICE + heart icon), **LEARN** (COOL, external link). Groovy spring `stiffness: 500`, `damping: 30`, `mass: 1`; squish-effect on buttons: `whileTap: { scaleX: 1.15, scaleY: 0.85 }`, spring 600/15.

### Real-Time Local Living Feed

- **Grid Pulse:** When local grid intensity **&lt; 50 gCO₂/kWh**, the Carbon/Pulse bento gets a 2px `var(--color-blue)` border and subtle glow (`.grid-pulse--low-carbon`).
- **Grant alerts:** 001 Crawler can inject council-specific grants (e.g. £12,000 Fully Funded Solar). Shown **40px below** Hero in Home card via `localContextBar`; “Claim Offer” = 80px circle deep-linking to GOV.UK.
- **ScrapedOverlay grant weighting:** `ScrapedDataPoint.local_grant_gbp` is added to `moneyGbp` in the user’s final impact score so local grants are weighted correctly. `lib/brains/scrapedOverlay.ts` exposes `localGrantGbp` on the result for UI (e.g. “Claim £12,000”).

### Production Stability

- No images in core flow; no shadows; locked 2-column grid. **Production Locked** for February 2026 launch.
