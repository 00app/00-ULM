# Zero Zero — Product & motion specification

**Status:** Living document aligned with the repo as of April 2026.  
**Purpose:** Describe what the app *is*, how users move through it, and how **intro**, **profile summary**, and **global motion/CSS** behave — including sequences, Framer tokens, and stylesheet hooks.

For route-level layout grids and typography tokens, see `**PAGE-LAYOUT.md`**. For a shorter linear journey only, see `**APP-FLOW.md`**. For a focused animation inventory beyond this file, see `**ANIMATIONS.md**`.

---

## 1. What Zero Zero is

**Zero Zero (00-00)** is a UK-first web application that helps households understand **money**, **carbon**, and **energy** in one lane: profile + postcode drive **local context**, **journey cards** on the **Zone** dashboard surface personalised tips and questions, and **Solo Focus** expands a single card into a full-screen **question → result** loop with optional **Zai** assistant context.

**Primary surfaces**


| Surface             | Route(s)               | Role                                                                                                      |
| ------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **Intro**           | `/`, `/intro`          | First-run brand beat, kinetic value line, then **Create profile** vs **Skip to Zone**.                    |
| **Profile**         | `/profile`             | Six-step onboarding (name, postcode, household, home type, transport, age, etc. per `ProfilePageClient`). |
| **Profile summary** | `/profile/summary`     | Post-profile kinetic narrative + optional skip; then handoff to Zone.                                     |
| **Zone**            | `/zone`                | Main dashboard: hero, journey bento grid, tips, goals, Ask Zai entry.                                     |
| **Solo Focus**      | (overlay, not a route) | Expanded journey/tip: `JourneyBentoCard` / `SoloFocusOverlay` + `EmbeddedJourneyQuestion`.                |
| **Zai**             | `/zai`                 | Chat-style assistant.                                                                                     |
| **Likes**           | `/likes`               | Saved/liked cards.                                                                                        |
| **Settings**        | `/settings`            | Session reset, profile links, machine reset.                                                              |


**Tech stack (high level)**  

Next.js App Router (client-heavy intro/profile), React context + browser storage for UI session, `globals.css` + Marvin/Roboto, Framer Motion for kinetic UI, fixed `**InteractiveBackground`** under transparent shells so the mesh/grain stays visible.

---

## 2. Global shell & atmosphere


| Concern            | Implementation                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Body / HTML**    | Transparent backgrounds; content sits over the atmospheric layer.                                                               |
| **Background**     | `InteractiveBackground` in `app/layout.tsx` (inside `ClientOnly`), fixed, low z-index (see `.zz-background-env` in CSS).        |
| **Foreground**     | `GlobalAppShell` + routes use **z-index ≥ 2** where needed so intro/profile/zone sit above the mesh.                            |
| **Pointer events** | Intro kinetic words use `pointer-events: none` on the word wrapper; decision **CREATE** / **SKIP** links are fully interactive. |


**Three-colour lock (product)**  

Yellow `#FDFD00`, pink `#E80DAD`, purple `#7800ce` — see `:root` in `app/globals.css` and `**PAGE-LAYOUT.md`** §2.1.

**Typography**  

Marvin Visions Bold for display / headings; Roboto 800 for body and UI chrome. Intro/summary kinetic lines use `**--color-intro-type`** (yellow) with `**intro-text-large`** / `**intro-word-pulse`** where applicable.

---

## 3. Intro sequence (authoritative)

**Components:** `app/page.tsx` and `app/intro/page.tsx` render `**IntroScreen`** (`app/components/IntroScreen.tsx`). Kinetic copy is `**IntroWordCycle`** (`app/components/IntroWordCycle.tsx`).

**States inside `IntroScreen`**


| Step                       | `screen` value  | What the user sees                                                                                                                                                                                                                                                                              |
| -------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Glitch logo**        | `glitch`        | Two-layer SVG mark (yellow base + pink overlay). CSS keyframes `**glitchWrapperDone`**, `**glitchBase`**, `**glitchPurple**` at **670ms** each, `forwards`. After motion completes, a **settled hold** runs so the mark rests before copy. Timer-driven handoff (no `animationend` dependency). |
| **2 — Kinetic value line** | `value-message` | `**IntroWordCycle`** with fixed word list: **SAVE → MONEY → CUT → CARBON → FEEL → GOOD → USE → LESS → MORE** (UK “machine” cadence).                                                                                                                                                            |
| **3 — Decision**           | `decision`      | Headline **“CREATE A PROFILE TO START.”** and two circle links: **CREATE** → `/profile`, **SKIP** → `/zone`.                                                                                                                                                                                    |


**Query overrides**


| URL                          | Effect                                                               |
| ---------------------------- | -------------------------------------------------------------------- |
| `?skip=1` or `?step=message` | Skip step 1; open directly on step 2 (words). Steps 2 → 3 unchanged. |


**Reduced motion (`prefers-reduced-motion: reduce`)**

- **Glitch:** CSS disables layer animations; static settled mark; shorter hold before words (`GLITCH_REDUCE_MOTION_HOLD_MS` in `IntroScreen`).  
- **Words / headline / CTAs:** Framer paths avoid heavy `filter: blur`; short opacity/scale tweens (`useReducedMotion()` in `IntroWordCycle` and `IntroScreen`).

---

## 4. v6 — Kinetic shimmer (“Fussy blur” → lens focus)

**Idea:** Replace generic fades on the intro word line and decision headline with **blur → sharp** “lens focus”, plus **elastic bloom** on the two decision buttons.

### 4.1 Framer tokens (`lib/animations.ts`)


| Export                        | Values                                            | Use                                               |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| `SHIMMER_FOCUS_INITIAL`       | `filter: blur(20px)`, `opacity: 0`, `scale: 0.96` | Enter state                                       |
| `SHIMMER_FOCUS_ANIMATE`       | `blur(0px)`, `opacity: 1`, `scale: 1`             | Settled sharp                                     |
| `SHIMMER_FOCUS_SPRING`        | `stiffness: 400`, `damping: 30`, `mass: 1`        | Headline + word **in** transition                 |
| `INTRO_DECISION_CTA_SPRING`   | `stiffness: 520`, `damping: 28`, `mass: 0.55`     | CREATE / SKIP **bloom** (scale 0 → 1)             |
| `INTRO_SHIMMER_WORD_DWELL_MS` | `520`                                             | Hold each intro word **after** snap               |
| `INTRO_SHIMMER_WORD_GAP_MS`   | `120`                                             | Gap after exit before next word (stagger cadence) |


**Exit between intro words (shimmer mode):** blur-out + slight scale down, spring (`IntroWordCycle` — `SHIMMER_EXIT` / `SHIMMER_EXIT_SPRING` in component).

**Decision timing**

- Headline: **simultaneous** shimmer on mount (no per-character stagger).  
- **CREATE:** spring + **delay 400ms**.  
- **SKIP:** spring + **delay 600ms**.

### 4.2 CSS (`app/globals.css`)


| Class                                     | Role                                                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.zz-shimmer-focus`                       | `will-change: filter, transform`; `translateZ(0)`; `backface-visibility: hidden` — applied to intro `**motion.h1`** (words) and decision `**motion.h2`**. |
| `.zz-shimmer-cta`                         | `will-change: transform` on CTA wrappers.                                                                                                                 |
| `@media (prefers-reduced-motion: reduce)` | Relaxes `will-change` on these hooks to `opacity` where appropriate.                                                                                      |


**Glitch block (intro step 1)**  

- `.zz-glitch-wrap`, `.zz-glitch`, `.glitch-layer.base`, `.glitch-layer.purple` — **670ms** animations; reduced-motion block forces final static layers.

**Intro typography / CTAs (CSS)**  

- `.intro-text-large`, `.intro-word-pulse`, `.intro-decision-headline`, `.intro-cta-circle` — sizes, colours, hover/active (see `globals.css` merged intro block).

### 4.3 `IntroWordCycle` modes


| Prop                      | When                     | Motion                                                                                          |
| ------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `lensFocusShimmer={true}` | Intro kinetic line only  | Shimmer in/out + `.zz-shimmer-focus`                                                            |
| default / omitted         | e.g. **Profile summary** | `**WORD_PULSE_APPEAR`** (scale pulse + short fade exit), `gapMs` and `wordDurations` per caller |


---

## 5. Profile summary sequence

**File:** `app/profile/summary/page.tsx`

**Data:** Builds `summaryPack` from profile + journey answers via `**buildUserImpact`**, waste factors, and `**buildSummaryKineticWords`** / narrative helpers in `**lib/brains/summaryLogic.ts**`.

**Phases (`phase` state)**


| Phase    | UI                                                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cycle`  | `**IntroWordCycle`** runs dynamic `**kineticWords`** with `**WORD_PULSE_APPEAR`** (no shimmer), `**gapMs={0}`**, dwell `**KINETIC_WORD_DWELL_MS` (400ms)** per word via `summaryWordDurations`. |
| `settle` | Cycle complete (`handleCycleComplete`); brief settle before exit animation.                                                                                                                     |
| `exit`   | Page shell animates opacity/scale/blur; `**PAGE_EXIT_NAV_MS` (800ms)** then `router.push(ROUTES.ZONE)` after syncing hero totals / session flags.                                               |


**Other behaviour**

- Top-right **close** control: Framer `**ELASTIC_PING.transition`** on scale/rotate-in; sets phase to `**exit`**.  
- Outer `**motion.div`** uses `**SLAM_SPRING`** on exit phase.  
- Inner cycle `**motion.div`** exit: blur + scale + `**SLAM_SPRING`**.  
- If no profile: redirect path per `**REDIRECT_NO_PROFILE_MS`**.

---

## 6. Motion vocabulary (repo-wide)

**Design language (three behaviours)** — comments in `lib/animations.ts`:


| Name      | Role                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| **Slam**  | Tight typographic / data landings — `**SLAM_SPRING`**, `**DAMPED_SLAM_*`**, `**soloFocusSlamMotionProps**`. |
| **Bloom** | Layout / cards — `**SPRING_BLOOM`**, `**INSTANT_BLOOM`**, zone variants.                                    |
| **Tap**   | Circles / CTAs — `**SPRING_TAP`**.                                                                          |


**Other notable exports**

- `**WORD_APPEAR`**, `**WORD_PULSE_APPEAR`** — onboarding / summary style beats.  
- `**ELASTIC_PING**` — scale + opacity spring bundle used across Zone, settings, Zai, summary close, etc. (global tuning **550 / 32**; intro CTAs use `**INTRO_DECISION_CTA_SPRING`** for the v6 **520 / 28** bloom).  
- `**ZONE_ANCHOR_VARIANTS`**, `**FADE_VARIANTS`**, `**INTRO_FADE_UP_NO_DELAY**`, `**ZONE_HERO_FROM_SUMMARY**` — route-specific presets.

Full CSS keyframe names (zone shimmer, solo focus pulse, zip hooks, etc.) live in `**ANIMATIONS.md**` and `globals.css`.

---

## 7. Route quick reference

From `**lib/routes.ts**`: `/`, `/intro`, `/profile`, `/profile/summary`, `/zone`, `/zai`, `/likes`, `/settings`.

---

## 8. Related files (implementation index)


| Concern                                      | Files                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Intro state machine                          | `app/components/IntroScreen.tsx`                                                         |
| Word cycle                                   | `app/components/IntroWordCycle.tsx`                                                      |
| Motion constants                             | `lib/animations.ts`                                                                      |
| Global motion / intro / shimmer / glitch CSS | `app/globals.css`                                                                        |
| Summary narrative                            | `lib/brains/summaryLogic.ts`, `app/profile/summary/page.tsx`                             |
| Root shell                                   | `app/layout.tsx`, `app/global-layout.tsx`, `app/components/ui/InteractiveBackground.tsx` |
| Agent rules                                  | `.cursor/rules/mechanical-pulse.mdc`, etc.                                               |


---

*Update this document when intro phases, shimmer tokens, or summary timing change in code.*