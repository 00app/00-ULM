# Entry flow, card anatomy, Zone rails & bank connection

**Status:** shipped 2026-10. Canonical for everything below. Several older docs still describe the behaviour this replaces; those are **flagged, not edited** — see [Conflicts with existing docs](#conflicts-with-existing-docs).

**Related:** [GUARDRAILS-AND-PIPELINE.md](GUARDRAILS-AND-PIPELINE.md) · [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) · [PROFILE-ANSWERS-ZONE-TECH.md](PROFILE-ANSWERS-ZONE-TECH.md) · [HANDBOOK.md](HANDBOOK.md)

---

## 1. Entry flow

```
Splash → Postcode → First result → Create account / Log in / Skip → Zone
```

| Step | Route | What it does |
|------|-------|--------------|
| Splash | `/` and `/intro` (same component, `IntroScreen`) | Logo, one line **"Pay less for your home."**, primary **Get started**, text link **Log in**. Returning users with a complete stored profile are sent straight to `/zone`; a partial profile with a goal goes to `/profile`. The kinetic word sequence and the three-option goal screen are gone. |
| Postcode | `/start` | One field. UK format validated with `checkUkPostcode` (`lib/geocode/ukPostcode.ts`). Stores `profile_postcode` and calls `persistUnifiedUserProfileMemory()`. |
| First result | `/start/result?postcode=` | **One** real figure from postcode-only data (below), then the ask. Invalid or missing postcode bounces back to `/start`. A postcode that does not exist shows "We can't find that postcode." |
| Create | `/profile?entry=create` | Existing create logic: mobile step → password step → goal question → remaining profile questions → summary → Zone. |
| Log in | `/profile?entry=login` | Existing mobile + password login form. On success `window.location.assign('/')`, which the proxy sends to Zone for a complete account. |
| Skip for now | `/zone` | Guest with the postcode retained (`profile_postcode`). |

`/profile` no longer shows the in-page "quick look, or make it yours?" fork. A bare `/profile` with no entry choice, no deep link (`?q=` / `?returnTo=`) and no stored answers redirects to `/start`.

**Account creation timing.** `createUser` (`POST /api/user`) still runs at the end of the profile questions, with the whole profile, because that is when a session is issued. "Save this, create your account" therefore leads through the existing create steps rather than creating a row immediately after the postcode. Creating an account straight after the first result would need `POST /api/user` to accept a postcode-only profile; that was not changed.

**No bank step in onboarding.** There never was one in `PROFILE_QUESTIONS`; the connection lives on Zone and in Settings (section 5).

### First result — `GET /api/first-result?postcode=`

`lib/entry/firstResult.ts`, public, rate-limited (20/min), `runtime = nodejs`.

1. Format check (`isValidUkPostcode`) → 400. Then existence check against `api.postcodes.io/.../validate` → **404** if the postcode is real-format but not real (so `ZZ99 9ZZ` can never receive a region's figure as "yours"). If the lookup service is unreachable the request continues (the region mapping is the same prefix lookup used app-wide).
2. **EPC band** — `fetchOpendataEpcProfile(postcode)`; shown only if a band A–G came back. Worded as "the most recent EPC on your postcode", not "your home".
3. Otherwise **regional electricity unit rate** — Octopus public API, first active `VAR-*` import product, standard unit rate for the postcode's region letter (`resolveOctopusRegionLetter`), p/kWh inc VAT.
4. Otherwise `result: null` and the screen shows the action with **no figure**.

Every figure on screen prints its source ("Source: EPC register" / "Octopus Energy public tariff API"). Nothing in this path estimates or defaults a number.

---

## 2. Card anatomy (`ZoneRecCard`)

One component, one model: `app/components/ZoneRecCard.tsx` + `lib/zone/recCard.ts`. Style is the existing blue bento shell (`bento-card-groovy rock-bento-tile`, `data-zone-surface="tip"`), laid out in a fixed slot order:

| # | Slot | Notes |
|---|------|-------|
| 1 | `label` | Category (uppercase label) |
| 2 | `headline` | Verified **"Save £N a year"** *or* the action wording. The £ figure alone takes the display face. |
| 3 | `whyYou` | One sentence tied to the user's data, e.g. "You pay £148/mo to British Gas, up 25% since May." |
| 4 | `primaryCta` | One verb-led action |
| 5 | `secondaryCta` | Optional, low emphasis |
| 6 | `badge` | Optional — only ever **"Sample data"** |

Sizes: `large` (recommendations) and `small` (Today tips).

### Rules enforced in `resolveRecCard`, not in the view

- **No `whyYou`, no card.** If `buildWhyYou` cannot produce a sentence from real data (supplier, home + heating, transport, household, place) or sample data, `resolveRecCard` returns `null` and the card never reaches the rails. A guest with **no postcode at all** therefore gets no cards; Zone shows "Tell us your postcode…" with a link to `/start` instead.
- **No source, no £.** A £ figure survives only with a non-blank `savingSource`. Without one the figure is dropped and the headline falls back to the action wording. Zero, negative, `NaN` and `Infinity` never show.
- **Sample-sourced £ carries the "Sample data" badge.**

### What counts as a *verified* £ on Zone

`lib/zone/recCardFromZone.ts`. `source_name` / `source_date` on view-model cards are stamped on every card (`VERIFIED_SOURCE_DATE = 'April 2026'`), so they prove a citation exists, **not** that the figure is verified. The only verification signal used is the Neon research row for the category: `latestSavingGbp` or `latestVerifiedGbp` **with** a `latestSourceUrl`. The source name shown is that URL's host. Library action cards, wall tips and Today habits never show a £ (indicative figures).

---

## 3. Zone rails (Model A)

`app/components/ZoneRails.tsx`, layout rules in `lib/zone/rails.ts`.

Order, top to bottom:

0. **Start here** — the profile's three top picks (Quick win / Big win / Do now) as featured cards: three columns on desktop, a scroll-snap rail on mobile. A small "Your profile" link goes to Settings. These are personal, so **filters never hide them**, and their ids are kept out of every other rail.
1. **Filter bar** (sticky, section below) — directly under the picks.
2. **Biggest savings** — cross-category, large cards, verified £/yr descending; cards without a verified £ follow, in their existing order. Capped at 12. A pinned card (the bank Connect card) leads it, outside the sort and the cap.
3. **Today** — small cards from the season-ranked Rock/library habits. Order is the caller's; `getUkSeason` re-ranking is untouched.
4. **One rail per category**, same sort rule — only for categories with **at least 2 cards**.

Rail behaviour: horizontal scroll with `scroll-snap`; next card peeks on mobile (78vw / 62vw card widths); left/right arrows on pointer devices ≥768px; **no auto-advance**; the scroller is keyboard-focusable (`tabIndex=0`, native arrow-key scroll) with an `aria-label` per rail. One gutter for the whole column (`--zone-gutter`: 0 desktop, 20px tablet, 32px mobile) so the greeting, headings, filter bar and cards share a left edge.

### Filters (`lib/zone/filters.ts`, `ZoneFilterBar`)

Three optional facets, combined with AND: **category**, **goal** (Saves money / Cuts carbon — a card can be both) and **effort** (Do now / Long term — the library action's own cost decides, `zoneFilter.ts`). They act on browsable ideas only (everything except the Start-here picks and the bank Connect prompt).

- **Faceted counts.** The number on a chip is how many cards you'd get if you picked it with the other facets already applied. A chip that would give 0 is disabled, so no chip leads to an empty page.
- **Results replace the rails** while any filter is on: one grid (1 / 2 / 3 columns), verified £ first. The heading is built from the filters by `describeFilters` ("Home", "Saves money", "Home · Saves money · Do now") with a live "N results" beside it, so heading and bar cannot disagree. Nothing matching shows "Nothing matches those filters" with Clear.
- **Mobile / tablet (<1024px):** one compact sticky row — a **Filters** button (goal + effort in a bottom sheet, badge = how many are on) beside a single scrolling row of category chips. Active goal/effort filters also appear as removable chips at the start of that row. The sheet is a dialog (focus moves in, Esc closes and returns focus to the button, body scroll locked), controls are 44px, changes apply live and the primary button shows the live total.
- **Desktop:** the same chips with the goal and effort groups inline under them; Clear appears when anything is on.
- **Sticky + the fixed buttons:** pinned at the top the bar keeps 72–76px clear of the fixed Likes / Profile buttons; at rest it uses the full width. Chips fade out at the right edge (a scroll cue) instead of being cut.
- **State** lives in `sessionStorage` (`zz_zone_filters_v1`): kept while you open a card and come back, but a new visit starts clean.
- **Why sticky needed a fix:** `body { overflow-x: hidden }` plus the Zone route's inline `overflow-y: auto` made `body` a scroll container that never scrolls, which silently disables `position: sticky` inside it. On the Zone route only, `html.zz-zone-document body` now uses `overflow-x: clip` / `overflow-y: visible`.

### Zone summary (hero)

The four former H3 display lines are body-weight sentences (H4 size, weight 400, line-height 1.45, sentence case). The **welcome line** ("Afternoon, Guest.") is set in the serif display face (Abril Fatface, 34px mobile / 44px desktop, falling back to Georgia) and the single £ figure keeps the display face too. Entrance is a line-by-line fade: opacity + `translateY(6px→0)`, 300ms ease-out, 60ms stagger, CSS animation on mount (once per load), none under `prefers-reduced-motion`. Digits elsewhere are still Abril Fatface because of the earlier site-wide numerals rule.

---

## 4. Bank data layer

`lib/bank/`. Everything is behind one interface so the provider can be chosen later.

```ts
interface BankDataProvider {
  id: 'sample' | 'live'
  connect(): Promise<BankConnection>
  getAccounts(): Promise<BankAccount[]>
  getTransactions(range): Promise<BankTransaction[]>   // integer pence, ISO dates
  disconnect(): Promise<void>
}
```

- `SampleBankProvider` — deterministic UK sample for a given `now`: energy DD, broadband, mobile, home + car insurance, subscriptions and ordinary spending over 12 months, with **one price rise** (energy £118 → £148, +25.4%).
- `LiveBankProvider` — **stub, makes no calls.** The TODO block in the file lists what a TrueLayer / Yapily / GoCardless implementation must do. `getBankProvider()` is the single switch point and defaults to sample.
- **Analysis** (`lib/bank/analysis.ts`, real logic over any provider's output): recurring-payment detection (≥3 payments, ≥80% of gaps 24–38 days, amounts within 40% of the median), supplier + category per series, current monthly level (median of last 3), price-rise detection (≥5% and ≥£1, and the new level must hold — a one-off spike is not a rise), and saving vs best offer.
- **Saving rule:** `annual spend − offer annual price` when both are real (`basis: your_spend`); otherwise a verified typical saving labelled `typical`; otherwise `null`. Never offers the supplier the user is already with. Sample-derived figures carry `source: "sample"`. `SAMPLE_OFFER_BOOK` holds **sample** offers, not real tariffs.
- **Connection status** `none | sample | live` plus `snoozedUntil` (`lib/bank/connectionState.ts`): localStorage `zz_bank_connection_v1`, mirrored for signed-in users to `users.user_genome.bank_connection` via `POST /api/profile/bank` (origin-checked, rate-limited, status only — never transactions or tokens) and restored on login by `syncLocalStorageFromServerUser`.

---

## 5. Bank connect entry points

Three touchpoints, no modals, no other prompts.

1. **"Connect your bank" card** — first item of Biggest savings, for `status === 'none'` users who have not snoozed it: *"See your real savings, not estimates."* — **Connect** / **Not now**. It is only pinned when there is at least one other card to unlock.
2. **Bills-dependent cards** (category `utilities`) show **"Connect to see your saving"** as the primary CTA while unconnected (with a "Read more" secondary that still opens the card).
3. **Settings → Bank connection** row — permanent, connect or disconnect.

**Snooze rule:** *Not now* sets `snoozedUntil = now + 7 days` and hides the card. It returns after 7 days. `sample` and `live` users never see the Connect card.

Connect runs `SampleBankProvider`, then Zone re-renders from the computed analysis: connected bills become "Switch from [supplier]" cards that replace the generic Utilities journey card (so the same bill never appears twice).

---

## 6. CTA state machine & savings tracker

```
not connected ── "Connect to see your saving"
connected     ── "Switch from [supplier], save £X/yr"   → opens the partner link
link opened   ── "I've switched" / "Not yet"
confirmed     ── "Switched"
```

- The partner link is the offer URL (https only), wrapped by `wrapWithAwinAffiliateLink` at click time when an Awin merchant id is approved for that host. Prefill parameters are supported through `PARTNER_PREFILL` in `lib/bank/cards.ts`, but **it is empty**: add a host only once the partner documents the parameter. Octopus currently has no Awin merchant id in `awinAffiliateLink.ts`.
- State per opportunity is stored locally (`zz_switch_records_v1`): `clicked` → `switched`. Re-clicking never un-switches; you can only confirm a switch you started; *Not yet* removes a started switch but cannot undo a confirmed one.
- **Savings tracker** (Settings, hero card pattern): a running "£X saved so far". **Only confirmed switches count.** Sample-sourced savings are shown on a separate line with the "Sample data" badge and are **never added** to the real total.
- Events: `affiliate_click` (link opened) and `switch_confirmed` (user confirmed) were added to `FUNNEL_EVENT_NAMES`; `cta_click` is used for Connect / Not now / Disconnect.

---

## 7. Tests & files

| Check | Command | Covers |
|-------|---------|--------|
| Card rules | `npm run test:rec-cards` | no-why-no-card, no-source-no-£, sample badge, `buildWhyYou`, sort, Connect card, bills CTA |
| Rails | `npm run test:zone-rails` | order, ≥2 rule, cap, pinned card, hero rail |
| Filters | `npm run test:zone-filters` | parsing, matching, faceted counts, toggles, synced heading, results layout, hero kept |
| Bank | `npm run test:bank` | provider, recurring + price-rise detection, saving rule, connection/snooze, switch state machine, tracker totals |
| Entry flow | `e2e/entry-flow.spec.ts` | splash, postcode validation, result (sourced figure or none), back nav, deep links |
| Zone | `e2e/zone-funky-stress.spec.ts` | rails visible, open / close Solo Focus from a rail card |
| Filters | `e2e/zone-filters.spec.ts` | bar under the picks, synced heading, sticky, mobile sheet (Esc, badge, removable chip), tap targets, no overflow |

All `test:*` scripts above are in `npm run verify`.

Main files: `app/components/{IntroScreen,EntryShell,ZoneRecCard,ZoneRails,SettingsBankSection}.tsx` · `app/start/**` · `app/api/{first-result,profile/bank}/route.ts` · `lib/entry/firstResult.ts` · `lib/zone/{recCard,recCardFromZone,rails}.ts` · `lib/bank/**` · `lib/hooks/{useBankConnection,useSwitchRecords}.ts`.

---

## Conflicts with existing docs

**Not resolved.** Each item is flagged here and with a banner at the top of the affected file; the original text in those files is unchanged. Decide per item whether to rewrite, delete or keep as history.

| # | Where | It says | Now |
|---|-------|---------|-----|
| 1 | `FULL-APP-SPEC.md:136` (Intro row) | Logo glitch → kinetic words → **CREATE A / PROFILE TO / START.** lockup → CREATE → profile; geolocation may seed `profile_postcode`; `?skip=1` skips logo | Splash → Postcode → First result (section 1). No kinetic words, no lockup, no geolocation on the intro. *(This row already disagreed with the code before this change.)* |
| 2 | `FULL-APP-SPEC.md:137`, `PROFILE-FIELDS-GRID-UNLOCKS.md:22,39` | Goal is chosen on the intro (`profile_goal`) | Goal is asked inside `/profile` after account creation (the intro goal screen was already unreachable; it is now deleted). |
| 3 | `APP-OVERVIEW-AND-TESTING.md:31`, `USER-FLOW-AND-DATA-PIPELINE.md:17`, `DEV-TEST-AUDIT.md:42`, `GUARDRAILS-AND-PIPELINE.md:77` (mermaid `INTRO[Intro goal]`) | Intro = goal choice + optional geolocation postcode, then profile | As item 1. |
| 4 | `PROFILE-ANSWERS-ZONE-TECH.md:129,148` | Postcode step hydrates from "intro geolocation"; intro lockup is **CREATE only (no SKIP)** | The intro no longer geolocates. "Skip for now" exists on the first-result screen and leads to Zone as a guest. |
| 5 | `FULL-APP-SPEC.md:711`, `MOTION-FAMILY.md:36` | `/` + `/intro` = Style A glitch + decision lockup / atomic `IntroWordCycle` | Splash uses `AtomicLogo` only; `IntroWordCycle` is now used by the summary and architectural pulse only. |
| 6 | `COUNTY-PIVOT-PROMPT.md:15,41,48` | Proposed first screen: "Set up a profile" / "Continue as guest"; guest Zone is UK-wide generic content | Superseded by the entry flow. Also: a guest with no postcode now gets **no cards** (no `whyYou`), not generic UK-wide ones. Treat that prompt as a historical proposal. |
| 7 | `APP-OVERVIEW-AND-TESTING.md:34,323`, `ZONE-CONTENT-AND-DATA.md:179-206`, `ULM-APPLICATION-LOOP.md:48`, HANDBOOK master checklist "Zone wall order" (row updated, see below) | Fixed DOM order: welcome → profile hero → **Today's Tips heading + Rock grid** → **recommendations heading + category bento** → signup; testids `zone-section-today-tips`, `zone-section-recommendations`; `RockSavingTips` is the Today UI | Welcome → profile hero → rails (Biggest savings, Today, categories) → signup. `zone-section-today-tips` no longer renders; the recommendations heading and bento live inside the hidden legacy wall. New testids: `zone-rails`, `zone-rail-<id>`, `zone-rails-empty`. `RockSavingTips` is no longer rendered on Zone (`RockMobileSignupCard` still is). |
| 8 | `ZONE-CONTENT-AND-DATA.md:222-268`, `GUARDRAILS-AND-PIPELINE.md:130` | Tips/journeys are shown as bento tiles with SAVE / CARBON stamps; headline word-count tiers (8–10 / 9–12 words) apply to the tiles | Rail cards show the action wording or a verified £ headline, plus `whyYou`. The word-count clamps still govern the Solo Focus / legacy tiles but no longer the visible Zone cards. |
| 9 | HANDBOOK **Director's Order (Zone — frozen product sequence)** and `MOTION-FAMILY.md:45-50` ("Today's tips (Rock) last — **no loop** on close"; "Bento grid ripples…") | A frozen sequence ending with Today's tips; grid ripple stagger | Today is now the **second** rail, before the category rails, and the grid ripple no longer applies to the visible Zone. Loop-on-close and "no loop for Today tips" are unchanged in code. `lib/zone/directorsOrder.ts` was **not** edited — this needs an explicit decision before that contract or its doc section is reworded. |
| 10 | Verified-citation contract: `e2e/zone-funky-stress.spec.ts` ("Source: … April 2026"), `buildZoneViewModel` stamping `source_date: VERIFIED_SOURCE_DATE` on every card | A `Source: <name> April 2026` line is treated as proof the card is verified | It only proves a citation exists. A **£ is verified only** with a Neon research row + source URL (section 2). The two notions now coexist; they should be reconciled deliberately. |
| 11 | `e2e/zone-funky-stress.spec.ts` | Assertions such as "Check out your stats" and `Source: … April 2026` | These strings are not in the app any more (stale **before** this change). Left untouched; they will fail if run. |
| 12 | Code comment, `app/globals.css` colour primitives ("the only three colours in the product") | Three colours | A deliberate 4th ink, `--ink-body-copy: #04031C`, is used for body copy and Focus-card text (instruction 2026-09-30). The role-token system and surfaces are unchanged. |
| 13 | `ZONE-CONTENT-AND-DATA.md` (Zone hero) / any doc describing the hero as H3 display lines | Hero lines are H3 display | Hero lines are body-weight sentences with a display-face £ figure (section 3). |
| 14 | This doc's own earlier wording and the original brief for Zone rails | Category **pills are jump links, not filters** | Superseded by real filters (section 3 → Filters). The jump pills are gone; `buildZoneRails` still returns a `pills` array that nothing renders. |
| 15 | `ZONE-CONTENT-AND-DATA.md` / handbook wording for the Zone hero | The top block is "Your profile" with a "You could save" metrics row | It is "Start here" (three picks); "Your profile" is now a small link to Settings; the metrics row was dropped (the summary above shows the same £ and CO₂). |
| 16 | Typography notes for the Zone summary | Only the £ figure uses the display face | The welcome line is also serif display (explicit instruction). |
