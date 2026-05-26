# 00-00 Senior Auditor — Director's Order & Atomic Assembly

**Product:** Zero Zero (00-00) · UK postcode-driven savings & carbon · Next.js App Router  
**Persona:** Zai Senior Auditor — industrial, direct, zero-fluff; lowercase where natural.  
**Ground truth:** `docs/HANDBOOK.md` · `lib/zone/directorsOrder.ts` · `lib/motion-family.ts` · `docs/MOTION-FAMILY.md`

Motion is **skin only**. Brains, APIs, loop order, and card lifecycle guards are **frozen**. Do not reorder Zone handoff or invent extra loop questions.

---

## 1. Card birth & final pink (Director's Order)

### Loop 1 — Mother / category bento (first close)

| Step | Behaviour |
|------|-----------|
| 1 | User closes a **category journey card** (e.g. Energy / Solar) for the first time in that journey. |
| 2 | **Exactly one** loop question assembles (atomic center-focus headline in `DiscoveryTakeover`). |
| 3 | User answers → **spawns one new discovery card** on the Zone grid (`injectNewDiscoveryCard` / `buildAchievementDiscoveryCard`). |
| 4 | **Mother card turns pink** only in `completeCleanBirth` — **never** on first close before the loop. |
| 5 | New child appears on grid with **atomic assembly** (blur → sharp); **do not** auto-open Solo Focus — user taps the child when ready. |

### Loop 2 — Discovery child (`inject-*`)

| Step | Behaviour |
|------|-----------|
| 1 | User taps the **new discovery card** (yellow wall tile until visited). |
| 2 | Opens **Solo Focus** (liquid morph / expanded content — architect headline + prose, not profile Q&A circles). |
| 3 | User closes discovery card. |
| 4 | **No loop question.** Close → grid immediately; child turns **pink** (`markCardVisited` on close). |
| 5 | Logic: `isDiscoveryInjectCard(id)` → `shouldCloseMarkPinkOnly` → `visitedClose: true`. |

### Universal pink contract

- **Visited storage:** `localStorage` key `visited_cards` + optional server merge via `POST /api/zone/visit`.
- **Discovery cards:** pink is **per card id** only — not inherited from mother `journey_key` alone.
- **Mother cards:** pink after loop birth, or on revisit if already visited / loop done for journey.
- **Rock rail:** close always `visitedClose` — no loop.
- **Revisit any pink card:** expand Solo Focus content only; close returns straight to grid — **no** `DiscoveryTakeover`.

### Handshake checklist (audit this every time)

1. **Mother** (Energy) → close → **one** loop (Solar potential?) → **new child** (Solar Panel Grant) on grid.  
2. **Mother** is **pink**.  
3. **Child** is **yellow** (unvisited).  
4. Open **child** → Solo Focus → close → **child pink**, **no** second question.  
5. Re-open **child** → close → grid only.

### Code guards (do not bypass)

| File | Role |
|------|------|
| `lib/zone/directorsOrder.ts` | `shouldOpenLoopTakeover`, `shouldCloseMarkPinkOnly`, `isDiscoveryInjectCard`, `isZoneCardPink` |
| `lib/zone/visitedCards.ts` | `markCardVisited`, `shouldSkipInjectionOnCardClose` |
| `lib/zone/loopMemory.ts` | `hasLoopDoneForJourney`, `markLoopDoneForJourney` (once per journey) |
| `app/zone/page.tsx` | `launchPatternShiftTakeover`, `completeCleanBirth`, grid tip colours |
| `app/components/DiscoveryTakeover.tsx` | Loop 1 labour + discovery birth |
| `app/components/JourneyBentoCard.tsx` | Mother Solo Focus; no embedded profile Q&A on expand |

### Data mapping

- New discovery cards **must** carry parent **`journey_key`** and **`category`** (same family in Neon / injections API).
- Canonical birth path: loop answer → `injectNewDiscoveryCard` / `POST /api/answers` discovery race.
- ULM cap: **`MAX_DISCOVERY_INJECTIONS_PER_JOURNEY`** (3) — `lib/zone/ulmLimits.ts`.

### Grid colours (Zone wall)

| State | Mother (journey bento) | Discovery child (`inject-*`) |
|-------|------------------------|------------------------------|
| Unvisited | Purple tile, yellow type | **Yellow** tile, purple type |
| Visited (pink) | Pink tile, yellow type | Pink tile, yellow type |

---

## 2. Atomic Assembly (motion DNA)

**Unified crystallize physics** on every surface — blur cloud → sharp lock. Same ease everywhere.

### Tokens (`lib/motion-family.ts`)

| Token | Value | Use |
|-------|-------|-----|
| `FAMILY_EASE` | `cubic-bezier(0.22, 1, 0.36, 1)` | All family tweens |
| `FAMILY_DUR_ATOMIC` | `1.0s` | Crystallize (blur → sharp) |
| `FAMILY_DUR_LONG` | `0.8s` | Chapter / page shell |
| `FAMILY_DUR_SHORT` | `0.4s` | Controls, word exit |
| Read buffer | `200ms` / word | After lock: `atomicWordHoldMs(text)` |

### Surface map

| Surface | Motion |
|---------|--------|
| `/` + `/intro` | `AtomicLogo` power-on; kinetic words via `opacityTicker` |
| `/profile/summary` | Atomic ticker — blur 15px → sharp, letter-spacing cloud → lock |
| `/profile` | Centered atomic cross-fade (`familyProfileStepProps`) |
| Zone handoff | `ArchitecturalPulse` atomic words → **`pulseWordsComplete`** → **then** bento ripple |
| Zone grid | `ZONE_ATOMIC_BENTO_VARIANTS` — stagger **0.12s**; discovery snap-in on birth |
| Loop question | `familyAtomicProps` in `DiscoveryTakeover` |
| Solo Focus | Zip-shut chamber; **no** `layoutId` morph on expand (industrial close → loop handoff) |

### Zone cascade (unbreakable order)

1. Intro / profile / summary complete.  
2. Zone: `ArchitecturalPulse` until **`pulseWordsComplete`**.  
3. Bento cells crystallize (`revealedCardCount`); **Rock / today's tips last**.  
4. User interaction only after wall ready (`gridFullyRevealed`).

**Do not** set `pulseWordsComplete` early via safety timers. **Do not** y-slide snap bento cells — blur→sharp only.

---

## 3. Intelligence loop (brains — do not drift)

- **12k / 1t baseline:** Ground £ and CO₂e in measurable household impact (`lib/brains`, `lib/logic/engine.ts`).
- **Gemini output:** `agent_headline` (~20 words) + `architect_prose` as **three paragraphs** — what / why / how **inside prose**, no structural labels in UI text.
- **Hermes / cron:** Weekly `GET|POST /api/cron/zone-research` (Bearer `CRON_SECRET`) — repair lane only; **not** primary user-facing birth.
- **JIT scrape:** Tip +1 / loop answer paths; Topic Shield requires `journey_key` on `POST /api/scrape-sync`.
- **Neon column:** `research_snapshot` (JSONB) on `research_results`.
- **Persona tone:** No "As an AI…" or "Here is…" padding.

---

## 4. UI constraints

- **Summary ticker:** HELLO → name → locality (`buildSummaryStaccatoWords` + `IntroWordCycle`).
- **Solo Focus H1:** Always `stripExpandedCardTitleNoise` — no scraped title junk.
- **Expand = content card** on journey bento — not profile-style Marvin headline + pink answer circles (`JourneyBentoCard` → `MotherCardRenderer` only).
- **Typography:** Marvin display + Roboto body (`public/assets/Marvin Visions Bold.ttf`, `next/font` Roboto on `<html>`).
- **Interaction:** Hover = yellow bg + purple text; visited pink cards = no hover change; press scale **0.985** only.

---

## 5. What agents must NOT do

- Add a **second loop** after closing a discovery child.  
- Mark mother **pink** on first close before loop completes.  
- Auto-open Solo Focus when a discovery card is born (grid birth only).  
- Change `lib/brains/*`, mechanical truth, or ULM ceilings without explicit product sign-off.  
- Replace Atomic Assembly with glitch on `/profile/summary` or loop headlines.  
- Use `middleware.ts` — Next.js 16 uses root **`proxy.ts`** (`export function proxy`).

---

## 6. Verify before ship

```bash
npm run verify
npm run build:clean
npm run db:test && npm run db:apply-pending   # Neon wake + migrations
```

Production: https://00-ulm.vercel.app · Health: `GET /api/health?live=1`

When auditing generated code or research output, reject any change that breaks the **One Question / One Birth / Pink on close (discovery)** chain above.
