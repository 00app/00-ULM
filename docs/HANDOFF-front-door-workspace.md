# Handoff: Zero Zero front door + Zero Zero Workspace (PRD v3)

Date: 25 Oct 2026. Source: Claude chat session with Gary.
Read HANDBOOK.md first. Work one prompt at a time, in order. Verify each on a preview deployment before the next. Never touch `/api` routes, webhooks or crons unless a prompt says so.

## Decisions (agreed)

- The app is renamed **Zero Zero Workspace**. The public homepage is the **front door**.
- Domain: 00-00.online (assumed; confirm before launch).
- Target structure: front door at `/`, app under `/00-workspace` (path name still open: `/00-workspace` or `/workspace`).
- `/api` stays at `/api`. Every old app URL gets a 308 redirect to its new path.
- Mechanical truth: no figure without a source and as-of date. Front door figures move to one `facts.json`.
- The Workspace home adopts the Home 360 workbench model (later phase, see bottom).
- Docs: PRD v3 https://claude.ai/artifact/WsaUdxdiJL6i7uLWQFQQxk · Zero Zero 360 plan https://claude.ai/artifact/CvWnZThHKmZm3LwLSF4dTL

## Already done in this repo (uncommitted)

| File | Change |
| --- | --- |
| `app/front-door/page.tsx` | New route `/front-door`, metadata, imports page CSS |
| `app/front-door/FrontDoor.tsx` | Client page, Framer Motion (already a dependency) |
| `app/front-door/content.ts` | All copy and sourced figures |
| `app/front-door/front-door.css` | Styles scoped under `.zzfd`; overrides global h1–h3 lock, body padding, shell perspective for this page only |
| `lib/routes.ts` | Added `FRONT_DOOR: '/front-door'` |
| `app/global-layout.tsx` | App footer hidden on `FRONT_DOOR`; registry entry added |

Front door sections: header (animated logo from `app/icon.svg`), hero with postcode form, scroll-ink problem statement, four count-up facts, three quick wins, find/explain/act with scroll progress rail, four rules, FAQ accordion, blue closing CTA, footer. Respects `prefers-reduced-motion`. Postcode form uses `checkUkPostcode` and `PROFILE_STORAGE_KEYS.postcode`, then pushes to `/start/result?postcode=`.

It was type-checked and built outside this repo only. It has not been run inside the full app shell.

## Prompt 0: Verify the front door in the real app

```
Read docs/HANDOFF-front-door-workspace.md. Then:
1. Run the type check and lint (npm run typecheck:ci, npm run lint:ci). Fix only errors in app/front-door, lib/routes.ts or app/global-layout.tsx.
2. Start dev and open /front-door at 1440px and 390px. Check: no horizontal scroll; sticky header works; all headings visible after scrolling; FAQ opens; postcode form rejects "abc" and accepts "BN17 7AA", landing on /start/result.
3. Check global side effects: SentenceCase, CtaClickBurst, InteractiveBackground and template.tsx do not break the page. Check the proxy does not redirect /front-door.
4. Confirm no other route changed visually.
Report findings as a table: issue | file | fix applied. Do not commit.
```

## Prompt 1: Audit (read only)

```
Read HANDBOOK.md. Read only, change nothing.
Report:
1. Every user-facing route and its file.
2. Every hardcoded internal path or absolute 00-00.online URL in code, SMS templates, emails, metadata and env files.
3. Every external system that points at an app route (Twilio webhooks, Awin promotional URL, Vercel crons, Hermes jobs).
4. Where postcode onboarding starts and how the postcode is passed.
5. How proxy.ts and lib/returningUserGate.ts redirect "/" today.
Output a table: item | file | line | proposed new value. Stop.
```

## Prompt 2: Move the app to /00-workspace

```
Using the audit table, move every user-facing app route under /00-workspace (route folder; do not use basePath; /api stays at /api).
- Update ROUTES in lib/routes.ts and every internal link, router.push and redirect.
- Add 308 redirects in next.config.js for every old route to its /00-workspace equivalent, keeping query strings.
- Update proxy.ts matcher and the returning-user redirect so it targets the new paths.
- Update the fixed-viewport and footer path lists in app/global-layout.tsx and app/template.tsx.
- Leave / and /front-door unchanged for now.
Test: every old route returns 308 to the right new route; onboarding to Zone works end to end on preview. Update HANDBOOK.md.
```

## Prompt 3: facts.json and the CI check

```
Create data/facts.json. Each fact: id, label, value, unit, sourceName, sourceUrl, asOf (ISO date), refreshBy (ISO date).
Seed exactly:
- price_cap_typical: 1723, GBP/year, Ofgem, https://ofgem.gov.uk/press-release/energy-price-cap-will-rise-4-october-2026, asOf 2026-08-26, refreshBy 2026-11-26
- price_cap_change: 60, GBP/year (+4%), same source and dates
- electricity_vat: 0, percent, 2026-10-01 to 2027-03-31, Ofgem, https://ofgem.gov.uk/news/changes-energy-price-cap-between-1-october-and-31-december-2026, refreshBy 2027-03-31
- ooc_bundle_premium: 108, GBP/year (78 vs 69 GBP/month), Ofcom via TelecomLead, https://telecomlead.com/broadband/ofcom-3-43-million-uk-users-switch-broadband-and-landline-as-out-of-contract-customers-face-108-annual-premium-127844, refreshBy 2027-06-30
- unused_streaming_share: 34, percent, Uswitch survey of 1,000 adults, https://www.advanced-television.com/2026/07/27/survey-56-say-rising-streaming-costs-hard-to-justify/, refreshBy 2027-07-31
- bus_grant: 7500 (9000 oil/LPG to 2027-03-31), GBP, Energy Saving Trust, https://www.energysavingtrust.org.uk/grants-and-schemes/boiler-upgrade-scheme/, refreshBy 2027-03-31
- tip_shower_4min: 45, GBP/year, Energy Saving Trust, https://energysavingtrust.org.uk/energysaversweek, refreshBy 2027-01-31
Add a typed loader that drops any fact past refreshBy at render time.
Point app/front-door/content.ts FACTS and WINS figures at this file.
Add a CI test that fails if any fact lacks sourceUrl or asOf. Replace duplicate price cap constants in the app with this file.
```

## Prompt 4: Front door goes live at /

```
Make the front door the homepage:
- Move app/front-door to app/page.tsx (keep the client component and CSS); keep /front-door as a 308 redirect to /.
- The current intro at / moves under /00-workspace (it is the workspace entry).
- Remove / from the fixed-viewport lists in app/global-layout.tsx and app/template.tsx.
- Front door links: header and closing CTA go to the workspace entry; postcode form goes to the workspace result route.
- Returning users with a session still go straight to the workspace (proxy.ts).
Test: Lighthouse mobile 95+ on /, axe zero violations, page under 1 MB, returning-user redirect works.
```

## Prompt 5: Rename to Zero Zero Workspace

```
Replace user-facing product names ("Zero Zero app", "Zone" as a product name) with "Zero Zero Workspace" in titles, metadata, onboarding copy, emails and SMS templates. Keep internal code names. List every change.
```

## Prompt 6: Price cap refresh job (before 25 Nov 2026)

```
Add a Hermes job that checks Ofgem's price cap page daily. When a new level is published, update price_cap_typical, price_cap_change, asOf and refreshBy in data/facts.json via a PR, never a direct push. Log the source URL used.
```

## Prompt 7: SEO and launch

```
Add title, description, Open Graph image, canonical, sitemap.xml and robots.txt for / and the workspace entry. Front door indexable; signed-in workspace screens noindex. Run npm run verify, then npm run promote.
```

## Later phase: Home 360 workbench in the Workspace

Workspace home layers, top to bottom: hero (one thing that needs you now, with source, as-of, confidence) → Action Centre (up to 10 ranked actions, approval tiers 0–3, nothing done without a tap) → Intelligence (one forecast moment) → Information (Money dashboard and carbon, Why panels) → My tools (Bill Assurance, Subscriptions, Energy and Tariff) → What's next (Coming soon tags). Build order: synthetic household dataset and one data service, then the Home 360 Intelligence agent, then Action Centre. Full detail in the Zero Zero 360 plan doc.
