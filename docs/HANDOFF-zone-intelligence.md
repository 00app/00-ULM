# Handoff: Zone intelligence layer (PRD v4)

Date: 25 Oct 2026. PRD v4: https://claude.ai/artifact/8eJ2WsMJJZQtCLFj6mCbcc
Read HANDBOOK.md, docs/BRAND-LANGUAGE.md, docs/INTELLIGENCE-LOGIC.md and this file before each prompt. INTELLIGENCE-LOGIC.md is the build spec for Z3 to Z12: category facts, metrics, rules, scoring, questions and Solo Focus layout. Run one prompt at a time; verify on a preview deployment; report back; stop.

Rules for every prompt:
- Mechanical truth: no £ or kg without source, as-of and confidence. Missing stays missing, never 0. Keep the existing rule in lib/zone/recCard.ts that drops a figure without a source.
- Build on existing code (action library, loop questions, bank analysis, truth ledger, intelligence clients, Solo Focus, zone agents). Extend; do not duplicate.
- Rules decide, AI explains: figures, eligibility and ranking come from code. Gemini (via lib/intelligence/aiGateway.ts) writes wording only and is checked against tool values.
- Agents prepare, people approve. Nothing irreversible without a tap.
- All new or changed UI follows docs/BRAND-LANGUAGE.md, using the shared tokens and motion from Z1.
- Synthetic data only in dev and tests. No sensitive questions (health, ID, logins, account numbers).

## Z1: Brand tokens and motion

```
Read docs/BRAND-LANGUAGE.md. Extract the front door's language into shared pieces, with no visual change to any existing screen:
- app/styles/brand.css: colour, type, space and radius tokens as CSS variables, plus one scope class (.zz-brand) that lifts the app's global type lock the way app/front-door/front-door.css does (:not(#id) with !important). Import once in app/layout.tsx.
- lib/motion/brand.ts: EASE, Rise, RevealOnView (trigger on the mask, not the inner line), CountUp, InkWord, reduced-motion handling, moved out of app/front-door/FrontDoor.tsx.
- Refactor the front door to use both. It must look and move exactly as before.
Test: screenshots of /front-door at 1440 and 390 before and after match. No other route changes.
```

## Z2: Audit Zone intelligence (read only)

```
Read only, change nothing. Map against PRD v4:
1. Every Zone and Solo Focus card type: component, data source, ranking (buildZoneViewModel, gridOrder, directorsOrder, rails, recCardFromZone, selectActions).
2. Every £ and kg: where calculated, and whether it carries source, as-of and confidence.
3. Profile data collected (onboarding, loop answers, property prefill), where stored, which cards use it.
4. Intelligence clients in lib/intelligence: what each returns, caching, which categories use it.
5. Gemini calls: where, with what context, fallbacks.
6. For each of the 12 journeys: evidence available, gaps, library actions count.
Output one table per area (item | file | what it does | gap vs PRD v4). Stop.
```

## Z3: Household data service

```
Add lib/household/: one data service every card, agent and Zai reads from. No UI changes.
- Typed records with source, asOf, confidence and tier (1 public, 2 told us, 3 bills or bank): profile and loop answers, property (EPC and property prefill), contracts (supplier, price, start and end), subscriptions and memberships, energy, eligibility, facts (data/facts.json when present).
- Wrap existing intelligence clients and lib/bank; reuse their caching.
- Queries: getHousehold, getCategoryFacts(category), getContracts, getSubscriptions, getEligibility, getPeerComparison (nothing under 5 peers), getGaps(category).
- Seeded synthetic dataset of 1,000 fictitious UK households for dev and tests, behind a DEV flag, with stories: broadband out of contract, unused subscription, gym rarely used, insurance renewal up, EPC D eligible for a grant, fix ending soon, unmetered water with few occupants.
- Move existing card reads onto it where practical without changing behaviour.
Tests: every record has source and asOf; missing is null. Update HANDBOOK.md.
```

## Z4: Insight card contract

```
Extend lib/zone/recCard.ts into one InsightCard contract (zod) used by Zone cards and Solo Focus. Keep the existing source rule.
Fields: id, category, statusTag (live_data | ready | demo | coming_soon), headline, keyMetric (one value with source), metrics (3 to 4 for Solo Focus), why (drivers with data point and source), confidence (high | medium | low, reason), saving {kind: typical | estimated | realised | sample, gbpRange, kgRange, source}, effort (minutes, approval tier 0 to 3), options (2 or 3: impact, effort, trade-off, commission disclosure), gaps (questions with whyWeAsk and field), context (chips), nextStep, related (up to 2 card ids), tier (1 to 3).
Add a CI validator. A card that cannot meet the contract renders as Coming soon.
Tests: rejects £ without source; rejects realised without evidence; snapshot per status.
```

## Z5: Lifestyle category

```
Add 'lifestyle' as the 13th JourneyId in lib/journeys.ts and through every switch, filter, rail, label, icon and research category list that enumerates journeys (use the Z2 audit to find them).
Scope: memberships (gym, clubs), eating out and takeaways, hobby subscriptions, pet insurance and plans, personal care memberships. Streaming and phone stay in tech, groceries in food, holidays in holidays.
Add 3 loop questions (choice answers only): which memberships; visits a month per membership; eating out or ordering in per week.
Add library actions with sources and verifiedOn: pause or downgrade a low-use membership, off-peak membership, takeaway subscription vs fees, pet insurance renewal check, local leisure concessions (eligibility via existing gates).
Copy rules: value per use, no judgement words, no health inferences. kg only where a published factor exists.
Tests: lifestyle appears on Zone; no card without a source; existing 12 unchanged.
```

## Z6: Category spec files

```
Create lib/intelligence/categories/types.ts and <id>.ts for all 13 categories, exactly as docs/INTELLIGENCE-LOGIC.md sections 3 and 9 specify. Each exports: evidence (household data service fields), metrics (3 to 4, how computed, source), gaps (questions in value order, mapped to loop bank ids), rules (conditions on facts → library action ids or findings), agents (life events that switch on a zone agent).
Wire them into card building so each category's Zone card and Solo Focus read metrics, why drivers and options from the spec.
Order: tech, utilities, money, lifestyle, home deep first; the rest at tier 1 (public data plus existing library), Coming soon where data is missing.
Tests: per category, a synthetic household with the story produces the expected finding and action; no figure without a source.
```

## Z7: Value-ranked questions

```
Upgrade loop questions into value-ranked knowledge gathering, reusing lib/zone/loopQuestions.ts and loopMemory.ts.
- Score each open question: £ at stake on the cards it gates × uncertainty + deadline weight. Show the top one on the card it serves.
- One per card, max 3 per session, Skip hides it 30 days. Never ask what public data answers.
- Each question shows "Why we ask". Answer types: choice, number, date, provider picker.
- Answers store through the household data service (source "you told us", date); the card re-scores and the Zone re-ranks with the shared motion.
- Settings: "What we know" page listing every stored fact with source and date, edit and delete; delete removes it everywhere.
Tests: answering changes the card; skip respected; delete removes the field from all cards.
```

## Z8: Context and intelligence agent

```
Add lib/intelligence/context.ts: calendar (price cap dates, VAT window, grant closing dates, tax year), season (existing seasonHint and action windows), personal deadlines (contract ends, renewals, follow-ups), live grid carbon (NESO client), life events (zone agent triggers), behaviour (truth ledger signals).
Add lib/agents/home360/: produces hero (one thing that needs you now), up to 3 insights and a ranked queue of up to 10 InsightCards.
- Ranking in code: value range midpoint × confidence ÷ effort, boosted by deadlines and season, lowered by dismissals in the last 30 days.
- Gemini writes headline and why wording per household, given only the card's facts and context; tone follows existing affluence and goal logic. Check every number in the text against card values; on mismatch or timeout use library wording and log the path.
- Zai uses the same household data service as tools and returns sources and confidence.
Tests: synthetic households produce stable rankings; no number in AI text that is not in the card; fallback covered.
```

## Z9: Solo Focus deep view

```
Rebuild Solo Focus content in the brand language (.zz-brand, shared motion), keeping its open and close behaviour and journey nav:
label and freshness → headline → metric strip (count-up) → Why panel (hairline accordion, each driver with source and date) → confidence with reason → one question (from Z7) → options side by side → primary button for the recommended option with approval tier → context strip → related cards → Ask Zai (secondary) → playback rail when the task exists.
Zone cards become compact: label and status, headline, key metric with source line, confidence dot, context chip, Open.
Tests: every slot renders from the contract; screenshots at 390 and 1440; reduced motion respected; axe zero violations.
```

## Z10: Options and Action Centre

```
Add the Action Centre to the Zone, fed by the Z8 queue.
- Options compare side by side; choosing one prepares, never performs: partner switch link, cancellation or negotiation letter, calendar reminder, grant checklist.
- Approval tiers: 0 inform, 1 one tap, 2 summary then approve, 3 both account holders.
- States: new, in progress, waiting, done, dismissed (reason), snoozed. Reuse actionCompletion and switchTracker.
Tests: nothing leaves the app without an approve tap; dismissed hidden 30 days.
```

## Z11: Task record and playback

```
Extend lib/actions/actionCompletion.ts into an event log (task_events in Neon): found, opened, question answered, option chosen, approved, action sent, waiting, confirmed, realised, dismissed, follow-up due.
- Follow-ups at 30 and 60 days as ask-first cards asking for evidence (upload bill, enter new price, not yet).
- Realised saving only with evidence; label others estimated.
- Solo Focus: step rail playback per task. Zone: My progress (tasks done, £ realised vs estimated, kg cut, next deadlines) with count-up, sources under every figure. No loops or confetti.
Tests: replaying the log rebuilds the same totals; realised never exceeds evidence.
```

## Z12: Learning loop

```
Feed outcomes back into ranking.
- Per household: dismissal reasons lower similar cards; done tasks raise follow-ups; skipped questions wait 30 days.
- Across households (aggregated, no personal data): option choice and realised rates by category and region as ranking priors and "people like you chose" lines, only for groups of 5 or more.
- Admin report: realised vs estimated by category; AI fallback rate; question answer rate.
Tests: no group under 5 exposed; a dismissed card type drops in rank.
```
