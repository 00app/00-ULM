# Director's Order — Frozen Product Sequence

This document defines the unbreakable user experience and architecture contract for the Zero Zero (00-00) application loops, cards, transitions, and states. All AI agents, scrapers, and routers must strictly respect these specifications.

## 1. The Home Cascade (Unbreakable Sequence)

Grid rendering and transition gates must strictly follow this order. The client grid must **NOT** increment `revealedCardCount` or render bento items until all prior gates are completely resolved:

| Step | Route / Surface | Gate |
|:----:|:----------------|:-----|
| **1** | `/` or `/intro` | Glitch logo boots (`GLITCH_ANIM_MS` ~469ms) -> Marvin-styledStacked Call to Action completes. |
| **2** | `/profile` -> `/profile/summary` | `SummaryHeader` kinetic word cycle (`opacityTicker`) blur 15px -> sharp letters completes (`handleCycleComplete` exit). |
| **3** | `/zone` | `ArchitecturalPulse` atomic word ticker completes -> sets `pulseWordsComplete = true` -> bento card ripple staggers (`ZONE_ATOMIC_BENTO_VARIANTS` with delay `0.12s`). Today's Tips (Rock) renders last. |

---

## 2. Solo Focus & The Loop Contract

The card state machine enforces structural safety. Any revisit or closing behavior must strictly align with this state table:

| Card Type | Lifecycle State / Action | Expected Transition | state (Atomic Pink) |
|:---|:---|:---|:---:|
| **Mother Category Bento** (12 Journeys) | First open -> answer option selected -> **RESULT** shown -> close card. | Triggers **`DiscoveryTakeover`** (exactly one loop question per journey). Once answered, client spawns new discovery child. | **Atomic Pink** `#FF00FF` (`completeCleanBirth`) |
| **Discovery Child** (`inject-*`) | Open Solo Focus -> view local verified audit details -> close card. | Closes immediately to grid. No loop question is mounted. | **Atomic Pink** `#FF00FF` (`shouldCloseMarkPinkOnly`) |
| **Rock Tip** (Habits Rail) | Open habit list -> read tips -> close card. | Closes immediately to grid. No loop question or takeover. | **Atomic Pink** `#FF00FF` (`shouldCloseToGridOnly`) |
| **Revisited Card** (Pink) | Open pink bento card -> close card. | Closes immediately to grid. No loop takeover or second questions. | Remains **Atomic Pink** (`hasLoopDoneForJourney`) |

---

## 3. Ground Truth: 12,000 kWh / 1 Tonne CO₂e

- **No Placeholders**: Never show fake regional savings when database records do not exist. Return honest `COMPUTING` status strips.
- **The Grounding**: All savings, articles, and extraction targets are strictly calculated against the standard **12,000 kWh / 1 tonne CO₂e** annual domestic baseline.
- **Auditor Persona**: Zai acts as the active, lowercase, direct auditor. Zero AI apologies or filler text. Triplet results must strictly present the What, Why, and How embedded inside structural-label-free Roboto Bold paragraphs.
