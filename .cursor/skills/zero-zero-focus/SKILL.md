---
name: zero-zero-focus
description: >-
  Zero Zero (00-00) app — Next.js App Router, Zone/Solo Focus, Framer Motion, UK copy,
  postcode-driven location. Use for every implementation task in this repo and when the
  user asks for focus, discipline, skills, or “stay on scope”. Loads project rules before
  UI or journey logic changes; routes to compound-engineering skills when the user’s
  intent matches (debug, plan, brainstorm, commit, PR, polish).
---

# Zero Zero — focus and skills

## 1. Load project rules before product code changes

When editing `app/**`, `lib/**`, or user-facing copy, **read** (Read tool):

- `HANDBOOK.md` (single project reference: flow, APIs, env, migrations — includes **Intelligence Loop**, mechanical truth, Hermes → Firecrawl/Gemini → Zone)
- `docs/PROFILE-ANSWERS-ZONE-TECH.md` (12×3 questions, profile/answers API, scrape-sync pending vs stream-filled Zone)
- `.cursor/rules/mechanical-pulse.mdc`
- `lib/logic/engine.ts` (economic truth, regional grid tiers, audit placeholders)

If they conflict with an explicit user request, **the user wins**; otherwise treat them as the design and interaction contract.

## 2. How Cursor skills are supposed to work

| Location | Purpose |
|----------|---------|
| **This repo:** `.cursor/skills/<name>/SKILL.md` | Project skills (versioned, shared with the team). |
| **Personal:** `~/.cursor/skills/<name>/SKILL.md` | Your machine-only skills. Create the folder if you add personal skills. |
| **Built-in:** `~/.cursor/skills-cursor/` | Reserved for Cursor — **do not** add or edit files there. |

The model discovers skills from the **`description`** in each `SKILL.md` frontmatter. Write descriptions that include **what** the skill does and **when** to use it (trigger words).

## 3. Compound Engineering skills (ce-*)

When the user’s message matches a workflow, **read that skill’s `SKILL.md` first** and follow it.

**If your session includes an `available_skills` list with full paths:** use those paths directly (they are authoritative for this Cursor install).

**If you need a path and none is listed:** resolve the newest plugin copy on disk (read-only):

```bash
find "$HOME/.cursor/plugins/cache" -path '*/compound-engineering/*/skills/<SKILL_ID>/SKILL.md' 2>/dev/null | head -1
```

Replace `<SKILL_ID>` with e.g. `ce-work`, `ce-debug`, `ce-plan`, `ce-brainstorm`, `ce-commit`, `ce-code-review`, `ce-frontend-design`.

## 4. Focus bar (execution)

- One clear objective per turn unless the user asked for a menu or audit.
- Prefer small, reviewable diffs; do not “clean up” unrelated files.
- After substantive TypeScript changes, run **`npm run check`** from the repo root.
- **Region** is derived from **postcode** and APIs — do not reintroduce a manual region onboarding step.
- **Profile summary** (`app/profile/summary`): staccato **opacity ticker** (`IntroWordCycle` + `opacityTicker`); do not add glitch / count-up graphics there unless the user explicitly asks.

## 5. Ulm JIT — use less, more

- **Models:** `gemini-1.5-flash` for zone, article, and chat (`lib/intelligence/geminiModels.ts`). Temperature **0.2** for research triplets (`GEMINI_PRECISION_TEMPERATURE`).
- **Earned research:** Firecrawl/Gemini only after Tip +1 in Solo Focus (`runTipVerificationDeepScrape`). `POST /api/scrape-sync` trigger **requires** `journey_key` (Topic Shield).
- **Pink lock:** Visited cards must not re-trigger `triggerScrapeSyncForCategory`.
- **Lead Auditor:** `ULM_LEAD_AUDITOR_SYSTEM` in `geminiModels.ts` — Monocle forensic, 3 paragraphs, heading max 7 words.

## 6. If skills still feel “broken”

Ask the user to confirm in **Cursor Settings → Rules / Skills** that project skills are enabled and the workspace is the `00-00` repo root (not a parent folder). Reload the window after adding new `.cursor/skills/` directories.
