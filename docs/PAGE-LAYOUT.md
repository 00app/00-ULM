# Zero Zero — Page layout reference

**Last updated:** April 26, 2026

Single living spec for screens, grid, spacing, typography, and colour. Implementation detail lives in `app/globals.css`, `app/floating-nav.css`, and each route under `app/`. Product narrative + intro/summary motion: **`docs/PRODUCT-AND-MOTION-SPEC.md`**.

---

## 1. App structure

| Layer | Role |
|-------|------|
| `app/layout.tsx` | Root HTML/body: **transparent** chrome, **`InteractiveBackground`** (fixed mesh + grain) first in `<body>`, Roboto + Marvin stack, `AppProvider`, `SessionStateRehydrate`. **`GlobalAppShell`** wraps routes in a **`min-height: 100vh`** shell. Imports **`globals.css`** + **`floating-nav.css`**. |
| `app/page.tsx` | `/` — Renders `IntroScreen` (same as intro). |
| Routes | Feature pages as listed below; no separate journey routes. |
| Portals | Solo Focus overlays mount via `createPortal` → `document.body` (see `JourneyBentoCard`, `SoloFocusOverlay`). |

**Viewport:** mobile-first; layout metadata targets `device-width`, scale 1.

---

## 2. Global design tokens (`:root` in `app/globals.css`)

### 2.1 Colours (three-colour lock)

| Token | Hex | Typical use |
|-------|-----|--------------|
| `--color-yellow` | `#FDFD00` | Body text on purple, CTA labels, highlights |
| `--color-pink` | `#E80DAD` | Accents, carbon emphasis, close default, some cards |
| `--color-purple` | `#7800ce` | **Solid** purple surfaces + ink (cards, buttons, nav); **not** a full-page flood — shells are transparent so the global mesh shows through |

**Journey tile backgrounds** (CSS variables): `--color-j-home` … `--color-j-holidays` — **yellow and pink only** (alternating by journey).

**Legacy aliases** still map to the three primaries (e.g. `--color-deep`, `--color-burnt` → purple) for older class names.

### 2.2 Typography

| Role | Source |
|------|--------|
| **Marvin Visions Bold** | `@font-face` → `/assets/Marvin Visions Bold.ttf` — `--font-marvin` |
| **Roboto** | Google Fonts in layout: 400 / 700 / 900 — `--font-roboto` |
| **Labels** | `--font-label` = Marvin |

**Scale (headings use ~85% line-height via `--zz-lh-heading`):**

- H1: `--zz-h1-mobile` 100px / desktop 200px  
- H2: 80px / 120px  
- H3: 60px / 90px  
- H4: 30px / 40px  

**Body:** `--zz-body-size` 20px, `--zz-body-line` 1.2 (note: an earlier duplicate `--zz-body-size` 16px appears in the same file; **effective lock in heading/body blocks uses 20px** for `p`, `.zz-body`, etc.)

Global rules: `h1–h4` / `.zz-h1`–`.zz-h4` use Marvin; `p`, `.zz-body`, `.circle-btn` force Roboto **800**.

### 2.3 Spacing (CSS variables)

Examples: `--gap-xs` 2px … `--gap-xl` 40px; `--padding-sm` 12px … `--padding-lg` 30px; `--margin-top-xl` 40px; zone `padding-bottom` 80px on `.zone`.

### 2.4 Radius & motion

- **Radii:** `--radius-groovy` / `--radius-pill` **60px** (mechanical pulse: 60 or 0 on chrome). Grid cells often **48px** (`.groovy-cell-radius`).
- **Easing:** `--easing-groovy`, `--easing-zero`; bloom/squish transitions on tokens.

---

## 3. Floating navigation (`app/floating-nav.css`)

| Property | Value |
|----------|--------|
| Position | Fixed: **bottom** ~32px (or **safe-bottom**: 20px + safe-area) centered on mobile |
| Desktop | **Top-right** vertical stack from 1024px |
| Container | Flex row/column, **gap 12px**, **padding 12px**, **radius 60px** |
| Background | Purple; **border 3px** yellow |
| Items | **60px** circles; inactive purple/yellow flip; active yellow; hover can go pink |

Links to Zone, Likes, Settings, Zai (implementation in `FloatingNav.tsx`).

---

## 4. Screen-by-screen layout

### 4.1 `/` and `/intro` — Intro

**Component:** `IntroScreen.tsx` (+ `IntroWordCycle.tsx`)

| Stage | Content |
|-------|---------|
| **Glitch** | Brand mark layers (SVG), **670ms** CSS animations + **settled hold** before copy; reduced-motion uses static layers (`globals.css` + timers in `IntroScreen`). |
| **Words** | `IntroWordCycle` with **`lensFocusShimmer`** — blur→sharp lens focus, **520ms** dwell per word, **120ms** gap between words; yellow type (`--color-intro-type`), classes **`intro-text-large`** + **`zz-shimmer-focus`**. |
| **Decision** | **`motion.h2`** headline shimmer (same token family); **CREATE** / **SKIP** wrapped in **`motion.div`** with **`.zz-shimmer-cta`**, elastic bloom (**400ms** / **600ms** delays). |

**Layout:** Full viewport, centered stacks; **transparent** shell so **`InteractiveBackground`** stays visible; Framer Motion for all kinetic steps. See **`docs/PRODUCT-AND-MOTION-SPEC.md`** §3–4.

---

### 4.2 `/profile` — Create profile

**Component:** `ProfilePageClient.tsx`

| Element | Layout |
|---------|--------|
| Flow | **Single step at a time** — 6 questions with stagger animations (`PROFILE_ITEM_VARIANTS`) |
| Questions | Input or **option chips** (see `PROFILE_QUESTIONS`: name, postcode, living situation, home type, transport, age) |
| Storage | Keys `profile_*` + `createUser` API |
| Navigation | Completes → `/profile/summary` (or as wired in client) |

**Typographic feel:** Marvin for questions; Roboto bold for inputs/options; purple/yellow/pink from page chrome (see profile page wrappers in client).

---

### 4.3 `/profile/summary` — Profile audit

**File:** `app/profile/summary/page.tsx`

| Element | Behaviour |
|---------|-----------|
| **Phases** | **`cycle`** → `IntroWordCycle` with dynamic **`kineticWords`** (`WORD_PULSE_APPEAR`, **400ms** dwell, **`gapMs: 0`**) → **`settle`** → **`exit`** (page blur/scale + **`SLAM_SPRING`**) → **`router.push`** to Zone after **`PAGE_EXIT_NAV_MS`**. |
| **Data** | `buildUserImpact`, **`buildSummaryKineticWords`** / `summaryLogic.ts`, local intelligence where available. |
| **Chrome** | Top-right close: **`ELASTIC_PING`**-style spring; optional skip mirrors exit handoff. |

Layout: full-height centred **`.summary-page--minimal`** shell; yellow on purple; see **`docs/PRODUCT-AND-MOTION-SPEC.md`** §5.

---

### 4.4 `/zone` — Main dashboard

**File:** `app/zone/page.tsx` + `app/globals.css` (`.zone`, `.groovy-zone-grid`)

#### Page chrome

| Region | Spec |
|--------|------|
| Wrapper | `.zone` — column, center, **min-height 100vh**, **padding-bottom 80px** (clears floating nav) |
| Header | `.zone-anchor` — column, **gap 24px**, **padding-top 0px**, **padding-bottom 0px** |
| Menu | `.zone-menu` — lowercase, Marvin, H4 scale |
| Logo | `.zone-logo` **~66px** wide |
| Greeting | `.zz-anchor-greeting` — Marvin H2 mobile/desktop scale, **side margins 24px** |
| Ask Zai | Pill input (zone styles under `.zone-ask-zai-*` / related) |

**Zone page background** is typically **purple** with **yellow** foreground text on the shell; individual **bento cells** use journey **yellow/pink** fills with contrasting text (yellow-card journeys use purple/pink text rules in code — see `YELLOW_JOURNEY_IDS` in `zone/page.tsx`).

#### Groovy grid (`.groovy-zone-grid`)

| Breakpoint | Columns | Max width | Gap | Horizontal padding | Bottom padding |
|------------|---------|-----------|-----|-------------------|----------------|
| Default / mobile ≤767px | **1** | 100% | 16px | 16px **20–24px** | **80px** |
| Tablet ≥768px | **2** | **720px** | 16px | 16px 24px | 80px |
| Desktop ≥1024px | **3** | **960px** | **18px** | **18px 28px** | 80px |
| XL ≥1440px | **4** | **1280px** | **20px** | **20px 32px** | 80px |

**Row sizing:** `grid-auto-rows: minmax(160px, auto)`; mobile cells forced **min-height 200px**, **min-width 280px**.

**Content order (code):** `getGroovyGridItems`:

1. **Hero** cell  
2. Up to **3 tips**  
3. **Journey** cards in fixed wall order: home, travel, food, shopping, money, carbon, tech, waste, holidays — each with a **persona** (`square` | `wide` | `tall`) affecting grid span where applied  
4. **Filler** tiles to pad count to a multiple of **4** (layout completeness)

**Bento card (collapsed journey):** `.bento-card-groovy` — **60px** radius, **30px** padding*, label top-left, arrow top-right, headline, SAVE \| CARBON stacks (*settings uses `p-6` variant for settings grid).

**Pulse / low carbon:** `.grid-pulse--low-carbon` — **2px solid yellow** border on pulse card.

**Bottom of zone (goals):** **GOAL_OPTIONS** — circular / onboarding-style choices (`zone/page.tsx`); selecting adds real-time card behaviour as implemented.

---

### 4.5 Expanded Solo Focus (full-screen)

**Not a separate route** — overlay on top of Zone.

**CSS:** `.expanded-solo-focus` + `.solo-focus-*` in `globals.css`.

| Aspect | Spec |
|--------|------|
| Container | Fixed inset, **flex column**, **100dvh**, **overflow hidden** on shell; inner **`.solo-focus-body-scroll`** scrolls |
| Padding | **clamp(12px, 3vw, 40px)** sides; tighter top |
| Background | **`--journey-bg`** fallback **purple** (three-colour lock) |
| Default text | **`--journey-text`** → **yellow** |
| Close | **40px** `.solo-focus-close-circle` in **`.solo-focus-expanded-toolbar`** (category **left**, close **right**, same row). **`BackArrowDownLeft`** — same stroke as bento **`card-top-arrow`** / Trinity link arrow (**180°**); Framer **`INTRO_FADE_UP_NO_DELAY`** + **`SPRING_TAP`**. Pink default, yellow hover |
| Column | `.solo-focus-content-stack` — max width **~22.5rem**, centred, vertical **gap** clamp ~14–22px |
| Impact row | SAVE \| CARBON; **CARBON** stack **pink**; **0px** label→value flex gap (`.data-stack` / `.solo-focus-data-stack` per unified data lock) |
| Trinity | **80px** circles, **20px** gap |
| Question block | `.expanded-question-wrap` — **40px** top margin, **20px** inner gap, centred |
| Footers | `.solo-focus-fixed-footers` inside scroll column — **margin-top auto**; price-cap + source citation, **10pt** Roboto |

**Components:**

- **Journey expansion:** `JourneyBentoCard` — Framer **`layoutId`** shared element with tile.  
- **Tip / MORE expansion:** `SoloFocusOverlay` — same classes, no `layoutId`.  
- **Questions:** `EmbeddedJourneyQuestion` — **QUESTION ↔ RESULT** (`viewState`), `POST /api/answers`.

---

### 4.6 `/zai` — Chat

**File:** `app/zai/page.tsx`

| Element | Layout |
|---------|--------|
| Shell | Chat column, **ZoneBackToZoneLink** at top |
| Messages | User vs Zai bubbles (see `ChatElements` / local styles in page) |
| Input | Bottom fixed input area, **`/api/zai`** POST |

**Context:** Can open with **Ask Zai** context from expanded card (`getAskZaiContext`).

---

### 4.7 `/likes` — Liked cards

**File:** `app/likes/page.tsx`

| Element | Layout |
|---------|--------|
| Page | **Pink** background, **yellow** type; **min-height 100vh**, **padding-bottom 48px** |
| Title | `.zz-page-title`, Marvin, centred, **margin-top 56px** |
| List | Liked journey/tip cards from view model; unlike + actioned flows |

---

### 4.8 `/settings` — Settings

**File:** `app/settings/page.tsx`

| Element | Layout |
|---------|--------|
| Grid | Bento-style **cards** — **60px** radius, **`bento-card-groovy`**, **`p-6`**, **min-h 160px** |
| Normal card | **Yellow** bg, **purple** text |
| Hero card | **Pink** bg, **yellow** text (`.settings-hero-card`) |
| Actions | Edit links, location pin, reset machine (clears non-profile storage per `clearMachineStorage`) |

---

## 5. Reusable layout / component classes (high level)

| Class area | Purpose |
|------------|---------|
| `.groovy-zone-grid` | Zone bento grid — responsive columns, gaps, padding |
| `.bento-card-groovy` | Standard journey/tip collapsed card |
| `.expanded-solo-focus` / `.solo-focus-*` | Full-screen expanded template |
| `.zone` / `.zone-anchor` | Zone page vertical shell + header |
| `.floating-nav` / `.nav-item-circle` | Global nav dock |
| `.zz-page` / `.zz-page-title` | Secondary pages (likes, etc.) |
| `.zz-button`, `.zz-button-circle`, `.action-circle-80` | Buttons / circles (sizes vary: profile vs zone 64 vs 80 in bloom) |

**UI kit:** `app/components/ui/` — `Buttons`, `Inputs`, `QuestionLayout`, `ChatElements`, `BentoCards`, `SettingsElements`.

---

## 6. Related docs

- **`docs/PRODUCT-AND-MOTION-SPEC.md`** — Product narrative, intro + summary sequences, v6 shimmer tokens, CSS class map.  
- **`docs/APP-FLOW.md`** — Linear user flow only.  
- **`docs/ANIMATIONS.md`** — Keyframes and preset cross-reference (verify numbers against `lib/animations.ts`).  
- **`.cursor/rules/mechanical-pulse.mdc`** — Motion and layout constraints for agents.
