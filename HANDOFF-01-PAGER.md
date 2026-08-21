# Handoff: ship the Zero Zero one-pager at `/01-pager`

**For:** Claude Code, running with a real terminal in this repo.
**From:** a session with no shell access. Everything below was written blind.
**Goal:** get `https://www.00-00.online/01-pager` live, without touching anything else in the app.

---

## 1. Read this first: what has and has not happened

**Has happened.** Four files were written into `app/01-pager/`. The content is researched and
sourced. The design decisions are deliberate and documented in the file comments.

**Has not happened.** No typecheck. No lint. No test run. No build. No dev server. No commit. No
push. The sandbox that wrote these files had no Linux environment available for the entire
session, so not one line of this has ever been executed.

Treat the files as a reviewed-but-unverified draft. Your job is to validate, fix, and ship, not to
rewrite. If something does not compile, fix it in place rather than starting again, because the
figures and sources took real research to assemble and are the part that matters.

---

## 2. File inventory

| File | Status | Purpose |
| --- | --- | --- |
| `app/01-pager/page.tsx` | new | Server page. Metadata, `robots: noindex`. Renders `PagerClient`. |
| `app/01-pager/PagerClient.tsx` | new | Client component. Tap-to-reveal state, `Card` sub-component. |
| `app/01-pager/pagerData.ts` | new | The nine cards as data, plus contact and the three doors. |
| `app/01-pager/pager.module.css` | new | All styling. CSS module. |
| `app/01-pager/pager.css` | **DELETE THIS** | Superseded by the module. Orphaned, nothing imports it. |

`rm app/01-pager/pager.css` is step one. The sandbox could not delete files.

**No file outside `app/01-pager/` should be modified.** Two shared files were briefly edited
during drafting (`lib/routes.ts` and `app/global-layout.tsx`) and both edits were reverted. Run
`git status` before you start and confirm those two files are clean. If they are dirty, revert
them.

---

## 3. Hard constraints

1. **Sealed.** The page must be four files in one folder. No shared component imported, no shared
   file edited, no route registry touched, no global stylesheet touched. Deleting
   `app/01-pager/` must remove the page and have zero other effect. This is an explicit product
   decision by Gary, not a preference. If a fix seems to require editing a shared file, stop and
   say so rather than doing it.
2. **No em dashes and no en dashes.** Anywhere. Comments included. Use commas, full stops or
   colons. This is a house rule across the whole codebase.
3. **British English.** "Organised", "recognise", "£".
4. **Every claim on the page carries a source.** The `source` field on `PagerCard` is not
   optional and must never be empty. If you cannot back a claim, delete the claim. This mirrors
   the rule the product itself runs on and it is the entire reason the page has a reveal
   interaction.
5. **Do not invent or "improve" a number.** The figures are verified as of 31 July 2026 and are
   cited. Leave them alone.

---

## 4. Steps

```bash
git status                       # confirm lib/routes.ts and app/global-layout.tsx are clean
rm app/01-pager/pager.css
npm run verify                   # typecheck, lint, tests. Expect failures. Fix them.
npm run build                    # must pass before you push
npm run dev                      # then open http://localhost:3000/01-pager and look at it
```

Then commit and push to `main`. Vercel project `00-ulm` deploys from `main` and the page appears
at `https://www.00-00.online/01-pager`.

Suggested commit message:

```
Add the Zero Zero one-pager at /01-pager

Nine bento cards. Front is the claim, back is the proof plus its citation, so
the page argues by behaving like the product: nothing asserted without a source.

Self-contained by design. Four files in app/01-pager, a CSS module rather than a
global sheet, no shared file touched. Deleting the folder removes the feature.

noindex while the page says pre-launch.
```

---

## 5. Things most likely to break

Ranked by how much I would bet on each, given none of it has been run:

1. **CSS module class names resolving to `undefined`.** `PagerClient.tsx` builds `className`
   strings from `styles.*` and maps tone via a `TONE_CLASS` record. If a name in the TS does not
   match a selector in the module, you get silent `undefined` in the class list rather than an
   error. Check every one of: `pager, kicker, title, titleAccent, sub, grid, card, cardWide,
   cardPhrase, isOpen, toneYellow, toneDeep, toneAmbient, tonePink, eyebrow, figure, line, face,
   proof, back, source, hint, doors, doorsTitle, doorsGrid, door, doorLabel, doorBody, contact,
   contactTitle, contactRows, contactLink, contactSite, contactName`.
2. **`TONE_CLASS` typing.** It is `Record<NonNullable<PagerCard['tone']>, string>`. If the project
   has `noUncheckedIndexedAccess` on, the lookup may widen to `string | undefined` and upset the
   `.filter(Boolean)` chain. Harmless at runtime, may fail typecheck.
3. **Lint rules this repo enforces that I could not see.** Import ordering, no default exports,
   required JSDoc, curly-brace conventions. Just fix to match.
4. **Apostrophes in JSX strings.** `react/no-unescaped-entities` may object to the ones inside the
   `back` strings in `pagerData.ts`. They are in a `.ts` data file rather than JSX so this should
   be fine, but check.
5. **The `.pager` wrapper has no background.** Intentional: `InteractiveBackground` sits behind
   every route from the root layout and this page should sit on it like the rest of the app. If
   the page looks wrong, that is a visual judgement, not a bug. Show Gary before changing it.

---

## 6. Design rules you must not quietly break

**Card order is load-bearing twice over.** It tiles a six-column grid with no gaps:

```
row 1   unclaimed (4)   per-household (2)
row 2   information (2) actions (2)        assertions (2)
row 3   crisis (4)      market (2)
row 4   founder (4)     status (2)
```

Narratively it runs: problem, scale, cause, product, proof, crisis, market, founder, honest
status. Reorder one card and you punch a hole in the layout. If you must move one, move a partner
with it and keep the row totals at six.

**Phrase figures step down in size.** `isPhrase = card.figure.length > 12` switches the type size
so "IT HAD NOTHING FOR ME" does not blow the cell apart while "£24bn" still gets full display
treatment. If you add a card with a long figure, this handles it automatically.

**Below 720px every card is full width.** The bento becomes a stack, which is the right read on a
phone: one claim at a time.

---

## 7. Contact: email only, settled

The page shows `gary@lomi-lomi.co.uk` and nothing else. **Do not add a phone number.** Gary
decided this deliberately.

The only number in this repo is `+447576569100`, which is the Twilio sending line for app SMS and
cannot be rung. If you find it and think the contact block looks thin, resist: a pitch page with a
dead number on it is worse than a pitch page with none.

There are no open items. Nothing here is blocked on Gary.

---

## 8. Repo context you will want

**Brand tokens** (defined in `app/globals.css` `:root`, inherited by the module):

```
--color-yellow: #FFD700
--zai-deep-blue: #141268
--color-purple: var(--zai-deep-blue)
--color-purple-ambient: #0c0a32
--color-pink: #FF00FF
--font-marvin: 'Marvin Visions Bold', sans-serif
--font-roboto: set on <html> by next/font in app/layout.tsx
```

Display type across the app uses Marvin at `line-height: 0.8` and `letter-spacing: -0.02em`,
uppercase. Body is Roboto at weight 700. The module follows both, with hex fallbacks so the page
survives being lifted out of the app.

**Layout facts.** `app/global-layout.tsx` wraps every route. `/01-pager` is not in its
`fixedViewportStage` or `showSiteFooter` exclusion lists, so the page scrolls normally and the
site `Footer` renders beneath it. Both are correct and intended.

**Ignore the database.** Production has no `DATABASE_URL` set in Vercel, which is a real and known
problem for the rest of the app. It is irrelevant here: this page is entirely static, reads no
profile, calls no API and touches no storage. Do not get pulled into fixing it as part of this
task.

---

## 9. Acceptance checks before you tell Gary it is done

- [ ] `app/01-pager/pager.css` is deleted
- [ ] `git status` shows changes only under `app/01-pager/`
- [ ] `npm run verify` passes
- [ ] `npm run build` passes
- [ ] Every one of the nine cards opens and closes on click
- [ ] Every open card shows a non-empty source line
- [ ] Keyboard: tab to a card, Enter or Space toggles it, focus ring is visible
- [ ] At 375px wide the cards stack and no figure overflows its cell
- [ ] At 1280px wide the grid shows four rows with no gaps
- [ ] No em dash or en dash anywhere in the four files
- [ ] Page source contains `noindex`
- [ ] Every other route still loads: `/`, `/intro`, `/profile`, `/zone`, `/settings`
