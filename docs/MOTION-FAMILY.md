# 00 Family Liquid + Unified Atomic Assembly

Delivery-only motion vocabulary. **Does not** change profile questions, summary word order, zone loop logic, or `lib/brains`. Sequence is frozen in **`lib/zone/directorsOrder.ts`** + **`docs/HANDBOOK.md`** (Director's Order).

**Unified material (vibe-lock):** every surface uses the same crystallize physics — Intro/loading (`AtomicLogo`), Profile/Settings steps, Summary/Architectural Pulse ticker, Zone grid + Rock, Zai messages, loop takeover, discovery snap-in.

## Tokens (`lib/motion-family.ts`)

| Token | Value | Use |
|-------|-------|-----|
| `FAMILY_EASE` | `cubic-bezier(0.22, 1, 0.36, 1)` | All family tweens |
| `FAMILY_DUR_LONG` | `0.8s` | Chapter changes (profile step, page shell) |
| `FAMILY_DUR_ATOMIC` | `1.0s` | Crystallize: blur cloud → sharp lock |
| `FAMILY_DUR_SHORT` | `0.4s` | Likes, hovers, word exit, controls |
| `familyAtomicAssembly` | blur + letter-spacing + scale | Summary ticker, Architectural Pulse, loop question |
| `familyReveal` | blur → sharp (no letter-spacing) | Profile headline, settings cells |
| `familyGlide` | 15px **vertical rise** + blur | Profile step swap (legacy name) |
| `familyAtomicSurface` | rise + blur + scale | Cards, screens, zone cells, Solo Focus |
| `familyAtomicTextProps` | surface + letter-spacing | Intro / summary opacity ticker |
| `ZONE_ATOMIC_BENTO_VARIANTS` | blur cloud → card | Zone grid ripple (exported as `ZONE_BENTO_CELL_VARIANTS`) |

## Reading-speed contract

- `FAMILY_READ_MS_PER_WORD` = **200ms** minimum sharp dwell per word after assembly.
- `atomicWordHoldMs(text)` = **1000ms** assembly + `readingSpeedDwellMs(text)`.
- Wired on `/profile/summary`, Architectural Pulse, and `IntroWordCycle` + `opacityTicker`.

## Surfaces

| Surface | Motion |
|---------|--------|
| `/` + `/intro` | `AtomicLogo` power-on + atomic `IntroWordCycle` (`opacityTicker`) |
| Loading routes | `AppBootGlitch` → `AtomicLogo` loop |
| `/profile` | Centered atomic cross-fade (`familyProfileStepProps` = atomic) |
| `/profile/summary` | Atomic ticker + `atomicWordHoldMs` read buffer |
| Zone | Pulse words → atomic grid ripple (rise + blur, **0.12s** stagger) → expand shell |
| Loop / discovery | Atomic headline; discovery tip atomic snap-in |
| `/zai` | Page + messages `familyAtomicProps` |
| `/likes`, `/settings` | `familyPageEnterProps` + atomic cells |

## Director's order (Zone)

1. Summary atomic ticker completes (`pulseWordsComplete`).
2. Bento grid ripples (crystallize, stagger `ZONE_GRID_STAGGER_CHILD_DELAY_SEC`; reveal interval **2×** child delay in `app/zone/page.tsx`).
3. `revealedCardCount` stays stable when scrape-sync adds rows — no reset-to-zero flash mid-session.
4. Today's tips (Rock) last — **no loop** on close.

Journey loop: expand → close → **one** loop → discovery → **pink** (`markCardVisited` in `completeCleanBirth` only).

## Zone expand (Solo Focus)

Industrial zip-shut / opacity snap on `ExpandedCardShell` — **no `layoutId` morph** (morph broke close → loop handoff). `FAMILY_MOTION_SCALE` (0.7) speeds all family durations ~30%.

## Protected

Boot / intro glitch keyframes in `globals.css`. Industrial tokens in `lib/animations.ts` for Solo Focus zip-shut.

## Hover

- `.zz-family-bloom` — scale 1.02 + gold drop-shadow (likes/settings/profile CTAs).
- `.zz-atomic-hover` + `FAMILY_ATOMIC_HOVER` — 1px jitter on zone journey cards.
