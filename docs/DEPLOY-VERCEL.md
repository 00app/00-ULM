# Vercel deploy — “Checks Failed” but deployment Staged

When the dashboard shows **Checks Failed**, **Environment: Production**, **Staged**, and Lint/Typecheck say *“An internal error occurred”* — the **Next.js build often already succeeded**. Your commit is deployed to a preview URL; production alias was not promoted because optional checks failed.

## 1. Confirm the real build passed

On the deployment page, open **Build Logs** (not Deployment Checks).

Look for:

```text
> npm run build
> npm run verify
...
Build complete. Output in .next
```

If that finished without `Error: Command "npm run build" exited with 1`, **your code is fine**.

## 2. Promote to production (fastest)

1. Vercel → project **00-ulm** → **Deployments**
2. Open deployment **`4924d2f`** (or latest **Staged**)
3. **⋯** menu → **Promote to Production** (or **Assign to Production Domain**)

Production alias **`https://00-ulm.vercel.app`** should then serve this build.

## 3. Stop the false failures (repo + dashboard)

**Repo (automatic):** `package.json` defines **`lint`** → `lint:ci` and **`typecheck`** → `tsc:check` so Vercel native Deployment Checks run real commands (missing scripts caused *internal error*). **`vercel.json` `buildCommand`** still runs **`npm run verify`** before the Next build; **`next.config.js`** sets `eslint.ignoreDuringBuilds` + `typescript.ignoreBuildErrors` so `next build` does not duplicate those steps.

**Dashboard (if checks still appear):** **Settings** → **Build & Deployment** → **Deployment Checks** → remove native **Lint** + **Typecheck**, or switch required checks to GitHub Actions jobs **Lint** / **Typecheck** from `.github/workflows/ci.yml`.

Optional smoke check: **`GET /api/health?live=1`** (no DB, returns 200).

## 4. Align Node 24 everywhere

| File | Value |
|------|--------|
| `package.json` `engines.node` | `24.x` |
| `.node-version` | `24` |
| `.nvmrc` | `24` |
| Vercel **Project Settings → Node.js Version** | **24.x** |

Mismatch (e.g. `.nvmrc` on 22) can break native check jobs while the main build uses 24.

## 5. CLI deploy (recommended — remote build + auto-promote)

From repo root (linked to **00-ulm**):

```bash
npm run deploy
```

This runs **`npm run verify`**, then **`vercel deploy --prod`** (build on Vercel — **not** `--prebuilt`), then **`vercel promote`** so production is not left **Staged** when dashboard checks fail.

Do **not** use `vercel deploy --prebuilt` unless you ran **`vercel build --prod`** in the same session seconds earlier.

## 6. After production is live

```bash
npm run hermes:ping
npm run hermes:repair-pulse
```

`hermes:repair-pulse` needs **`/api/cron/repair-mechanical`** on the promoted deployment (included in builds after the Ulm/Hermes commit).

## Local proof (before you trust Vercel checks)

```bash
npm run verify
npm run build
```

Both must pass locally; if they do and Vercel only shows *internal error* on Lint/Typecheck, promote anyway.

## GitHub Actions (`ci.yml`) vs partial pushes

`main` **zone/page.tsx** imports modules that must land in the **same push** or CI typecheck fails:

- `lib/zone/categoryIntent.ts`
- `lib/zone/tipVerification.ts`
- `lib/zone/tipVerificationDeepScrape.ts`
- `lib/architecturalPulse.ts` (`ZoneWelcomeCopy.savingsMoneyLine` / `savingsCarbonLine`)
- `lib/zone/buildZoneViewModel.ts` (`categoryIntentWeights` param)
- `app/components/SoloFocusOverlay.tsx` (`tipVerificationMode`, `onTipVerificationComplete`)

If `researchAgent.ts` is on `main`, also push in the **same commit**:

- `lib/intelligence/topicShield.ts`
- `lib/intelligence/aiGateway.ts` (`GEMINI_PRECISION_TEMPERATURE` re-export)
- `lib/intelligence/researchProfilePayload.ts` (`surgical` on seed URLs)
- `lib/soloFocusCopy.ts` (`headlineFromArchitectProse`)
- `lib/zone/questionHandler.ts` (`getSoloFocusNextQuestion`)
- `lib/zone/tier2RecursiveSpawner.ts` (`repair` on `fetchTier2ScrapeSync`)
- `lib/journeys.ts` (`getSoloFocusQuestions`)

Commit **verify + build green locally**, then push the full set — not `zone/page.tsx` alone.
