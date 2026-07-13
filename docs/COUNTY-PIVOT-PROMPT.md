# Zero Zero — County-Level Pivot: Implementation Prompt

Paste this whole document as the prompt for a Claude Code session to execute. It's written to be self-contained — no prior conversation context required.

## Context

Zero Zero (00-00) is a UK postcode-driven energy/carbon-savings app (Next.js, Vercel, Neon Postgres, live at www.00-00.online). Today, content (£/carbon tips per category) is generated live, per exact postcode, by calling third-party LLM APIs (Gemini direct, then a Groq/Mistral/OpenRouter bucket-failover chain) at request time. On the free tier this pipeline is unreliable — provider quota/credit exhaustion is a standing problem, not an occasional one — and the resulting content is thin, sometimes falls back to generic templates, and isn't consistently good enough to run real Awin affiliate offers against.

**The pivot**: stop generating content live via third-party LLMs at request time. Instead, generate content offline (via Claude Code, i.e. an agent session — not a runtime API call) at **county** granularity, push it to the database, and have the app serve from that pre-generated store. Postcode is kept only to resolve which county/town a user is in for display and insights — it stops being the key that content is generated or cached against.

## Goals, in priority order

1. Disconnect (**not delete**) the live LLM scraping pipeline and Hermes (the cron-based repair/seed sweep), behind a flag, so it can be turned back on later without rebuilding it.
2. Add a first-screen choice: **"Set up a profile"** or **"Continue as guest"** — reuse existing UI components/patterns, no new design system.
3. Guest path: no postcode required. Lands on a UK-wide Zone page with the same shape as today — today's tips split into morning/noon/night, plus the 12-category wall — filled with real, generic UK £/carbon content and Awin-trackable offers.
4. Profile path: keep postcode capture (for town display + insights, e.g. "afternoon, Gary" style personalization), but resolve it to a **county** and serve content keyed by county.
5. Two content types going forward:
   - **Daily tips** (morning/noon/night) — same cadence as today.
   - **Weekly recommendations** — a new, separate content layer injected on a weekly cycle, not daily.
6. Content generation becomes a Claude-Code-driven batch job: for each UK county, produce genuine £/carbon tips across all 12 categories (home, utilities, solar, travel, holidays, food, shopping, money, tech, water, waste, carbon), then push to Neon.
7. Ensure Awin affiliate links are correctly wired into every piece of generated content so this is actually monetizable. Awin routing logic already exists (`lib/monetization/awinAffiliateLink.ts`, journey-keyed, multi-programme host support) — extend/reuse it, don't rebuild it.

## Explicit constraints

- **Don't delete anything.** Disable the LLM pipeline and Hermes behind a feature flag (e.g. `CONTENT_SOURCE=llm-live | county-static`, or similar). All existing code, tables, and columns stay intact and revertible.
- **Reuse existing UI.** The profile/guest choice screen, the Zone wall, the morning/noon/night tips section — all use current components and visual language. This is a data/routing change, not a redesign.
- **Postcode is not discarded.** It's still captured for profile users, still drives town-name display and personalization copy, still feeds `research_results`/insight rows for "where they live" context. It just stops being the *generation key* — county is.
- **research_results and related tables are not migrated or deleted.** New county-keyed rows are additive. Decide during implementation whether existing postcode-keyed rows get backfilled to a county mapping or simply age out unused — don't destroy them either way.

## Scope breakdown

### A. Disconnect the live pipeline (reversible)

- Identify every call site that triggers live LLM generation at request time: `app/api/scrape-sync/route.ts`, `lib/agents/researchAgent.ts` (`resolveResearchTripletWithRecovery`, `extractResearchTripletWithGemini`, bucket failover chain), `lib/agents/zeroAgent.ts`, and the Hermes cron routes (`app/api/cron/repair-mechanical/route.ts` and any other scheduled sweep).
- Gate all of them behind a single, clearly-named flag. When off: these code paths should no-op or short-circuit to reading from the new county-static content store instead of calling any LLM.
- Do not remove the flag's "on" behavior — it should be trivially re-enablable once the team wants live generation back (e.g. once a paid tier is in place).
- Hermes' cron schedule should be paused/disabled at the Vercel cron config level (not deleted) so it stops firing while the flag is off.

### B. Entry flow: profile vs guest

- New first screen (or extend the existing intro/onboarding entry) with two choices: "Set up a profile" and "Continue as guest".
- "Set up a profile" → existing onboarding flow, postcode + questions (minus house number, which is being removed from profile — separate small task, do this too), landing on the profile-scoped Zone page.
- "Continue as guest" → skip postcode/onboarding entirely, land directly on the UK-wide guest Zone page.
- Guest → profile upgrade path: a guest should be able to set up a profile later without losing their session/likes if that's feasible with current session handling; if not trivially feasible, note it as a follow-up rather than blocking this work.

### C. Guest experience

- Guest Zone page: same shape as the current logged-in Zone wall — today's tips (morning/noon/night) + 12-category card grid — but content is **UK-wide generic**, not personalized to any location.
- This needs its own "UK" pseudo-county bucket in the content store (a `county = 'UK'` or similar generic row set) rather than picking one real county arbitrarily.
- All content must still carry Awin-wrapped offer URLs — guest traffic should be just as monetizable as profile traffic.

### D. Profile experience — county resolution

- On postcode capture, resolve to a county (or the closest equivalent — England's ceremonial counties, Scotland's council areas, Wales' principal areas, NI's districts all differ; use whatever granularity the existing `getLocalData`/postcodes.io integration already surfaces — check `lib/local/getLocalData.ts`, it already returns council/region data from a prior session's work, likely the right source to key off rather than inventing a new geo lookup).
- Store the resolved county on the user record (or derive it on each read — decide based on how often it needs to be re-resolved).
- Zone page for profile users reads county-keyed content, but still shows the user's town name (from postcode) in headline/personalization copy, matching today's "afternoon, Gary" / locality-aware tone.

### E. Content model changes

- New table or a type-discriminated extension of `research_results` for county-keyed content. Decide during implementation: separate table (`county_research_results`) vs. reusing `research_results` with a `county` column and `postcode` made nullable for these rows. Recommend a new table if the schema divergence (no postcode, added `county`, added `content_type`) is significant enough to avoid overloading the existing one — but check `lib/schema.sql` and weigh migration cost either way.
- `content_type` distinguishes daily tips (morning/noon/night, one of each per category or a rotating set) from weekly recommendations (a separate, less frequent set).
- Weekly recommendations need an injection mechanism — likely a lightweight cron (kept, not disconnected — this is new, low-frequency, not part of the "Hermes" live-scraping shutdown) that rotates which recommendation surfaces each week per county, from a pre-generated pool.

### F. Content generation workflow (the actual "push it ourselves" part)

- This is the piece Claude Code does directly, offline, as an agent task — not a runtime API call the app makes.
- For each UK county (get the canonical list — England ceremonial counties + Scotland council areas + Wales principal areas + NI districts, or whatever granularity matches what `getLocalData` already resolves to, to avoid a mismatch between what's stored and what's looked up):
  - Generate genuine, county-specific £/carbon tips across all 12 categories, morning/noon/night variants for daily tips, plus a pool of weekly recommendations.
  - Ground figures in real, current UK data (price cap, DEFRA carbon factors, etc. — reuse `lib/brains/constants.ts`'s existing truth-locked constants rather than inventing new figures).
  - Write directly to Neon via a script (`scripts/generate-county-content.ts` or similar), not through the live API route.
- This is a large, repetitive content-generation task — good candidate for a `Workflow` (multi-agent) run once the schema/plumbing above is in place, fanning out one agent per county or per category-batch. Don't build the workflow until steps A–E are solid; sequence this last.

### G. Awin integration

- Every generated tip/recommendation's `offer_url` must go through the existing `wrapWithAwinAffiliateLink` (journey-keyed) before being stored or served, exactly as live-generated content does today.
- Verify the existing merchant program mappings (moneysupermarket.com energy/money split, Back Market, Pod Point, etc.) still apply correctly to county-generated content — these were journey-keyed, not postcode-keyed, so they should carry over cleanly, but confirm.

## Open decisions to make during implementation (don't block on these, decide and note them)

- Exact county list/granularity (tie to what `getLocalData` already resolves).
- New table vs. extended `research_results` for county content.
- Whether guest sessions can upgrade to a profile without losing state.
- Weekly recommendation rotation mechanism (cron vs. on-read rotation).
- Whether any existing users' postcode-keyed data gets backfilled to county content immediately, or the county store starts empty and fills in as counties are generated.

## Suggested phasing

1. Remove house number from profile (small, standalone).
2. Feature flag + disconnect live LLM pipeline and Hermes cron (reversible).
3. County resolution on postcode capture (reuse existing locality data).
4. New content table/columns for county-keyed daily tips + weekly recommendations.
5. Entry flow: profile vs guest screen; guest UK-wide Zone page wired to a `UK` generic content bucket.
6. Profile Zone page reads county-keyed content instead of postcode-keyed live generation.
7. Awin wrapping confirmed on all new content paths.
8. Content generation workflow: batch-generate real content for all counties (start with a handful to validate quality before running the full set).

## Acceptance criteria

- Toggling the feature flag off stops all live LLM calls (verify via logs — zero Gemini/Groq/Mistral/OpenRouter calls with the flag off) without deleting any code.
- New visitor sees profile-vs-guest choice; guest reaches a fully-populated UK Zone page with no postcode entry.
- Profile user's Zone page shows their town name in copy but content matches their county's pre-generated store, not a live per-postcode call.
- Every tip/recommendation card has a working Awin-wrapped offer link.
- `npm run verify` (typecheck, lint, mechanical-truth, onboarding-intelligence) passes throughout — update/extend those suites as the data model changes rather than letting them silently pass on stale assumptions.
