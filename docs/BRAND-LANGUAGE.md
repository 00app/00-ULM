# Zero Zero brand language (v1, Oct 2026)

Source of truth: the front door, `app/front-door/front-door.css` and `FrontDoor.tsx`. Every new surface (Workspace, Zone intelligence layer, Action Centre, playback, emails) is built in this language. Where the app's older v1.x styles (uppercase headings, weight 900, Abril numerals, 60px radii, circle CTAs) conflict, this document wins for new work. Existing screens migrate when they are next touched, not in one big restyle.

## Principles

1. Calm, confident, factual. Big type does the work; decoration does not.
2. One typeface, one weight. Hierarchy comes from size, colour and space.
3. Every number shows its source and date, close to the number.
4. Motion explains: things arrive, reveal or progress. Nothing loops for attention.
5. Straight and level. No tilted cards, tickers, gradients or glow.

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| `--fd-blue` | #000AFF | Primary action, emphasis words, indices, progress |
| `--fd-navy` | #141268 | Dark surfaces, hero cards, dark buttons, footer |
| `--fd-ink` | #04031C | Body and headline text on light |
| `--fd-muted` | #4B4A6B | Secondary text on light (passes 4.5:1) |
| `--fd-muted-light` | #C9C8E6 | Secondary text on navy |
| `--fd-line` | #E3E3EF | Hairlines and card borders on light |
| `--fd-line-dark` | #2C2A7C | Hairlines on navy |
| `--fd-tint` | #F4F4FB | Alternate section ground, chips, icon buttons |
| `--fd-white` | #FCFCFF | Page ground, text on navy and blue |

Pink and yellow are not part of this language. Colour never carries meaning alone.

## Type

Typeface: Helvetica Neue LT Pro (Typekit), weight 400 everywhere, sentence case, tabular numerals. Numerals stay in Helvetica (no Abril) on new surfaces.

| Role | Size | Tracking | Line height |
| --- | --- | --- | --- |
| Display | clamp(52px, 8.6vw, 136px) | -0.045em | 0.92 |
| H2 | clamp(40px, 5.6vw, 88px) | -0.04em | 0.95 |
| Statement | clamp(34px, 4.8vw, 72px) | -0.035em | 1.04 |
| Stat value | clamp(56px, 5.4vw, 84px) | -0.045em | 0.95 |
| H3 | clamp(26px, 2.4vw, 34px) | -0.025em | 1.05 |
| H4 | 22px | -0.015em | 1.15 |
| Lede | clamp(18px, 1.5vw, 21px) | normal | 1.55 |
| Body | 16 to 17px | normal | 1.5 to 1.55 |
| Eyebrow | 13px, uppercase | 0.06em | normal |
| Meta and source | 12 to 13px | normal | normal |

Eyebrow pattern: `(01)` in blue, then the label in muted uppercase. Indices are zero-padded: 01, 001.

Inside the app shell, the global type lock must be lifted the way `front-door.css` does it (`:not(#zzfd)` with `!important`), or the shared brand stylesheet must do it once for a scope class.

## Space and shape

- Container max 1360px; gutter clamp(16px, 4vw, 48px); section padding clamp(96px, 13vw, 176px).
- Cards: 24px radius, 1px `--fd-line` border, 32px padding; hover lifts 6px and adds a soft navy shadow.
- Pills, buttons and chips: fully rounded (999px).
- Lists and stats are separated by hairlines, not boxes.
- Touch targets at least 44px.

## Components

- **Buttons:** blue (primary), navy (dark), white (on blue); heights 44, 52, 64; text plus a 16px arrow that nudges 3px on hover; press scales to 0.98.
- **Pill:** hairline border, 7px blue dot, 13px muted text. For status and freshness ("Price cap figures for…").
- **Chip:** tint ground, navy text, 12 to 13px. For effort, tier, tag.
- **Insight hero card:** navy surface, 18 to 24px radius; label, headline (22 to 28px), source line, white primary pill plus outline secondary.
- **Action row:** title, one-line meta in muted, tag chip right; rows split by hairlines inside a bordered list.
- **Stat:** index, big value, label, underlined source link; columns split by hairlines.
- **Step rail:** 2px line that fills blue with scroll progress; big blue step numbers.
- **Accordion:** hairline rows, blue index, 44px round tint icon that rotates to a cross.
- **Focus:** 2px blue ring with a 3px white gap on every interactive element.

## Motion (Framer Motion)

- Ease: `[0.22, 1, 0.36, 1]` everywhere. Durations 0.35 to 1.1s.
- **Mask reveal** for headings: the line rises from 105% inside an overflow-hidden mask. Trigger on the mask, never on the clipped inner line.
- **Rise** for blocks: opacity 0 to 1, y 32 to 0, once, staggered 0.08 to 0.12s.
- **Count-up** for figures: 1.6s, starts when in view, final value in `aria-label`.
- **Scroll-linked:** subtle parallax (40 to 90px), statement ink-in, progress rails. Never more.
- **Hover:** lift 6px on cards; underline draws left to right on links.
- `MotionConfig reducedMotion="user"`; counters show the final value when motion is reduced.
- Not allowed: tickers and marquees, looping pulses, tilt, bounce, confetti.

## Gravity Grid (background field)

The one ambient layer, beside the glitch logo as the brand's only decorative motion. A grid of pale dots sits behind the UI on the page ground, bends toward the finger or cursor like gravity, leaves a faint blue trace and settles back.

- Tokens: `FIELD` in `lib/brand/field.ts`; colours also as `--field-ground` (#FCFCFF), `--field-rest` (#D9DCF2) and `--field-blue` (#000AFF) in `app/styles/brand.css`.
- Grid: 12px pitch (never smaller), 1px dots. The ground is the page; the field never paints it.
- It only answers input: drag, tap, hover and scroll. It never loops or moves on its own, and sleeps when settled.
- No bounce: dots settle critically damped (`spring.bounce` is `false`).
- It sits behind every surface. Cards, navy and blue sections, sheets and buttons keep their fill and hide it.
- Text containers marked `data-field-quiet` (plus a 14px margin) cap the trace tint at 0.12, so even muted body copy keeps 4.5:1 against every dot.
- Reduced motion: no dot moves; tap and drag show tint only.
- Never blocks input: `pointer-events: none`, passive listeners, no `preventDefault`, no `touch-action`.

## Voice

Short sentences. Plain words. Numbers with units and sources. "You approve every step." Never "AI-powered", never exclamation marks, never fear.
