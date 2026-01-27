# ZERO ZERO — COMPLETE SYSTEM AUDIT

**Generated:** After Final Cleanup & Alignment  
**Status:** All pod references removed, Card system locked, Zone/Fork rebuilt

---

## 📦 COMPONENT SYSTEM (11 Components)

### Core Components

1. **Card** (`app/components/Card.tsx`)
   - **Variants:** `card-hero`, `card-standard`, `card-compact`, `card-liked`
   - **Status:** ✅ Locked - only 4 variants allowed
   - **Usage:** Zone (hero/standard/compact), Likes (liked)

2. **CircleCTA** (`app/components/CircleCTA.tsx`)
   - **Variants:** `arrow`, `text` (one word only)
   - **Size:** 80×80px circle
   - **Usage:** All pages for primary actions

3. **AnswerCircle** (`app/components/AnswerCircle.tsx`)
   - **Size:** 80×80px circle
   - **Usage:** Journey questions

4. **InputField** (`app/components/InputField.tsx`)
   - **Usage:** Zone "ask zero", profile inputs

5. **Dropdown** (`app/components/Dropdown.tsx`)
   - **Usage:** When options >9 (per design rules)

6. **ProgressBar** (`app/components/ProgressBar.tsx`)
   - **Usage:** Journey progress

7. **Sheet** (`app/components/Sheet.tsx`)
   - **Usage:** Card detail modal

8. **FloatingNav** (`app/components/FloatingNav.tsx`)
   - **Usage:** Zone, Likes, Fork, Settings navigation

9. **JourneyGrid** (`app/components/JourneyGrid.tsx`)
   - **Layout:** 3×3 mobile, 6+3 centered desktop
   - **Button size:** 80×80px
   - **Usage:** Zone (incomplete), Fork (all journeys)

10. **PotentialSavingStatement** (`app/components/PotentialSavingStatement.tsx`)
    - **Usage:** Zone (savings display)

---

## 🎴 CARD VARIANTS (4 Total)

### Card 1 — Hero (`card-hero`)
- **Location:** Zone → "best." section (exactly 1)
- **Mobile:** 370×658px, radius 60px
- **Desktop:** 960×420px, radius 60px
- **Layout:** Image background + blue data panel bottom-left
- **Contains:** Badge + Arrow overlay, Title, CO₂/Money data, SOURCE

### Card 2 — Standard (`card-standard`)
- **Location:** Zone → "latest." section (exactly 3)
- **Image container:** 370×278px, radius 60px
- **Text container:** 330px width, radius 40px, below image
- **Layout:** Image (top) + Text (below) as siblings
- **Contains:** Badge + Arrow on image, Title, Subtitle, CO₂/Money data, SOURCE

### Card 3 — Compact (`card-compact`)
- **Location:** Zone → "do next." section (exactly 2-3)
- **Size:** 330px width, radius 40px
- **Tone:** `blue` or `cool`
- **Layout:** Text only (NO subtitle)
- **Contains:** Badge + Arrow, Title, CO₂/Money data, SOURCE

### Card 4 — Liked (`card-liked`)
- **Location:** `/likes` page only
- **Size:** Same as compact (330px width)
- **Background:** Always DEEP (#141268)
- **Text/Data:** Always ICE (#FDFDFF)
- **Contains:** Badge + Arrow, Title, Subtitle, CO₂/Money data, SOURCE

---

## 📄 PAGE STRUCTURE

### Zone Page (`app/zone/page.tsx`)

**Structure (top to bottom):**

1. **Tagline** (absolute positioned)
   - "USE LESS." / "MORE."
   - Top: 30px, Left: 30px

2. **Logo** (51px width, margin-top: 20px)

3. **Personal Message** (H3)
   - `{name}. you're doing {level}.`
   - Fallback: "welcome to zero zero."

4. **Ask Zero Input** (InputField, 350px width)

5. **Section: "best."** (H4 label)
   - **Content:** 1 × `card-hero`
   - Filtered: `items.find(i => i.variant === 'card-hero')`

6. **Section: "latest."** (H4 label)
   - **Content:** 3 × `card-standard`
   - Filtered: `items.filter(i => i.variant === 'card-standard').slice(0, 3)`
   - Grid: 1 col mobile, 2 col tablet, 3 col desktop (max 1100px)

7. **Savings Statement** (conditional)
   - Only shown if `savings.money > 0 || savings.carbon > 0`
   - Uses `PotentialSavingStatement` component

8. **Section: "do next."** (H4 label)
   - **Content:** 3 × `card-compact`
   - Filtered: `items.filter(i => i.variant === 'card-compact').slice(0, 3)`
   - Tone alternates: blue, cool, blue

9. **Incomplete Container** (`incomplete-container` class)
   - **Label:** "incomplete." / "completed." (H4)
   - **Content:** `JourneyGrid` component
   - Width: 320px, padding: 20px 10px, radius: 60px

10. **FloatingNav** (fixed bottom on mobile, top-right on desktop)

11. **Sheet** (conditional modal for card details)

**Data Source:** `buildZoneItems()` from `lib/zone.ts`  
**Rendering:** Variant filtering (NO index-based, NO pod logic)

---

### Fork Page (`app/fork/page.tsx`)

**Structure (top to bottom):**

1. **Logo** (51×81px, margin-top: 20px)

2. **Heading** (H3)
   - "continue or go to your zone."

3. **Incomplete Container** (`incomplete-container` class)
   - **Label:** "incomplete." / "completed." (H4)
   - **Content:** `JourneyGrid` component
   - **Layout:** Same markup as Zone

4. **Zone CTA** (bottom, centered)
   - `CircleCTA` with `variant="text"`, `text="ZONE"`
   - Margin-top: auto

**JourneyGrid Rules:**
- Mobile (≤640px): 3×3 grid
- Desktop (≥641px): 6 columns top row, 3 centered bottom row
- Buttons: 80×80px, COOL background always
- Text: BLUE (incomplete), PINK (completed)
- Hover: DEEP background, ICE text

---

## 🎨 CSS SYSTEM

### Zone-Specific Classes

- `.zone` - Main container (max-width: 420px mobile, 1200px desktop)
- `.zone-tagline` - Absolute positioned tagline
- `.zone-header` - Header section (logo, message, input)
- `.zone-logo` - Logo container (51px width)
- `.zone-message` - Personal message (H3)
- `.zone-label` - Section labels ("best.", "latest.", "do next.")
- `.zone-hero` - Hero card wrapper
- `.zone-grid-latest` - Latest section grid (3 cards)
- `.zone-do-next` - Do next section grid (3 cards)
- `.zone-savings` - Savings statement wrapper

### Card Classes

- `.card-hero` - Hero card responsive sizing (CSS media queries)

### Shared Classes

- `.incomplete-container` - Shared container (Zone + Fork)
- `.incomplete-label` - Label inside incomplete container
- `.journey-grid` - Journey button grid (3×3 mobile, 6+3 desktop)
- `.journey-grid-container` - JourneyGrid wrapper

### Removed Classes (Legacy)

- ❌ `.zone-pod-grid` - REMOVED
- ❌ `.zone-pod-wrapper` - REMOVED
- ❌ `.pod-hero` - REMOVED
- ❌ `.zone-latest` - REMOVED (use `.zone-grid-latest`)

---

## 🔌 API ROUTES

### Zone API (`app/api/zone/route.ts`)

**Status:** ⚠️ Needs cleanup (still has PROFILE phase logic)

**Current Issues:**
- Still contains `PROFILE_CARDS` constant
- Has phase detection (`PROFILE` vs `JOURNEY`)
- Returns profile cards when no journeys completed

**Should Return:**
- Exactly 6 cards
- 1 × `card-hero`
- 3 × `card-standard`
- 2 × `card-compact`
- Variant assignment by index

**Note:** Zone page currently uses `buildZoneItems()` from `lib/zone.ts`, not the API route.

---

## 📚 DATA FLOW

### Zone Page Data

1. **Source:** `lib/zone.ts` → `buildZoneItems()`
2. **Input:** `journeys`, `journeyAnswers`, `profile`, `cardViews`
3. **Output:** Array of 6 `ZoneItem` objects with variants
4. **Filtering:** Page filters by variant (`card-hero`, `card-standard`, `card-compact`)

### ZoneItem Interface

```typescript
interface ZoneItem {
  id: string
  type: 'journey' | 'card'
  variant: 'card-hero' | 'card-standard' | 'card-compact'
  title: string
  subtitle?: string
  journey_key?: string
  data?: {
    money?: string
    carbon?: string
  }
  score?: number
}
```

---

## ✅ VALIDATION CHECKLIST

### Card System
- ✅ Only 4 variants exist (`card-hero`, `card-standard`, `card-compact`, `card-liked`)
- ✅ No pod references in Card.tsx
- ✅ Card-standard has image + text as siblings (not nested)
- ✅ Card-compact has NO subtitle rendering
- ✅ Variant validation throws error for invalid variants

### Zone Page
- ✅ Uses variant filtering (NOT index-based)
- ✅ No pod references
- ✅ No normalization logic
- ✅ Exactly 1 hero, 3 standard, 2-3 compact cards
- ✅ Correct section order

### Fork Page
- ✅ Uses JourneyGrid (not custom buttons)
- ✅ Same incomplete-container markup as Zone
- ✅ Uses CircleCTA for Zone button

### CSS
- ✅ Legacy pod classes removed (`.zone-pod-grid`, `.zone-pod-wrapper`, `.pod-hero`)
- ✅ Only valid classes remain

### Files Deleted
- ✅ `app/components-library/` - User deleted manually
- ✅ All legacy components (Pod, CardCompact, JourneyCircle, Button, etc.)

---

## 📊 COMPONENT USAGE MAP

### Card Component Usage
- **Zone:** `card-hero` (1), `card-standard` (3), `card-compact` (2-3)
- **Likes:** `card-liked` (all liked items)

### JourneyGrid Usage
- **Zone:** Incomplete journeys only (inside `incomplete-container`)
- **Fork:** All journeys (inside `incomplete-container`)

### CircleCTA Usage
- **Fork:** Zone navigation button
- **Various:** Primary action buttons

### FloatingNav Usage
- **Zone, Likes, Settings:** Bottom navigation (mobile), top-right (desktop)

---

## 🚫 REMOVED/LEGACY

### Deleted Components
- ❌ `Pod.tsx`
- ❌ `CardCompact.tsx`
- ❌ `JourneyCircle.tsx`
- ❌ `Button.tsx`
- ❌ `IncompleteJourneysGrid.tsx`
- ❌ `OptionPill.tsx`
- ❌ `TextAnswerCTA.tsx`
- ❌ `LikesPod.tsx`
- ❌ `components-library/` directory

### Removed Patterns
- ❌ `normalizeCardVariant()` - No normalization helpers
- ❌ Pod variant mapping (`pod-1` → `card-hero`)
- ❌ Profile phase cards
- ❌ Index-based card rendering (now variant-filtered)

---

## 📝 NOTES

1. **Zone API Route:** Currently unused by Zone page (uses `lib/zone.ts` directly)
2. **Component Library:** Deleted by user (was causing confusion)
3. **Card Layouts:** All locked to exact specifications
4. **No Drift:** All pod references removed from codebase
5. **Single Source of Truth:** Card.tsx is the ONLY card component

---

**End of Audit**
