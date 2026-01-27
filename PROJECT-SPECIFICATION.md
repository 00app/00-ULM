# ZERO ZERO — PROJECT SPECIFICATION

**Version:** 3.0.0  
**Last Updated:** January 23, 2026  
**Status:** Production Locked — System Hard-Locked (Phases 1, 2, 3 Complete)

---

## TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Design System](#design-system)
4. [Architecture: Single Source of Truth](#architecture-single-source-of-truth)
5. [Calculation System](#calculation-system)
6. [Journey Questions](#journey-questions)
7. [Card System](#card-system)
8. [Components](#components)
9. [Page Structures](#page-structures)
10. [Layout System](#layout-system)
11. [API Routes](#api-routes)
12. [Database Schema](#database-schema)
13. [Image Sources](#image-sources)
14. [Rules & Constraints](#rules--constraints)

---

## PROJECT OVERVIEW

**Zero Zero** is a sustainability journey application that guides users through personalized recommendations for reducing carbon footprint and saving money. The system is fully locked to a single source of truth for calculations, four card variants, a single Zone grid system, deterministic journey-based images/sources, and a fixed layout system to prevent drift.

### Core Features

- **Journey System**: 9 journey categories (home, travel, food, shopping, money, carbon, tech, waste, holidays)
- **Card Recommendations**: Dynamic cards generated from journeys with deterministic images and sources
- **Zone Page**: Single grid system; 1 hero (full width), 9 standard cards, 3 compact tip cards
- **Likes System**: User favorites saved as liked cards (card-liked variant)
- **Journey Grid**: Visual progress tracker; 3×3 mobile, wraps on tablet/desktop
- **Progressive Summaries**: Live impact updates as users answer questions

### Application Type

- **Framework**: Next.js 14.2.35 (App Router)
- **Language**: TypeScript 5.3.3
- **Database**: PostgreSQL (Neon-ready)
- **Styling**: Tailwind CSS + Modular CSS files
- **Deployment**: Vercel

---

## TECHNOLOGY STACK

### Core Dependencies

```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "pg": "^8.11.3",
  "typescript": "^5.3.3"
}
```

### Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm start          # Start production server
npm run lint       # Lint code
```

---

## DESIGN SYSTEM

### Color System

All colors are defined as CSS variables with semantic naming:

```css
:root {
  --color-ice: #FDFDFF;   /* Surfaces, backgrounds */
  --color-cool: #F8F8FE;  /* Buttons, cards, secondary backgrounds */
  --color-blue: #000AFF;  /* Primary actions, links, accents, carbon data */
  --color-deep: #141268;  /* Text, copy, labels, money data */
  --color-pink: #E80DAD;  /* Completed state, highlights */
}
```

**Usage Rules:**
- **ICE**: Text on dark backgrounds (e.g. hero data panel, compact-blue cards) and light page surfaces
- **COOL**: Neutral/informational surfaces — card backgrounds, input fields, journey grid buttons
- **BLUE**: Carbon-first signals — primary carbon data values, carbon-led CTAs, hero data panels
- **DEEP**: Money/finance emphasis — money values, finance-led headings, body text/labels on light backgrounds
- **PINK**: Completed journeys and highlight states (never used for primary CTAs)

### Typography

**Font Family:** Roboto (Google Fonts)  
**Weights:** 400 (regular), 900 (bold)

#### Heading System

| Element | Mobile | Desktop (≥1024px) | Line Height | Letter Spacing | Weight |
|---------|--------|-------------------|-------------|----------------|--------|
| h1 | 100px | 200px | 95% | -2px | 900 |
| h2 | 80px | 120px | 90% | -2px | 900 |
| h3 | 50px | 90px | 90% | -2px | 900 |
| h4 | 40px | 60px | 96.667% | -2px | 900 |
| h5 | 20px | 20px | 100% | -1px | 900 |

**All headings:**
- Transform: lowercase
- Color: `var(--color-blue)` (default)
- Desktop: center-aligned

#### Data Typography

```css
.text-data {
  font-size: 50px;
  line-height: 49px;
  letter-spacing: -2px;
  font-weight: 900;
  text-transform: lowercase;
  color: var(--color-blue);
}
```

#### Label Typography

```css
.text-label {
  font-size: 10px;
  line-height: 14px;
  letter-spacing: 0;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--color-deep);
}
```

#### Body Typography

```css
.text-body {
  font-size: 16px;
  line-height: 18px;
  font-weight: 400;
  color: var(--color-deep);
  text-transform: capitalize;
  letter-spacing: 0;
}
```

### Responsive Breakpoints

| Breakpoint | Range | Usage |
|------------|-------|-------|
| Mobile | ≤640px | Default, single column |
| Tablet | 641px–1023px | Two columns, adjusted card sizes |
| Desktop | ≥1024px | Three columns, full layout |

---

## ARCHITECTURE: SINGLE SOURCE OF TRUTH

### Core Principle

**Money and carbon are NEVER calculated in UI. UI only reads from `buildUserImpact()`.**

### Data Flow

```
User Data (profile + journeyAnswers)
  ↓
buildUserImpact(user: UserData)
  ↓
perJourneyResults + totals
  ↓
buildZoneViewModel() (for Zone/Sheets)
getJourneyImpact() (for journey summaries)
  ↓
UI reads: journey.summary, totals.money, totals.carbon
```

### Single Responsibility Files

**There must be exactly one of each:**

| Responsibility | File |
|----------------|------|
| User Impact Calculator | `lib/brains/buildUserImpact.ts` |
| Journey Calculations | `lib/brains/calculations.ts` |
| Zone Builder | `lib/zone/buildZoneViewModel.ts` |
| Card Renderer | `app/components/Card.tsx` |
| Sheet Renderer | `app/components/Sheet.tsx` |

**Deprecated Files (DO NOT USE):**
- `lib/zone.ts` — DEPRECATED
- `lib/zone-cards.ts` — DEPRECATED
- `lib/zone-content.ts` — DEPRECATED
- `lib/zone/buildZoneItems.ts` — DEPRECATED

---

## CALCULATION SYSTEM

### Single Source: `buildUserImpact()`

**File:** `lib/brains/buildUserImpact.ts`

**Function:**
```typescript
export function buildUserImpact(user: UserData): UserImpact {
  // Returns:
  // - perJourneyResults: Record<JourneyId, ImpactResult>
  // - totals: { totalCarbon: number, totalMoney: number }
}
```

**Rules:**
- This is the ONLY place where money and carbon are calculated
- UI components MUST read from this, never calculate
- All calculations use `lib/brains/calculations.ts`
- Supports partial answers (uses UK averages when answers missing)

### Calculation Engine: `lib/brains/calculations.ts`

**Interface:**
```typescript
export interface ImpactResult {
  carbonKg: number      // Annual kg CO₂e
  moneyGbp: number      // Annual £
  source: string        // UK source attribution
  explanation: string[] // Human, UK-based reasoning
}
```

**All 9 Journey Functions:**
- `calculateHome(answers)` → Home/Energy calculations
- `calculateTravel(answers)` → Travel calculations
- `calculateFood(answers)` → Food calculations
- `calculateShopping(answers)` → Shopping calculations
- `calculateMoney(answers)` → Money calculations
- `calculateCarbon(answers)` → Carbon tracking calculations
- `calculateTech(answers)` → Tech calculations
- `calculateWaste(answers)` → Waste calculations
- `calculateHolidays(answers)` → Holidays calculations

**Rules:**
- Annual values only (kg CO₂e per year, £ per year)
- Money is never negative (0 minimum)
- Carbon is never negative (0 minimum)
- All values rounded to whole numbers
- Source attribution is ALWAYS present
- Supports partial answers (UK average fallbacks)

**UK Data Sources:**
- Home/Energy → Energy Saving Trust UK
- Travel → DEFRA Transport Emissions Factors
- Food/Waste → WRAP UK
- Carbon → Carbon Trust UK
- Holidays → DEFRA Aviation Factors
- Money → UK Household Spending data
- Tech → UK consumer electronics lifecycle studies
- Shopping → UK retail emissions data

### Calculation Details

#### HOME
- **Monthly cost**: UK avg fallback: 120/month
- **Annual spend**: monthly × 12
- **Base carbon**: annualSpend × 0.45
- **Green tariff = NO**: +120 money
- **Provider switching** (green_tariff = NO AND provider ≠ OCTOPUS): +400kg carbon, +180 money

#### TRAVEL
- **Distance**: `distance_amount` (UK avg: 50 miles/week)
- **Period**: `distance_period` (WEEK | MONTH)
- **Annual miles**: WEEK × 52, MONTH × 12
- **Fuel factors**: PETROL 0.404, DIESEL 0.447, ELECTRIC/HYBRID 0.05, NONE 0
- **Money**: CAR transport → 300, else 0

#### FOOD
- **Carbon**: VEGAN 800, VEGETARIAN 1100, FLEXI 1400, default 1800 (UK omnivore avg)
- **Money**: HIGH waste 300, MEDIUM 150, LOW 0

#### SHOPPING
- **Monthly spend**: UK avg fallback: 200/month
- **Annual spend**: monthly × 12
- **Carbon**: annualSpend × 2.5
- **Money**: OFTEN buy_new 20%, SOMETIMES 10%, RARELY 0

#### MONEY
- **Carbon**: 0
- **Money**: finances_tight = YES → 250, else 0

#### CARBON
- **Carbon**: tracking = NO → 300, else 0
- **Money**: 0

#### TECH
- **Carbon**: upgrade_often = YES → 400, else 0
- **Money**: upgrade_often = YES → 200, else 0

#### WASTE
- **Carbon**: recycle = NEVER 350, SOMETIMES 175, ALWAYS 0
- **Money**: compost = NO → 100, else 0

#### HOLIDAYS
- **Carbon**: fly_frequency = OFTEN 2000, YEARLY 1000, NEVER 0
- **Money**: long_haul = YES → 300, else 150 (UK short-haul avg)

---

## JOURNEY QUESTIONS

**File:** `lib/journeys.ts`

**All 9 Journeys with Complete Questions:**

### HOME
1. `energy_type` — options: GAS, ELECTRIC, MIXED, SOLAR, UNKNOWN
2. `electricity_provider` — options: OCTOPUS, BRITISH_GAS, EDF, EON, OVO, SCOTTISH_POWER, SHELL, UTILITA, OTHER (two-line text)
3. `gas_provider` — options: OCTOPUS, BRITISH_GAS, EDF, EON, OVO, SCOTTISH_POWER, SHELL, UTILITA, OTHER (two-line text)
4. `monthly_cost` — number (repeatLabel: "even a rough estimate helps — what do you spend each month?")
5. `green_tariff` — options: YES, NO, UNKNOWN

### TRAVEL
1. `primary_transport` — options: CAR, BUS, TRAIN, BIKE, WALK
2. `fuel_type` — options: PETROL, DIESEL, ELECTRIC, HYBRID, NONE
3. `distance_amount` — number (repeatLabel: "even a rough estimate helps — how many miles?")
4. `distance_period` — options: WEEK, MONTH

### FOOD
1. `diet_type` — options: OMNIVORE, FLEXI, VEGETARIAN, VEGAN
2. `food_waste` — options: LOW, MEDIUM, HIGH

### SHOPPING
1. `buy_new` — options: OFTEN, SOMETIMES, RARELY
2. `secondhand` — options: YES, NO
3. `monthly_spend` — number (repeatLabel: "even a rough estimate helps — how much do you spend?")

### MONEY
1. `finances_tight` — options: YES, NO
2. `biggest_cost` — options: HOUSING, ENERGY, FOOD, TRAVEL

### CARBON
1. `priority` — options: LOW, MEDIUM, HIGH
2. `tracking` — options: YES, NO

### TECH
1. `upgrade_often` — options: YES, NO
2. `device_count` — options: FEW, AVERAGE, MANY

### WASTE
1. `recycle` — options: ALWAYS, SOMETIMES, NEVER
2. `compost` — options: YES, NO

### HOLIDAYS
1. `fly_frequency` — options: NEVER, YEARLY, OFTEN
2. `long_haul` — options: YES, NO

### Question Logic

**Numeric Questions with Conditional Repeat:**
- If value is 0, empty, or implausibly low → re-ask once with `repeatLabel`
- One repeat only per question
- Thresholds:
  - `monthly_cost`: < 10
  - `distance_amount`: 0 or empty
  - `monthly_spend`: < 5

**Storage:**
- Answers stored in `localStorage` as `journey_{journeyId}_answers` (JSON object)
- Format: `{ [question_id]: answer }`

---

## CARD SYSTEM

### Variant Lock (ABSOLUTE)

**ONLY FOUR CARD VARIANTS ALLOWED:**

1. `card-hero` — Hero card (full image, data panel)
2. `card-standard` — Image + text below (natural flow)
3. `card-compact` — Text-only
4. `card-liked` — Same as compact, DEEP background (Likes/Settings only)

**FORBIDDEN FOREVER:**
- Any "pod-*" naming
- Aliases, fallbacks, or normalization layers
- New variants

### Runtime Validation

```typescript
const allowedVariants = ['card-hero', 'card-standard', 'card-compact', 'card-liked'] as const
if (!allowedVariants.includes(variant as any)) {
  console.error(`[Card] Invalid variant "${variant}"`)
  return null
}
```

### CARD 1: card-hero

**Layout:**
- Full image background
- Badge + arrow overlay at top
- Blue data panel bottom-left
- Mobile: 370×658px
- Desktop: 960×420px
- Card radius: 60px
- Data panel radius: 40px

### CARD 2: card-standard (CRITICAL)

**Structure: TWO STACKED SIBLINGS ONLY:**

```
[ Image container ]
[ Text container ]
```

**Wrapper:**
- `display: flex`
- `flex-direction: column`
- `align-items: center`
- `padding-bottom: 20px`
- NO background on wrapper

**Image:**
- Mobile: 370×278px
- Tablet: 320×240px
- Desktop: 300×225px
- `border-radius: 60px`
- Badge + arrow overlay ONLY (absolute)
- NO text inside image
- NO absolute positioning of text container

**Text container (SIBLING, NOT ABSOLUTE):**
- Mobile: 330px × auto (natural flow)
- Tablet: 300px × auto
- Desktop: 280px × auto
- `padding: 20px`
- `border-radius: 40px`
- `background: var(--color-cool)`
- `display: flex`
- `flex-direction: column`
- `gap: 20px`

**Title:**
- h4 typography ONLY
- MAX 3 LINES (line-clamp: 3)
- `overflow: hidden`
- `text-overflow: ellipsis`
- NO subtitle text

**Data:**
- Carbon FIRST, money SECOND
- Labels always visible
- Source always visible
- NO extra text

**NEVER:**
- Overlay text on image
- Reuse hero layout
- Absolute-position the text container
- Fixed heights on text container (use natural flow)

### CARD 3: card-compact

- `width: 330px`
- `padding: 20px`
- `border-radius: 40px`
- Text only
- Badge + arrow at top
- Tone:
  - `blue` → BLUE bg, ICE text
  - `cool` → COOL bg, DEEP text

### CARD 4: card-liked

- Same layout as card-compact
- `background: var(--color-deep)`
- `text/data: var(--color-ice)`
- USED ONLY on Likes screen and Settings page
- NEVER renders images

---

## COMPONENTS

### Card.tsx

**Props:**
```typescript
interface CardProps {
  variant: 'card-hero' | 'card-standard' | 'card-compact' | 'card-liked'
  title?: string
  subtitle?: string
  journey?: JourneyId
  category?: string
  source?: string
  sourceLabel?: string
  data?: { money?: string; carbon?: string }
  tone?: 'cool' | 'blue'
  image?: string | null
  onClick?: () => void
  children?: React.ReactNode
}
```

**Image Resolution:**
- `card-liked` and `card-compact`: NEVER render images (returns `null`)
- `card-hero` and `card-standard`: Uses `getJourneyImage(journey, variant, 0)`
- Path: `/public/cards/{journey}/hero.jpg` or `/public/cards/{journey}/standard.jpg`
- Dev warnings for missing images

### Sheet.tsx

**Structure (top → bottom):**
1. IMAGE (16:9 aspect ratio, 40px radius) — optional
2. HEADING (h3 style, uses `.card-title-slot`)
3. BODY COPY (explanation paragraphs, scrolls if needed)
4. DATA ROW (carbon first, money second)
5. ACTION ROW — START | ACTION (optional) | LEARN

**CTA Row (Normal Flow):**
- START: `router.push(/journeys/${journey})` → internal route
- ACTION: `window.open(actionUrl, '_blank')` → external provider URL (if exists)
- LEARN: `window.open(learnUrl, '_blank')` → source URL (always)

**Layout:**
- `.sheet`: `display: flex`, `flex-direction: column`
- `.sheet-content`: `flex: 1`, `overflow-y: auto` (scrolls naturally)
- `.sheet-cta-row`: `margin-top: 20px`, normal flow (sibling after content)
- NO absolute positioning on CTA row

### CircleCTA.tsx

**Circular button component (80×80px)**

**Variants:**
- `variant="arrow"`: Arrow icon (default)
- `variant="text"`: Text label
- `variant="icon"`: Icon (heart)

**Props:**
- `primary?: boolean` — Sheet primary CTA styling
- `disabled?: boolean` — Disabled state
- `icon?: 'heart'` — Heart icon for like button

**States:**
- Default: COOL background, BLUE text/icon
- Hover: BLUE background, ICE text/icon
- Active: DEEP background, ICE text/icon
- Primary: BLUE background, ICE text (default)
- Disabled: Overrides all (grey/muted)

### InputField.tsx

**Text input with advance arrow**

**Dimensions:**
- Width: 350px (default), or `width="100%"` for constrained containers
- Height: 60px
- Background: `var(--color-cool)`

**Typography:**
- Font: h4 (40px, -2px letter spacing)
- Color: `var(--color-blue)`

**Behavior:**
- Type: `text` (NOT `number`)
- Input mode: `numeric` (for mobile keyboards)
- Pattern: `[0-9]*` (for numeric validation)
- Arrow appears ONLY when field is filled
- Hover arrow: DEEP background, ICE arrow
- ENTER key advances

**Props:**
- `width?: string | number` — Override default width (e.g., `"100%"` for auth modal)
- `className?: string` — For CSS targeting (e.g., `.input-field`)

**Forbidden:** Native number spinners

### AnswerCircle.tsx

**Circular answer option button**

- Size: 80×80px
- Background: COOL (default), BLUE (selected)
- Text: DEEP (default), ICE (selected)
- `twoLine?: boolean` — Supports two-line text (splits on `_`, centers, no overflow)

### FloatingNav.tsx

**Persistent navigation component**

**Items (3 only):**
1. Heart icon → `/likes` (Likes page)
2. Circle icon → `/zone` (Zone/home page)
3. Leaf icon → `/settings` (Summary/settings page)

**Layout:**
- Mobile: Bottom center, horizontal layout (`flex-direction: row`)
- Desktop: Top right, vertical layout (`flex-direction: column`)
- `position: fixed`
- `z-index: 100`

### AuthModal.tsx

**Authentication modal**

**Structure:**
1. H4 heading: "get more free tips" (centred, one line, blue)
2. Email input (`width="100%"`, `className="input-field"`)
3. Password input (`width="100%"`, `className="input-field"`)
4. Single CTA: "log in" or "sign up" (80×80 circle, dynamic label)
5. Close chevron (top right, no text)

**Behavior:**
- Submit on button tap
- Submit on ENTER
- If email not found → create account silently
- If password wrong → inline error (text-body, deep)
- No separate "mode switching"

**CSS:**
- `.auth-modal { padding: 20px; }`
- `.auth-modal .input-field { max-width: 100%; }`

---

## PAGE STRUCTURES

### Zone Page (`/zone`)

**Structure (fixed order):**
1. Tagline ("USE LESS." / "MORE.") — fixed top-left
2. Logo (20px from top)
3. Personal message (H3)
4. Ask Zero input
5. "best." → exactly 1 × card-hero
6. "act now." → exactly 9 × card-standard
7. "tips." → exactly 3 × card-compact
8. "get more personalised tips" → Load more module
9. "explore more." → JourneyGrid
10. FloatingNav

**Layout:**
- `.zone`: `display: flex`, `flex-direction: column`, `align-items: center`, `width: 100%`, `gap: 20px`, `padding-bottom: 100px`
- `.zone-content-container`: `max-width: 480px` mobile, `max-width: 1100px` tablet+, `padding: 0 20px`, `gap: 20px`
- `.zone-grid`: 1 column mobile, 2 tablet, 3 desktop, `gap: 20px`
- `.zone-grid .card-hero`: `grid-column: 1 / -1` (full width)

**NO other cards. NO profile cards here. NO extra sections.**

### Journey Page (`/journeys/[journeyId]`)

**Structure:**
1. Intro screen (auto-advances after 2s)
2. Questions (progressive, with live summary)
3. Summary screen (per-journey impact only)

**Live Summary:**
- Updates after every answered question
- Shows: "Based on what you've told us so far…"
- Displays: `{carbonKg} kg CO₂ / year · £{moneyGbp} a year`
- Only visible when at least one answer exists

**Summary Screen:**
- Calculated from current journey only (not cumulative)
- Format: "you could save" → "£X a year" → "and cut" → "X kg CO₂ / year"
- Uses `getJourneyImpact(journeyId, answers)`

**Question Logic:**
- Numeric questions: Re-ask once if 0/empty/implausible (uses `repeatLabel`)
- Options: Auto-advance after selection
- Number: Advance on ENTER

### Settings Page (`/settings`)

**Structure:**
1. Profile card (`card-liked` variant)
2. Journey cards (all 9, `card-liked` variant)
3. Reset and Log/Signin buttons (bottom, text-based, 80×80)
4. FloatingNav

**Journey Cards:**
- Display full journey answers (all questions + answers)
- Format: `{label} {answer.toLowerCase()}`
- Edit button (pencil icon, top-right)
- NO images on Settings page

### Likes Page (`/likes`)

**Structure:**
1. Heading: "your likes."
2. Liked cards (`card-liked` variant)
3. FloatingNav

**Cards:**
- All use `card-liked` variant
- DEEP background, ICE text
- NO images

### Fork Page (`/fork`)

**Structure:**
1. Logo
2. H3: "continue or go to your zone."
3. Incomplete container (JourneyGrid)
4. CircleCTA "ZONE" pinned bottom

**NO legacy layouts. NO alternate grids.**

---

## LAYOUT SYSTEM

### Zone Container

**Mobile:**
- `max-width: 480px` (420-480px range)
- Single centered column
- Vertical stack with `gap: 20px`
- `padding-bottom: 100px` (minimum for FloatingNav)

**Tablet/Desktop:**
- `max-width: 1100px`
- Grid: 2 columns tablet, 3 columns desktop
- Centered horizontally

### Card Grid

**`.zone-grid`:**
- Mobile: 1 column
- Tablet (≥641px): 2 columns
- Desktop (≥1024px): 3 columns
- `gap: 20px`
- Hero always spans full width (`grid-column: 1 / -1`)

### Sheet Layout

**`.sheet`:**
- `display: flex`
- `flex-direction: column`
- `position: fixed`
- `bottom: 0`
- `max-height: 90vh`

**`.sheet-content`:**
- `flex: 1`
- `overflow-y: auto`
- Scrolls naturally

**`.sheet-cta-row`:**
- Normal flow (sibling after content)
- `margin-top: 20px`
- `padding: 20px`
- NO absolute positioning

### FloatingNav Spacing

**All scrollable pages must:**
- Add `safe-bottom` class or `padding-bottom: 120px` (minimum 100px)
- Prevents overlap with FloatingNav

**Pages with FloatingNav:**
- Zone: `padding-bottom: 100px`
- Settings: `safe-bottom` class
- Likes: `safe-bottom` class
- Zai: Input positioned at `bottom: 100px` (above nav)

---

## API ROUTES

### `/api/summary`

**Method:** GET  
**Purpose:** User summary data

**Uses:** `buildUserImpact()` (single source of truth)

**Response:**
```typescript
{
  savings: number  // totalMoney
  carbon: number   // totalCarbon
  text: string
}
```

### `/api/analytics`

**Method:** POST  
**Purpose:** Track analytics events

### `/api/likes`

**Method:** GET, POST, DELETE  
**Purpose:** Manage user likes

### `/api/reset`

**Method:** POST  
**Purpose:** Reset user data

---

## DATABASE SCHEMA

### Tables

#### `users`
```sql
id: uuid (primary key)
name: text
postcode: text
household: text
home_type: text
transport_baseline: text
created_at: timestamp
updated_at: timestamp
```

#### `journey_answers`
```sql
id: uuid (primary key)
user_id: uuid (foreign key -> users.id)
journey_key: text
question_id: text
answer: text
created_at: timestamp
updated_at: timestamp
```

#### `likes`
```sql
id: uuid (primary key)
user_id: uuid (foreign key -> users.id)
card_id: text
created_at: timestamp
```

---

## IMAGE SOURCES

**Deterministic Paths:**
- Hero: `/public/cards/{journey}/hero.jpg`
- Standard: `/public/cards/{journey}/standard.jpg`
- Compact/Liked: NEVER render images (returns `null`)

**Resolution:**
- `getJourneyImage(journey: JourneyId, variant: CardVariant, index: number): string | null`
- Dev warnings for missing images

---

## RULES & CONSTRAINTS

### Absolute Rules

1. **Card Variants**: ONLY 4 variants. Runtime validation required.
2. **Calculations**: NEVER in UI. Always use `buildUserImpact()`.
3. **Layout**: NO absolute positioning on card text containers or sheet CTAs.
4. **Zone Structure**: Fixed order, no extra sections.
5. **Questions**: All questions defined in `lib/journeys.ts` only.
6. **Images**: Deterministic paths only, no APIs or randomization.
7. **Buttons**: All interactive elements 80×80px circles (`.zz-button`).
8. **FloatingNav**: Never overlaps inputs (use `safe-bottom`).

### Forbidden

- ❌ "pod-*" naming
- ❌ New card variants
- ❌ Calculations in UI components
- ❌ Absolute positioning on text containers
- ❌ Fixed heights on card-standard-body (use natural flow)
- ❌ Duplicate zone builders or card components
- ❌ Layout drift (inline width/height overrides on cards)

### Required

- ✅ Single source of truth for calculations (`buildUserImpact`)
- ✅ Runtime variant validation in Card component
- ✅ Progressive summaries (live updates as user answers)
- ✅ Per-journey summaries (not cumulative)
- ✅ Natural flow layout (no absolute positioning)
- ✅ Safe-bottom spacing for FloatingNav

---

**END OF SPECIFICATION**
