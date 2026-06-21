# Vercel deploy — “Checks Failed” but deployment Staged

When the dashboard shows **Checks Failed**, **Environment: Production**, **Staged**, and Lint/Typecheck say *“An internal error occurred”* — the **Next.js build often already succeeded**. Your commit is deployed to a preview URL; production alias was not promoted because optional checks failed.

## 1. Confirm the real build passed

On the deployment page, open **Build Logs** (not Deployment Checks).

Look for:

```text
> npm run verify
> node scripts/build-with-manifest-fix.js
...
Build complete. Output in .next
```

If that finished without `Error: Command "npm run verify && …" exited with 1`, **your code is fine**.

## 2. Promote to production (fastest)

1. Vercel → project **00-ulm** → **Deployments**
2. Open deployment **`4924d2f`** (or latest **Staged**)
3. **⋯** menu → **Promote to Production** (or **Assign to Production Domain**)

Production alias **`https://www.00-00.online`** should then serve this build.

## 3. Stop the false failures (repo + dashboard)

**Repo (automatic):**

| Layer | What runs |
| --- | --- |
| **`vercel.json` `buildCommand`** | `node scripts/vercel-build-gate.mjs` — serial typecheck, lint, then `build-with-manifest-fix.js` (verify runs without build `NODE_OPTIONS` to avoid OOM) |
| **`.npmrc`** | `include=dev` — native Lint/Typecheck jobs get `@types/*` + eslint |
| **`scripts/vercel-check.mjs`** | Native check entry: `next typegen` + explicit eslint/tsc binaries |
| **`package.json` `lint` / `typecheck`** | `node scripts/vercel-check.mjs …` (not deprecated `next lint`) |
| **`next.config.js`** | No `eslint` key (Next 16 removed it — native Vercel Lint crashes). `typescript.ignoreBuildErrors` only. |
| **`vercel.json` `installCommand`** | `npm ci --include=dev` (checks + build see eslint/tsc) |
| **`npm run deploy`** | verify → `vercel deploy --prod` → wait Ready → **`scripts/vercel-promote-latest.sh`** |

Missing or nested check scripts caused Vercel *internal error* on native Lint/Typecheck; direct binaries fix that.

**Dashboard (fix “internal error” on native Lint/Typecheck):**

1. **Project 00-ulm** → **Settings** → **Build and Deployment** → **Deployment Checks**
2. **Remove** or mark **not required** the built-in **Lint** and **Typecheck** checks (Next 16 + flat ESLint often yields *internal error* with no log).
3. **Add** → **GitHub Actions** → require jobs **`Lint`** and **`Typecheck`** from `.github/workflows/vercel-production-gate.yml` (exact names).

Until step 3 is done, a green **build** can still show **Checks Failed** — run `npm run promote` so `www.00-00.online` serves the Ready deployment.

**Staged but build green:** run `npm run promote` (promotes latest Ready prod deployment to `www.00-00.online`).

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

This runs **`npm run verify`**, then **`vercel deploy --prod`** (build on Vercel — **not** `--prebuilt`), then **auto-promote** via `scripts/vercel-promote-latest.sh` so **`www.00-00.online`** is not left on an old build when dashboard checks fail.

**Staged only (build already green):** `npm run promote`

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
