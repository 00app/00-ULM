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

## 3. Stop the false failures (one-time settings)

**Settings** → **Build & Deployment** → **Deployment Checks**

| Check | Action |
|--------|--------|
| **Lint** | Disable, or set to optional / non-blocking |
| **Typecheck** | Disable, or set to optional / non-blocking |

Reason: **`vercel.json`** / build already runs **`npm run build`** → **`npm run verify`** (`typecheck` + `lint:ci`). Running lint/typecheck again in parallel duplicates work and often hits Vercel *internal error* on Node 24 + Next 16.

Optional smoke check instead: **`GET /api/health?live=1`** (no DB, returns 200).

## 4. Align Node 24 everywhere

| File | Value |
|------|--------|
| `package.json` `engines.node` | `24.x` |
| `.node-version` | `24` |
| `.nvmrc` | `24` |
| Vercel **Project Settings → Node.js Version** | **24.x** |

Mismatch (e.g. `.nvmrc` on 22) can break native check jobs while the main build uses 24.

## 5. CLI deploy (skips dashboard check gating)

From repo root (linked to **00-ulm**):

```bash
npm run deploy:force
```

Or:

```bash
vercel deploy --prod --yes --force
```

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
