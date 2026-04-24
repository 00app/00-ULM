# Zero Zero Funky Component Library (v1.4)

Bespoke, modular design system. Four core files lock the app into the 60s design language. No overlapping, no shadows, pure flat UI.

## Design mandates (do not deviate)

- **Zero shadows:** `box-shadow: none`, `text-shadow: none`.
- **Typography:** Marvin Visions Bold for labels/numbers/1-word; Roboto 900 headings; Roboto 400/700 body.
- **Radiuses:** Buttons/inputs `9999px` (pills); chat bubbles `32px`; bento `48px`.
- **Layout:** 4px progress bar (no text); exact 40px margin to answer area; 10px spacing for Zai input above nav.

## The 4 core files

| File | Role | Components |
|------|------|------------|
| **Buttons.tsx** | 1. Kinetic Buttons (CTAs & Answers) | `FunkyCircleCTA`, `FunkyAnswerPill` — Swish physics baked in |
| **Inputs.tsx** | 2. Form Elements (Inputs & Toggles) | `FlatTextInput`, `FlatNumberInput`, `FlatToggle` |
| **QuestionLayout.tsx** | 3. Question Engine | `ProgressBar` (4px), `QuestionContainer` (40px drop), `AbsoluteSlider` |
| **ChatElements.tsx** | 4. Zai (Chat) & Agent | `ZaiChatBubble`, `ZaiInputBar` — use `ZAI_INPUT_MARGIN_ABOVE_NAV_PX` (10px) above FloatingNav |

Additional: `BentoCards.tsx` (preview/expanded bento). `SettingsElements.tsx` re-exports `FlatToggle` from Inputs for backward compatibility.

## Layout rules

- **QuestionContainer:** Answer area (children) starts exactly **40px** below the question heading.
- **ZaiInputBar:** When used above the bottom nav, keep **10px** vertical spacing from the FloatingNav (e.g. `paddingBottom: 90px` on the chat container for 80px nav + 10px gap).
- **ExpandedBentoCard:** Trinity of CTAs, then **40px** margin, then the question/context trap slot.

## Usage

```tsx
import { FunkyCircleCTA, QuestionContainer, ProgressBar, ZaiChatBubble } from '@/app/components/ui'
```

Or import from the barrel:

```tsx
import { FunkyCircleCTA, FlatTextInput } from '@/app/components/ui'
```
