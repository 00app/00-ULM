# Zero Zero — Animation & motion reference

This document describes **all first-class animation tokens** in the repo: Framer Motion presets from `lib/animations.ts`, the Solo Focus **Intro Slam** bridge, and **CSS keyframes / transitions** in `app/globals.css`. It is the companion to code comments in `lib/animations.ts`.

---

## Design language (three behaviors)


| Behavior  | Role                                                                  | Typical use                          |
| --------- | --------------------------------------------------------------------- | ------------------------------------ |
| **Slam**  | High tension, little overshoot — data and typography that must “land” | Numbers, headlines, mechanical beats |
| **Bloom** | Fluid spring — layout, cards, page-level motion                       | Grids, sheets, word reveals          |
| **Tap**   | Short, stiff spring — tactile press feedback                          | Circles, nav pills, buttons          |


**Global easing (CSS):** `--easing-groovy: cubic-bezier(0.34, 1.56, 0.64, 1)` and alias `--spring-shutter` — used for groovy / mechanical UI transitions across `globals.css`.

---

## TypeScript — `lib/animations.ts`

Import: `import { … } from '@/lib/animations'`.

### Core springs (Framer `type: 'spring'`)


| Export         | Stiffness | Damping | Use                                          |
| -------------- | --------- | ------- | -------------------------------------------- |
| `SPRING_SLAM`  | 400       | 30      | Data slams, tight typographic motion         |
| `SPRING_BLOOM` | 320       | 24      | Default “bloom” for layouts and most presets |
| `SPRING_TAP`   | 500       | 15      | `whileTap` on CTAs, circles, inputs          |
| `SPRING_FUNKY` | 380       | 22      | Bouncy expanded open/close                   |
| `SPRING_POP`   | 600       | 22      | Fast pop open/shut on expanded cards         |


**Aliases:** `GROOVY_SPRING_MORPH` → `SPRING_BLOOM`. `SOLO_FOCUS_ZIP_TRANSITION` → `SPRING_BLOOM` (deprecated name; Solo Focus hero uses Intro Slam below).

### Solo Focus — Intro Slam (`AnimatePresence` shell swap)

Replaces the old zip-shutter **for the hero / result shell** in Solo Focus. Answer → exit at **0.95** scale + blur + fade → content swap → enter from **1.05** scale springing to **1**.


| Export                                                    | Meaning                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `SLAM_INTRO_ENTER_TRANSITION`                             | Spring: stiffness **500**, damping **25**                                                                                                   |
| `SLAM_INTRO_INITIAL`                                      | Enter from: `scale: 1.05`, `opacity: 0`, `filter: blur(0px)`                                                                                |
| `SLAM_INTRO_ANIMATE`                                      | Settle to: `scale: 1`, `opacity: 1`, `filter: blur(0px)`                                                                                    |
| `SLAM_INTRO_EXIT`                                         | Exit: `scale: 0.95`, `opacity: 0`, `filter: blur(10px)`, **0.15s** duration tween                                                           |
| `slamTransition`                                          | Bundle: `{ initial, animate, exit, enterTransition }` for docs/tests                                                                        |
| `soloFocusSlamMotionProps(reduceMotion, skipInitialSlam)` | Returns Framer props for `motion.`*; if `reduceMotion`, uses short opacity-only tween; if `skipInitialSlam`, skips overscaled initial state |


**Re-export barrel:** `app/animations.ts` re-exports only the Slam bundle for routes that prefer a shorter import path.

### Durations & beats (seconds unless noted)


| Export                       | Value                              | Role                                              |
| ---------------------------- | ---------------------------------- | ------------------------------------------------- |
| `BEAT_DURATION`              | `0.4`                              | Kinetic text beat (summary, data slams)           |
| `KINETIC_WORD_DWELL_MS`      | `450`                              | Hold per word in `IntroWordCycle` / summary cycle |
| `SUMMARY_WORD_MS`            | alias of above                     |                                                   |
| `SUMMARY_ENTER_DELAY_MS`     | `500`                              | Delay before ENTER after final slam on summary    |
| `SUMMARY_END_DELAY_MS`       | alias of `SUMMARY_ENTER_DELAY_MS`  |                                                   |
| `BG_TRANSITION`              | `0.35s`, ease `[0.23, 1, 0.32, 1]` | Profile steps, summary phase backgrounds          |
| `CONTENT_REVEAL_DURATION_MS` | `480`                              | Shimmer → content                                 |
| `CONTENT_REVEAL_EASE`        | `[0.2, 0.8, 0.2, 1]`               | Content reveal curve                              |
| `SHIMMER_MS`                 | `1200`                             | Card shimmer duration token                       |


### Motion presets (objects for `motion` components)


| Export                           | Motion idea                                                                       | Transition                         |
| -------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| `FADE_IN_UP` / `SWOOP_FADE_IN`   | `y: 24 → 0`, fade                                                                 | `SPRING_BLOOM`                     |
| `SCALE_BLOOM`                    | Hero ENTER / AUDIT: scale `0.85 → 1`                                              | `SPRING_BLOOM`                     |
| `WORD_APPEAR`                    | Intro/headline: `y` + slight scale                                                | `SPRING_BLOOM`                     |
| `WORD_PULSE_APPEAR`              | Industrial word pulse: **fixed 0.16s** tween (pairs with `KINETIC_WORD_DWELL_MS`) | ease `[0.22, 1, 0.36, 1]`          |
| `PING_OPEN`                      | Container ping: scale `0.98 → 1`, opacity                                         | **0.3s** ease `[0.2, 0.8, 0.2, 1]` |
| `INTRO_FADE_UP`                  | Content feed: `y: 15`, **150ms** delay                                            | **0.45s** ease `[0.16, 1, 0.3, 1]` |
| `INTRO_FADE_UP_NO_DELAY`         | Same without delay                                                                | same duration/ease                 |
| `FADE_VARIANTS`                  | `{ hidden, visible }` opacity only                                                | `SPRING_BLOOM`                     |
| `CARD_CHILD_VARIANTS`            | Stagger children: `y: 8`                                                          | `SPRING_BLOOM`                     |
| `ZONE_ANCHOR_VARIANTS`           | Zone anchor slide                                                                 | `SPRING_BLOOM`                     |
| `ZONE_PAGE_SLIDE_UP`             | Full page `y: 56` slide                                                           | `SPRING_BLOOM`                     |
| `zoneGridVariants(delayPerItem)` | Grid stagger; default **45ms** per index                                          | `SPRING_BLOOM`                     |
| `ZONE_GRID_VARIANTS`             | `zoneGridVariants(0.045)`                                                         |                                    |
| `ZONE_CARD_STAGGER_DELAY`        | `0.032`                                                                           | Per-item stagger constant          |
| `SUMMARY_CYCLE_EXIT`             | Vertical zip exit: `opacity`, `scaleY: 0`                                         | **0.8s**, `ZIP_SHUTTER_EASE`       |
| `SUMMARY_REVEAL_ENTER`           | Zip enter from `scaleY: 0`                                                        | **0.65s**, `ZIP_SHUTTER_EASE`      |
| `SUMMARY_PAGE_EXIT`              | Whole summary surface zip                                                         | **0.8s**, `ZIP_SHUTTER_EASE`       |
| `ZONE_HERO_FROM_SUMMARY`         | Post-summary zone hero zoom                                                       | **0.75s**, `ZIP_SHUTTER_EASE`      |


`ZIP_SHUTTER_EASE` = `[0.22, 1, 0.36, 1]` — shared zip / handoff language.

---

## Where TS tokens are used (quick map)


| Area                 | Files (representative)                                                                                              | Tokens                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Solo Focus / journey | `JourneyBentoCard.tsx`, `SoloFocusOverlay.tsx`                                                                      | Slam props, `WORD_APPEAR`, `FADE_VARIANTS`, `SPRING_TAP`, `INTRO_FADE_UP_NO_DELAY`, zone-style staggers; **expanded close** — `BackArrowDownLeft` (**same stroke** as bento `card-top-arrow` / Trinity link arrow, **180°** in `BackArrowDownLeft.tsx`), **`INTRO_FADE_UP_NO_DELAY`** on mount + **`SPRING_TAP`** on `whileTap` (toolbar row with category) |
| Intro                | `IntroScreen.tsx`, `IntroWordCycle.tsx`                                                                             | `WORD_APPEAR`, `WORD_PULSE_APPEAR`, `KINETIC_WORD_DWELL_MS`, `SPRING_BLOOM`                             |
| Summary              | `app/profile/summary/page.tsx`                                                                                      | `SUMMARY_PAGE_EXIT`, `KINETIC_WORD_DWELL_MS`                                                            |
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


| Name                | Duration     | What it does                                          |
| ------------------- | ------------ | ----------------------------------------------------- |
| `glitchWrapperDone` | 0.67s linear | No-op transform step so `animationend` fires reliably |
| `glitchPurple`      | 0.67s linear | Purple layer offset + opacity dance                   |
| `glitchBase`        | 0.67s linear | Base layer fade up                                    |


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

*Last aligned with `lib/animations.ts` (ends at `ZONE_HERO_FROM_SUMMARY`) and `app/globals.css` keyframe inventory in-repo.*