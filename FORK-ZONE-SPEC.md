# Zero Zero — Fork & Zone Pages Specification

**Last Updated:** Final Lock  
**Status:** Production Ready

---

## 1. DESIGN TOKENS

### Colors
```css
--color-ice:   #FDFDFF   /* Surfaces, backgrounds */
--color-cool:  #F8F8FE   /* Buttons, cards */
--color-blue:  #000AFF   /* Actions, CTAs, headings */
--color-deep:  #141268   /* Copy, section labels */
--color-pink:  #E80DAD   /* Completed state text */
```

**Usage Rules:**
- ICE: Page backgrounds, containers, surfaces only
- COOL: Button backgrounds (default), card text containers
- BLUE: Interactive elements, headings, CTAs, primary actions
- DEEP: Body copy, section labels, informational text
- PINK: Completed journey state text only

---

### Typography System

**Font Family:** Roboto  
**Weights:** 900 (Black) for headings/labels, 400 (Regular) for body

#### Mobile (≤639px)

| Element | Font Size | Line Height | Letter Spacing | Transform | Color |
|---------|-----------|-------------|----------------|-----------|-------|
| H1 | 100px | 98px | -2px | lowercase | BLUE |
| H2 | 80px | 76px | -2px | lowercase | BLUE |
| H3 | 50px | 48px | -2px | lowercase | BLUE |
| H4 | 40px | 38px | -2px | lowercase | BLUE |
| DATA | 50px | 49px | -2px | lowercase | BLUE/ICE |
| LABEL | 10px | 14px | 0 | uppercase | DEEP/BLUE |
| BODY | 16px | 18px | 0 | capitalize | DEEP |

#### Desktop (≥1024px)

| Element | Font Size | Line Height | Letter Spacing | Transform | Color |
|---------|-----------|-------------|----------------|-----------|-------|
| H1 | 200px | 190px | -2px | lowercase | BLUE |
| H2 | 120px | 108px | -2px | lowercase | BLUE |
| H3 | 90px | 81px | -2px | lowercase | BLUE |
| H4 | 60px | 58px | -2px | lowercase | BLUE |
| DATA | 50px | 49px | -2px | lowercase | BLUE/ICE |
| LABEL | 10px | 14px | 0 | uppercase | DEEP/BLUE |
| BODY | 16px | 18px | 0 | capitalize | DEEP |

---

### Spacing System

| Token | Value | Usage |
|-------|-------|-------|
| gap-xs | 2px | Data column gaps |
| gap-sm | 4px | Text container vertical spacing |
| gap-md | 10px | Content container spacing (Fork) |
| gap-lg | 20px | Grid gaps, section spacing |
| gap-xl | 40px | Header spacing, large sections |
| padding-sm | 12px | Badge horizontal padding |
| padding-md | 20px | Container padding, text containers |
| padding-lg | 30px | Savings statement padding |
| margin-top-sm | 3px | Progress bar top |
| margin-top-md | 20px | Logo top margin (Fork) |
| margin-top-lg | 30px | Tagline top (Zone) |
| margin-top-xl | 40px | Logo top margin (Zone), section labels |
| margin-bottom-md | 20px | Section label bottom |

---

## 2. FORK PAGE SPECIFICATION

### Layout Structure

```
┌─────────────────────────────────────┐
│   Page Container (min-height: 100vh)│
│   background: ICE                   │
│   padding: 20px 0 100px 0          │
│   flex-direction: column            │
│   align-items: center               │
├─────────────────────────────────────┤
│   Content Container                 │
│   width: 100%                       │
│   padding: 0 20px                   │
│   gap: 10px                         │
│   ├─ Logo (51×81px, margin-top: 20) │
│   ├─ H3 Heading                     │
│   └─ Incomplete Container           │
│      ├─ H4 Label                    │
│      └─ JourneyGrid                 │
├─────────────────────────────────────┤
│   Zone CTA (margin-top: auto)       │
│   padding-bottom: 40px              │
└─────────────────────────────────────┘
```

---

### Components

#### Logo
- **Dimensions:** 51px width × 81px height
- **Margin-top:** 20px
- **Fill:** BLUE (#000AFF)
- **Position:** Centered horizontally

#### Heading (H3)
- **Text:** "continue or go to your zone."
- **Typography:** H3 mobile (50px/48px)
- **Color:** BLUE
- **Position:** Below logo, centered
- **Spacing:** Gap 10px from logo

#### Incomplete Container
```css
width: 320px;
padding: 20px 10px;
border-radius: 60px;
background: ICE (#FDFDFF);
display: flex;
flex-direction: column;
align-items: center;
gap: 20px;
```

**Contains:**
1. **Incomplete Label (H4)**
   - Text: "incomplete." / "completed." (conditional)
   - Typography: H4 mobile (40px/38px)
   - Color: DEEP (#141268)
   - Text-align: center
   - Desktop: 60px/58px

2. **JourneyGrid Component**
   - Shared component (see JourneyGrid spec below)
   - `showLabel={false}` (label rendered outside grid)

#### Zone CTA Button
```css
width: 80px;
height: 80px;
border-radius: 40px;
background: BLUE (#000AFF);
color: ICE (#FDFDFF);
border: none;
display: flex;
align-items: center;
justify-content: center;
```

**Typography:**
- Font: Roboto
- Size: 10px
- Line-height: 14px
- Letter-spacing: 0
- Weight: 900
- Transform: uppercase

**Position:**
- `margin-top: auto`
- `padding-bottom: 40px`
- Centered horizontally

---

### Spacing Flow (Fork)

| Element | Top Margin | Bottom Margin | Gap |
|---------|------------|---------------|-----|
| Page Container | 0 | 100px padding | - |
| Content Container | 0 | auto | 10px |
| Logo | 20px | 0 | 10px |
| H3 Heading | 0 | 0 | 10px |
| Incomplete Container | 0 | 0 | - |
| Zone CTA | auto | 40px | - |

---

## 3. ZONE PAGE SPECIFICATION

### Layout Structure

```
┌─────────────────────────────────────┐
│   Main Container (.zone)            │
│   background: ICE                   │
│   max-width: 420px (mobile)         │
│   max-width: 1200px (desktop)       │
│   padding-bottom: 100px             │
│   position: relative                │
├─────────────────────────────────────┤
│   Tagline (absolute)                │
│   position: top-left                │
│   top: 30px, left: 30px             │
├─────────────────────────────────────┤
│   Header (.zone-header)             │
│   gap: 40px                         │
│   padding: 40px 0 60px 0           │
│   ├─ Logo (51px, margin-top: 40)    │
│   ├─ Personal Message (H3)          │
│   └─ Ask Zero Input                 │
├─────────────────────────────────────┤
│   Section: "best."                  │
│   margin-top: 40px                  │
│   margin-bottom: 20px               │
│   └─ Pod-1 (Hero)                   │
├─────────────────────────────────────┤
│   Section: "latest."                │
│   margin-top: 40px                  │
│   margin-bottom: 20px               │
│   └─ Pod-2 Grid (1/2/3 columns)     │
├─────────────────────────────────────┤
│   Savings Statement (conditional)   │
│   └─ PotentialSavingStatement       │
├─────────────────────────────────────┤
│   Section: "do next."               │
│   margin-top: 40px                  │
│   margin-bottom: 20px               │
│   └─ Pod-3 Grid (1/2/3 columns)     │
├─────────────────────────────────────┤
│   Incomplete Container              │
│   └─ JourneyGrid                    │
├─────────────────────────────────────┤
│   FloatingNav (fixed bottom)        │
└─────────────────────────────────────┘
```

---

### Zone Header

#### Tagline
```css
position: absolute;
top: 30px;
left: 30px;
font-size: 10px;
line-height: 14px;
letter-spacing: 0;
text-transform: uppercase;
color: BLUE (#000AFF);
display: flex;
flex-direction: column;
z-index: 10;
```

**Content:**
- Line 1: "USE LESS."
- Line 2: "MORE."

#### Logo
- **Dimensions:** 51px width (auto height)
- **Margin-top:** 40px
- **Fill:** BLUE (#000AFF)
- **Position:** Centered in header

#### Personal Message (H3)
```css
font-size: 50px;        /* Mobile */
line-height: 48px;
max-width: 320px;

font-size: 90px;        /* Desktop */
line-height: 81px;
max-width: 920px;
```

**Structure:**
- If name exists: `{name}. you're doing {level}.`
  - `{name}`: BLUE color
  - `you're doing`: DEEP color
  - `{level}`: BLUE color
- If no name: `welcome to zero zero.` (BLUE color)

**Level Logic:**
- 0 journeys: "ok for starters"
- 1 journey: "good start"
- 2-3 journeys: "really well"
- 4+ journeys: "amazingly"

#### Ask Zero Input
- **Component:** InputField
- **Width:** 350px
- **Background:** COOL (#F8F8FE)
- **Placeholder:** "ask zero."
- **Action:** Navigate to `/zai` on advance

---

### Section Labels

**Class:** `.zone-label`

```css
font-size: 40px;        /* Mobile */
line-height: 38px;
margin-top: 40px;
margin-bottom: 20px;

font-size: 60px;        /* Desktop */
line-height: 58px;
```

**Properties:**
- Color: DEEP (#141268)
- Text-align: center
- Width: 100%
- Typography: H4 (40px/38px mobile, 60px/58px desktop)
- Transform: lowercase
- Letter-spacing: -2px

**Labels:**
1. "best."
2. "latest."
3. "do next."

---

### Pod System

#### Pod-1 (Hero Card)

**Container:**
```css
width: 370px;           /* Mobile */
height: 658px;
border-radius: 60px;
background-image: cover;
position: relative;
overflow: hidden;

width: 960px;           /* Desktop */
height: 420px;
border-radius: 60px;
```

**Top Row (Badge + Arrow):**
```css
position: absolute;
top: 20px;              /* Mobile: 20px, Desktop: 24px */
left: 20px;             /* Mobile: 20px, Desktop: 24px */
right: 20px;            /* Mobile: 20px, Desktop: 24px */
display: flex;
justify-content: space-between;
```

**Badge:**
- Height: 30px
- Padding: 0 12px
- Border-radius: 15px
- Background: COOL (#F8F8FE)
- Text: "category" (LABEL style, DEEP color)

**Arrow CTA:**
- Width: 32px
- Height: 32px
- Border-radius: 50% (circle)
- Background: BLUE (#000AFF)
- Icon: 16×16 SVG, ICE stroke

**Text Container (Bottom):**
```css
position: absolute;
bottom: 20px;           /* Mobile: 20px, Desktop: 24px */
left: 20px;             /* Mobile: 20px, Desktop: 24px */
width: 330px;           /* Mobile: 330px, Desktop: 360px */
padding: 20px;
border-radius: 40px;
background: BLUE (#000AFF);
display: flex;
flex-direction: column;
gap: 4px;
```

**Text Container Content:**
1. **Title (H4)**
   - Typography: H4 mobile (40px/38px)
   - Color: ICE
   - Transform: lowercase

2. **Data Row (2 columns)**
   - Layout: flex, gap: 20px
   - Carbon column (FIRST): LABEL + DATA (ICE)
   - Money column (SECOND): LABEL + DATA (ICE)

3. **Source Label**
   - Typography: LABEL (10px/14px, uppercase)
   - Color: ICE, opacity: 0.8
   - Margin-top: 4px

---

#### Pod-2 (Standard Card)

**Wrapper:**
```css
display: flex;
flex-direction: column;
align-items: center;
padding-bottom: 20px;
```

**Image Container:**
```css
width: 370px;
height: 278px;
padding: 20px 20px 228px 20px;
border-radius: 60px;
background-image: cover;
position: relative;
```

**Top Row:** Same as Pod-1 (Badge + Arrow)

**Text Container (Below Image):**
```css
width: 330px;
padding: 20px;
border-radius: 40px;
background: COOL (#F8F8FE);
display: flex;
flex-direction: column;
gap: 4px;
```

**Text Container Content:**
1. **Title (H4)**
   - Typography: H4 mobile (40px/38px)
   - Color: DEEP
   - Transform: lowercase

2. **Subtitle (BODY)** - Optional
   - Typography: BODY (16px/18px)
   - Color: DEEP
   - Transform: capitalize

3. **Data Row (2 columns)**
   - Carbon (FIRST): LABEL (DEEP) + DATA (BLUE)
   - Money (SECOND): LABEL (DEEP) + DATA (BLUE)

4. **Source Label**
   - Typography: LABEL (10px/14px, uppercase)
   - Color: DEEP, opacity: 0.8
   - Margin-top: 4px

---

#### Pod-3 (Compact Card)

**Container:**
```css
width: 330px;
padding: 20px;
border-radius: 40px;
display: flex;
flex-direction: column;
gap: 4px;
```

**Background States:**
- Default: COOL (#F8F8FE)
- Blue variant: BLUE (#000AFF)

**Content:**
1. **Badge + Arrow** (Top) - Same as Pod-1/Pod-2

2. **Title (H3/H4)** - Optional
   - Typography: H4 (40px/38px)
   - Color: DEEP (if COOL bg) or ICE (if BLUE bg)
   - Transform: lowercase

3. **Subtitle (BODY)** - Optional
   - Typography: BODY (16px/18px)
   - Color: DEEP (if COOL) or ICE (if BLUE)

4. **Data Row (2 columns)**
   - Carbon (FIRST): LABEL + DATA
     - COOL bg: DEEP label, BLUE data
     - BLUE bg: ICE label, ICE data
   - Money (SECOND): LABEL + DATA
     - Same color rules as Carbon

5. **Source Label**
   - Typography: LABEL (10px/14px, uppercase)
   - Color: DEEP (if COOL) or ICE (if BLUE), opacity: 0.8
   - Margin-top: 4px

---

### Zone Grid Layouts

#### Latest Section (Pod-2 Grid)

**Mobile (≤640px):**
```css
grid-template-columns: 1fr;
gap: 20px;
```

**Tablet (641px - 1023px):**
```css
grid-template-columns: repeat(2, 1fr);
gap: 20px;
```

**Desktop (≥1024px):**
```css
grid-template-columns: repeat(3, 1fr);
gap: 20px;
max-width: 1100px;
margin: 0 auto;
```

**Quantity:** Always 3 Pod-2 cards

---

#### Do Next Section (Pod-3 Grid)

**Layout:** Same as Latest Section (1/2/3 columns responsive)

**Quantity:** Always 3 Pod-3 cards

**Blue Variant Logic:** Alternating (index % 2 === 0 is BLUE)

---

### Savings Statement

**Component:** PotentialSavingStatement

**Container:**
```css
width: 370px;
padding: 30px;
border-radius: 60px;
background: BLUE (#000AFF);
display: flex;
flex-direction: column;
align-items: flex-start;
```

**Typography:**
- Font: Roboto
- Size: 50px (mobile) / 90px (desktop)
- Line-height: 48px (mobile) / 81px (desktop)
- Letter-spacing: -2px
- Transform: lowercase
- Color: ICE (#FDFDFF)
- Text-align: left

**Content (3 lines):**
1. "you could save £{money}."
2. "{carbon}k"
3. "co₂e this year alone."

**Conditional Rendering:**
- Only shows if `savings.money > 0` OR `savings.carbon > 0`
- Positioned between "latest." and "do next." sections

---

### Incomplete Container (Zone)

**Same as Fork Page:**
```css
width: 320px;
padding: 20px 10px;
border-radius: 60px;
background: ICE (#FDFDFF);
display: flex;
flex-direction: column;
align-items: center;
gap: 20px;
```

**Contains:**
- H4 Label: "incomplete." / "completed." (DEEP color)
- JourneyGrid component (`showLabel={false}`)

---

## 4. JOURNEY GRID SPECIFICATION

### Shared Component (Zone + Fork)

**Container:**
```css
display: flex;
flex-direction: column;
width: 100%;
align-items: center;
gap: 20px;
```

**Grid:**
```css
display: grid;
gap: 20px;
width: 100%;
justify-items: center;
```

**Mobile (≤640px):**
```css
grid-template-columns: repeat(3, 1fr);  /* 3×3 grid */
```

**Tablet/Desktop (≥641px):**
```css
grid-template-columns: repeat(6, 1fr);  /* 6 journeys top, 3 centered bottom */
```

---

### Journey Button

**Dimensions:**
```css
width: 80px;
height: 80px;
border-radius: 40px;
```

**Styling:**
```css
background: COOL (#F8F8FE);  /* NEVER changes */
border: none;
display: flex;
align-items: center;
justify-content: center;
cursor: pointer;
transition: background 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
            color 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
```

**Typography:**
- Font: Roboto
- Size: 10px
- Line-height: 14px
- Letter-spacing: 0
- Weight: 900
- Transform: uppercase
- Text-align: center

**Text Colors:**
- Incomplete: BLUE (#000AFF)
- Completed: PINK (#E80DAD)

**Interaction States:**
- Default: COOL bg, BLUE/PINK text
- Hover: DEEP bg (#141268), ICE text (#FDFDFF)
- Active/Pressed: DEEP bg, ICE text
- Return: COOL bg, original text color

**Button Text:**
- First word of journey name (uppercase)
- Examples: "HOME", "TRAVEL", "FOOD", etc.

---

### JourneyGrid Props

```typescript
interface JourneyGridProps {
  completedJourneys?: JourneyId[]     // Array of completed journey IDs
  onJourneyClick?: (id: JourneyId) => void  // Click handler
  showLabel?: boolean                 // Show internal label (false in Zone/Fork)
}
```

---

## 5. SPACING CALCULATIONS

### Fork Page Vertical Spacing

| From Element | To Element | Space |
|--------------|------------|-------|
| Page top | Logo | 20px (margin-top) |
| Logo | H3 | 10px (gap) |
| H3 | Incomplete Container | 10px (gap) |
| Incomplete Container | Zone CTA | auto (pushes to bottom) |
| Zone CTA | Page bottom | 40px (padding-bottom) |

**Total Content Height:** Variable (depends on journey count)

---

### Zone Page Vertical Spacing

| From Element | To Element | Space |
|--------------|------------|-------|
| Page top | Tagline | 30px (absolute) |
| Page top | Header | 0 (starts at top, logo has margin-top: 40) |
| Header | "best." label | 0 → 40px margin-top |
| "best." label | Hero Pod | 20px (margin-bottom) |
| Hero Pod | "latest." label | 40px (margin-top) |
| "latest." label | Latest Grid | 20px (margin-bottom) |
| Latest Grid | Savings | 0 → Savings conditional |
| Savings | "do next." label | 40px (margin-top) |
| "do next." label | Do Next Grid | 20px (margin-bottom) |
| Do Next Grid | Incomplete Container | 40px (margin-top from incomplete label) |
| Incomplete Container | FloatingNav | 100px (padding-bottom) |

**Total Minimum Height:** 100vh (with 100px bottom padding)

---

## 6. RESPONSIVE BREAKPOINTS

| Breakpoint | Value | Usage |
|------------|-------|-------|
| Mobile | ≤640px | Single column layouts, mobile typography |
| Tablet | 641px - 1023px | 2-column grids, mobile typography |
| Desktop | ≥1024px | 3-column grids, desktop typography, max-widths |

---

## 7. COMPONENT QUANTITIES

### Zone Page Pod Distribution

- **Pod-1 (Hero):** Exactly 1
- **Pod-2 (Latest):** Exactly 3
- **Pod-3 (Do Next):** Exactly 3
- **Total Pods:** 6 (hard limit)

**Logic:**
- Hero is selected from highest-scoring item with variant 'pod-1'
- Latest: Top 3 items with variant 'pod-2'
- Do Next: Top 3 items with variant 'pod-3'
- Falls back to placeholders if insufficient data

---

### JourneyGrid Quantity

- **Total Journeys:** 9 (fixed)
- **Grid Layout:** 3×3 (mobile), 6+3 (desktop)
- **Journey Order:** Fixed sequence (Home, Travel, Food, Shopping, Money, Carbon, Tech, Waste, Holidays)

---

## 8. INTERACTION PATTERNS

### Pod Interactions

**Click Behavior:**
- Pod-1, Pod-2, Pod-3: Opens Sheet component
- Exception: Journey-type pods navigate to `/journeys/{journeyId}`

**Hover States:**
- Pod containers: Cursor pointer if `onClick` provided
- Arrow CTAs: No hover change (BLUE always)
- Journey buttons: COOL → DEEP (hover), ICE text

---

### JourneyGrid Interactions

**Click:** Navigates to `/journeys/{journeyId}`

**Hover:** Background COOL → DEEP, text → ICE

**Active/Pressed:** Background DEEP, text ICE

**Return:** Background COOL, original text color

---

## 9. DATA DISPLAY RULES

### Missing Values

- **Image:** Placeholder URL used (`https://picsum.photos/1200/800?blur=1`)
- **Data:** Shows "n/a" if `carbon` or `money` is missing/undefined
- **Labels:** Always visible (CO₂ SAVING, MONEY SAVING, SOURCE)

### Data Format

- **Carbon:** Displayed as-is (e.g., "0.18t", "n/a")
- **Money:** Prefixed with "£" in Savings Statement, displayed as-is in Pods (e.g., "50.", "£50")

---

## 10. FLOATING NAVIGATION

**Component:** FloatingNav  
**Position:** Fixed bottom  
**Background:** ICE  
**Active State:** BLUE background for active tab

**Tabs:**
- Zone (active on Zone page)
- Likes
- Summary (routes to `/fork`)
- Settings

---

## 11. SHEET COMPONENT

**Trigger:** Pod click (except journey-type pods)  
**Content:** 
- H2 title
- BODY subtitle (optional)
- Data row (money + carbon, if available)
- Close: Arrow CTA

**Overlay:** ICE background, semi-transparent  
**Sheet:** Slides up from bottom, rounded top corners

---

## 12. FINAL VALIDATION CHECKLIST

### Fork Page
- ✅ Logo: 51×81px, BLUE, margin-top: 20px
- ✅ H3 heading: "continue or go to your zone." (50px/48px)
- ✅ Incomplete Container: 320px width, 60px radius, ICE background
- ✅ Incomplete Label: H4, DEEP color, "incomplete." / "completed."
- ✅ JourneyGrid: Shared component, `showLabel={false}`
- ✅ Zone CTA: 80×80px, BLUE background, ICE text, "ZONE"
- ✅ Spacing: 10px gaps, 40px bottom padding

### Zone Page
- ✅ Tagline: Top-left (30px, 30px), LABEL style, BLUE
- ✅ Logo: 51px, margin-top: 40px
- ✅ Personal Message: H3, conditional colors (name/level: BLUE, "you're doing": DEEP)
- ✅ Ask Zero: 350px InputField, COOL background
- ✅ Section Labels: H4, DEEP color, 40px top margin, 20px bottom margin
- ✅ Pod-1 (Hero): 370×658px mobile, 960×420px desktop
- ✅ Pod-2 (Latest): 370×278px image, 330px text container, 3 items
- ✅ Pod-3 (Do Next): 330px width, alternating BLUE/COOL, 3 items
- ✅ Savings Statement: 370px width, 60px radius, BLUE background, H3 typography
- ✅ Incomplete Container: Same as Fork (320px width, 60px radius)
- ✅ JourneyGrid: Shared component, `showLabel={false}`
- ✅ FloatingNav: Fixed bottom, active state highlighted

### Typography
- ✅ All headings: -2px letter-spacing
- ✅ All DATA: -2px letter-spacing
- ✅ All LABEL/BODY: 0 letter-spacing
- ✅ H3 mobile: 50px/48px (not 60px)
- ✅ Line-heights match spec exactly

### Colors
- ✅ No ICE buttons (except primary CTAs)
- ✅ Button backgrounds: COOL (default), BLUE (primary CTAs only)
- ✅ Completed state: PINK text only, COOL background unchanged
- ✅ Section labels: DEEP color

---

## END OF SPECIFICATION

**Status:** Production Ready  
**Last Updated:** Final Lock Applied  
**All components match locked design system.**
