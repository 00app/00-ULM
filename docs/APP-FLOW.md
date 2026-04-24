# Zero Zero — App Flow

**Last Updated:** March 24, 2026

This file is a focused flow reference for how users move through the product.
For full implementation detail, use `PROJECT-SPECIFICATION.md`.

## 1) Entry and Intro

- Route: `/` (renders intro flow)
- Route: `/intro` (explicit intro route)
- Intro sequence:
  1. Glitch logo
  2. Value word cycle
  3. "use less more" cycle
  4. Decision screen: **Create** or **Skip**

## 2) Profile Path

- Route: `/profile`
- User answers 6 profile questions (name, postcode, household, home type, transport, age)
- Route: `/profile/summary`
- CTA sends user to Zone

## 3) Skip Path

- From intro decision, **Skip** goes directly to `/zone`

## 4) Zone (Main Dashboard)

- Route: `/zone`
- Zone is the primary persistent dashboard
- Core areas:
  - Hero totals
  - Pulse/local intelligence cards
  - Journey cards
  - Tip/discovery cards
- Grid content is built from profile + answers + local/research/injection inputs via zone view model builders

## 5) Expanded Card Flow (Solo Focus)

There is one Solo Focus visual template with two entry components:

- `JourneyBentoCard` (journey-card expansion)
- `SoloFocusOverlay` (tip/filler expansion)

Both use the same question/result loop behavior:

1. Expanded card opens
2. Question appears in lower section
3. User answers
4. `POST /api/answers` persists answer and recalculates impact
5. View flips to RESULT copy (with citation when available)
6. User closes back to Zone or continues interaction

## 6) Bottom Question Loop Logic

- Implemented by `EmbeddedJourneyQuestion`
- Runs in expanded context and controls progression to RESULT state
- Zone totals/grid refresh after answers
- New discovery/injection content can be surfaced after successful posts

## 7) Secondary Pages

- `/zai` — chat assistant page
- `/likes` — liked/saved cards page
- `/settings` — reset/session/profile controls

## 8) Data + Integration Flow (High Level)

- UI state: React context + browser storage
- Persistence: Neon Postgres
- AI: Gemini-backed assistant/recommendation paths
- Agent gateway: OpenClaw injection/refresh/pulse routes
- Local intelligence: geocode + OpenStreetMap/local offers
- Optional research context: Firecrawl

## 9) API Surface (Core)

Examples of active flow-critical endpoints:

- `POST /api/answers`
- `POST /api/zai`
- `GET /api/zone`
- `POST /api/openclaw/inject`
- `POST /api/openclaw/refresh`
- `POST /api/discovery/pulse`
- `GET /api/local-offers`
- auth/session routes under `/api/auth/*` and `/api/session-state`

## 10) Flow Guardrails

- No `/journeys` route flow
- No `/expand/*` route flow
- Zone remains the main operating surface for journey interaction
- Expanded interactions must return to Zone state cleanly
