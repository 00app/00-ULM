# Zero Zero — Animation & motion reference

This document describes **Framer Motion presets** from `lib/animations.ts`, the Solo Focus **Intro Slam** bridge, and **CSS keyframes / transitions** in `app/globals.css`.

**April 2026:** For the **canonical** intro sequence, v6 **kinetic shimmer** token table, profile **summary** phases, and a concise description of the app, read **`docs/PRODUCT-AND-MOTION-SPEC.md`**. Some tables below are historical inventories — **always verify numbers in `lib/animations.ts`**.

---

## Design language (three behaviors)


| Behavior  | Role                                                                  | Typical use                          |
| --------- | --------------------------------------------------------------------- | ------------------------------------ |
| **Slam**  | High tension, little overshoot — data and typography that must “land” | Numbers, headlines, mechanical beats |
| **Bloom** | Fluid spring — layout, cards, page-level motion                       | Grids, sheets, word reveals          |
| **Tap**   | Short, stiff spring — tactile press feedback                          | Circles, nav pills, buttons          |


**Global easing (CSS):** `--easing-groovy: cubic-bezier(0.34, 1.56, 0.64, 1)` and alias `--spring-shutter` — used for groovy / mechanical UI transitions across `globals.css`.

---

## TypeScript — `lib/animations.ts` (snapshot)

Import: `import { … } from '@/lib/animations'`.

### Core springs & slam

| Export | Notes |
|--------|--------|
| `SLAM_SPRING` | `stiffness: 450`, `damping: 32`, `mass: 1` — damped slam for typography / data |
| `SPRING_BLOOM` / `INSTANT_BLOOM` | `550 / 32` — layout bloom |
| `SPRING_TAP` | `620 / 24` — tap feedback |
| `DAMPED_SLAM_*` / `SLAM_INTRO_*` | Scale + opacity slam preset |
| `soloFocusSlamMotionProps(reduceMotion, skipInitialSlam)` | Slam with reduced-motion fallback |

### Durations

| Export | Value | Role |
|--------|-------|------|
| `KINETIC_WORD_DWELL_MS` | **400** | Default dwell per word in `IntroWordCycle` (e.g. profile summary) |

### v6 — Kinetic shimmer (intro only)

| Export | Role |
|--------|------|
| `SHIMMER_FOCUS_INITIAL` / `SHIMMER_FOCUS_ANIMATE` | Blur 20px→0, opacity, scale 0.96→1 |
| `SHIMMER_FOCUS_SPRING` | `400 / 30 / mass 1` — lens snap |
| `INTRO_DECISION_CTA_SPRING` | `520 / 28` — CREATE/SKIP bloom |
| `INTRO_SHIMMER_WORD_DWELL_MS` | **520** — intro word hold after focus |
| `INTRO_SHIMMER_WORD_GAP_MS` | **120** — gap before next word |

### Other presets (still in file)

`WORD_APPEAR`, `WORD_PULSE_APPEAR`, `FADE_IN_UP`, `FADE_VARIANTS`, `ELASTIC_PING`, `ZONE_ANCHOR_VARIANTS`, `INTRO_FADE_UP_NO_DELAY`, `ZONE_HERO_FROM_SUMMARY`, … — see source for exact shapes.

---


## Where TS tokens are used (quick map)


| Area                 | Files (representative)                                                                                              | Tokens                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Solo Focus / journey | `JourneyBentoCard.tsx`, `SoloFocusOverlay.tsx`                                                                      | Slam props, `WORD_APPEAR`, `FADE_VARIANTS`, `SPRING_TAP`, `INTRO_FADE_UP_NO_DELAY`, zone-style staggers; **expanded close** — `BackArrowDownLeft` (**same stroke** as bento `card-top-arrow` / Trinity link arrow, **180°** in `BackArrowDownLeft.tsx`), **`INTRO_FADE_UP_NO_DELAY`** on mount + **`SPRING_TAP`** on `whileTap` (toolbar row with category) |
| Intro                | `IntroScreen.tsx`, `IntroWordCycle.tsx`                                                                             | v6 **shimmer** on first-run words + decision (`SHIMMER_FOCUS_*`, `INTRO_DECISION_CTA_SPRING`, `INTRO_SHIMMER_WORD_*`). **`WORD_PULSE_APPEAR`** is for **other** `IntroWordCycle` callers (e.g. profile summary), not the intro kinetic line. |
| Summary              | `app/profile/summary/page.tsx`                                                                                      | `IntroWordCycle` + **`WORD_PULSE_APPEAR`** / **`KINETIC_WORD_DWELL_MS`**; **`SLAM_SPRING`**, **`ELASTIC_PING`** on shell / close; phase timers in page |
| Zone                 | `app/zone/page.tsx`                                                                                                 | Zone grid / page slide presets                                                                          |
| UI kit               | `Buttons.tsx`, `Inputs.tsx`, `AnswerCircle.tsx`, `FloatingNav.tsx`, `BentoCards.tsx`, `QuestionLayout.tsx`          | `SPRING_TAP`, `SPRING_BLOOM`                                                                            |
| Profile / settings   | `ProfilePageClient.tsx`, `settings/page.tsx`                                                                        | `SPRING_BLOOM`, `SPRING_TAP`                                                                            |
| Zai                  | `app/zai/page.tsx`                                                                                                  | `SPRING_TAP`, `FADE_IN_UP`                                                                              |
| Misc                 | `RockSavingTips.tsx`, `EmbeddedJourneyQuestion.tsx`, `SoloFocusDiagnosticFooter.tsx`, `SoloFocusPriceCapFooter.tsx` | Bloom / tap / `FADE_VARIANTS`                                                                           |


---

## CSS — `app/globals.css` keyframes & motion utilities

### Ping & fade (unified open language)


| Name         | Duration / curve                       | What it does                       |
| ------------ | -------------------------------------- | ---------------------------------- |
| `pingIn`     | 300ms `cubic-bezier(0.2, 0.8, 0.2, 1)` | Opacity `0→1`, scale `0.97→1`      |
| `.ping-open` | applies `pingIn`                       | Class hook for non-Framer surfaces |


### Content feed


| Name          | Duration                                  | What it does                    |
| ------------- | ----------------------------------------- | ------------------------------- |
| `introFadeUp` | 450ms (+ 150ms delay via `.content-feed`) | `translateY(10px) → 0`, fade in |


### Legacy shutter / zip (CSS hooks; Solo Focus hero prefers Framer Slam)


| Name                                                        | Notes                                                                                                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zipShutterIn`                                              | Vertical + horizontal scale + blur; 60% overshoot on Y                                                                                                   |
| `zip-rebirth`                                               | Brightness flash + `scaleY` pop                                                                                                                          |
| `shutterOpen` / `shutterClose`                              | `scaleY` 0↔1; used by `.shutter-entrance` / `.shutter-exit` (0.5s groovy / 0.3s ease-in)                                                                 |
| `.expanded-solo-focus .solo-focus-loop.zip-shut-collapsing` | **Transition** (not keyframe): opacity + `scaleY(0)` + margin collapse — question rail “zip” while POST in flight; **reduced motion** disables transform |


### Bento / journey chrome


| Name              | Duration          | What it does                                     |
| ----------------- | ----------------- | ------------------------------------------------ |
| `card-arrow-hint` | 0.55s ease-in-out | Nudges card arrow SVG on hover (diagonal wiggle) |


### Solo Focus — impact & answers


| Name                                 | Duration                     | What it does                                                                                                       |
| ------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `solo-focus-impact-mechanical-pulse` | 0.72s `--easing-groovy` once | SAVE/CARBON row: scale to **1.03** + slight brightness bump, then settle — class `.solo-focus-impact-answer-pulse` |


**Pager pips (layout + transition, not keyframes):** `.solo-focus-pager-rail` **gap 20px**; `.pager-pip` **8×8** hollow circle (`border-radius: 50%`); `.pager-pip--active` **8×8** filled circle (not a pill); **0.3s** `transition: all` with groovy easing.

**Ask Zai (Solo Focus):** `.kinetic-nav-pulse` is a **Framer** `animate` loop on the pink ring (scale + opacity); **reduced motion** turns animation off in CSS for that helper.

### Zone & discovery


| Name                    | Duration                              | What it does                                                   |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `zone-local-shiver`     | 0.4s ease-out                         | Subtle scale wobble on local grid “victory”                    |
| `text-data-count-in`    | 0.6s `--easing-zero`                  | Big numbers: opacity + scale `0.96→1` (`.text-data--count-in`) |
| `zone-shimmer-flow`     | 0.4s `--easing-zero`                  | Shimmer sweep on expanded zone card                            |
| `zone-expand-fade`      | 0.3s `--easing-zero`, **150ms** delay | Expanded zone content fades in after shimmer                   |
| `discovery-green-pulse` | 2.4s infinite ease-in-out             | Opacity pulse on `.discovery-card-green-pulse`                 |


### Intro glitch logo


| Name                | Duration      | What it does                                          |
| ------------------- | ------------- | ----------------------------------------------------- |
| `glitchWrapperDone` | **670ms** linear | Wrapper transform step (duration locked with `IntroScreen` glitch timers) |
| `glitchPurple`      | **670ms** linear | Purple layer offset + opacity dance                 |
| `glitchBase`        | **670ms** linear | Base layer fade up                                  |

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables glitch keyframes; layers snap to settled state (see `globals.css` next to `.zz-glitch`).

### v6 — Shimmer utility classes

| Class | Purpose |
|-------|---------|
| `.zz-shimmer-focus` | `will-change: filter, transform` + compositing hints — intro words + decision headline |
| `.zz-shimmer-cta` | `will-change: transform` — decision CTA bloom wrappers |


### Global utility


| Name     | Duration               | What it does                                |
| -------- | ---------------------- | ------------------------------------------- |
| `fadeUp` | 0.4s `--easing-groovy` | `translateY(12px) → 0` — `.animate-fade-up` |


### Intro CTA / circles (CSS transitions)

`.intro-cta-circle` uses **0.25s** `cubic-bezier(0.34, 1.56, 0.64, 1)` on **transform** for press; **:active** `scale(0.96)`.

### Zone / generic circles

`.zz-button-circle` and `.action-circle-80` (non–Solo Focus answer): **transform 0.2s** `--easing-groovy`; **:active** `scale(0.9)`.

### Answer circles (Solo Focus)

`.answer-circle-100` / `.funky-answer-circle`: **transition: transform 0.2s ease** (Framer may add `SPRING_TAP` on top in TSX).

---

## Reduced motion

- **Framer:** `soloFocusSlamMotionProps(true, …)` collapses Slam to short opacity tweens.
- **CSS:** `@media (prefers-reduced-motion: reduce)` disables kinetic Zai pulse animation, shutter class animations, and flattens `.zip-shut-collapsing` to opacity-only.

---

## Adding a new animation

1. Prefer **reusing** `SPRING_BLOOM`, `SPRING_TAP`, or **Intro Slam** constants before inventing new springs.
2. If you need a **CSS-only** loop or one-shot, add `@keyframes` in `globals.css` next to the component surface it belongs to, and document it in this file.
3. If the motion is **cross-route** or reused in multiple components, add a named export to `lib/animations.ts` and import from there.

---

*Partially refreshed April 2026 (intro shimmer + glitch durations). Full intro/summary narrative: `docs/PRODUCT-AND-MOTION-SPEC.md`.*