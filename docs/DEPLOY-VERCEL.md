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
| **`package.json` `lint:ci` / `typecheck:ci`** | `node scripts/vercel-check.mjs` — **not** `lint` / `typecheck` (native Vercel checks auto-skip) |
| **`npm run fix:vercel-checks`** | Fails if `lint`/`typecheck` scripts reappear in package.json |
| **`next.config.js`** | No `eslint` key (Next 16 removed it — native Vercel Lint crashes). `typescript.ignoreBuildErrors` only. |
| **`vercel.json` `installCommand`** | `npm ci --include=dev` (checks + build see eslint/tsc) |
| **`npm run deploy`** | verify → `vercel deploy --prod` → wait Ready → **`scripts/vercel-promote-latest.sh`** |

Missing or nested check scripts caused Vercel *internal error* on native Lint/Typecheck; direct binaries fix that.

**Permanent repo fix (native checks):** Do **not** define `lint` or `typecheck` in `package.json`. Vercel Native Deployment Checks bind to those exact names and run in parallel with the build — they often fail with *failed unexpectedly* while `vercel-build-gate.mjs` already verified the same code. Use `lint:ci` / `typecheck:ci` + `npm run fix:vercel-checks`.

**Dashboard (if checks still show after deploy):**

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

## 7. Twilio SMS (Rock mobile signup)

Set on **Vercel → Project 00-ulm → Environment Variables → Production + Preview** (server-only — never `NEXT_PUBLIC_*` for secrets):

| Variable | Value | Notes |
| --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | Live `AC…` | **Live** credentials tab — not Test |
| `TWILIO_AUTH_TOKEN` | Live auth token | Rotate if pasted in chat; never commit |
| `TWILIO_PHONE_NUMBER` | `+447576569100` | Twilio **from** number only |
| `NEXT_PUBLIC_APP_URL` | `https://www.00-00.online` | Webhook base; must match console |

**Do not** add user personal mobiles to Vercel — those land in Neon (`users.mobile`) when saved via **`POST /api/profile/mobile`**.

**Do not** use Twilio **Test** credentials (`ACc6…` / test auth token) in Vercel — those are for Twilio magic test numbers, not production SMS.

**Twilio console (Messaging on `+447576569100`):**

- **A message comes in** → Webhook → `https://www.00-00.online/api/webhooks/twilio` → HTTP POST
- **Primary handler fails** → same URL (optional)

Or from repo root after env is set: `npm run twilio:configure-webhook`

**Smoke (after promote):**

```bash
npm run twilio:ping
```

- **Inbound:** text `STOP` from your phone to the Twilio FROM number
- **Outbound:** save mobile on Today's Tips rail (signed-in) or `POST /api/profile/mobile`

**Trial account note:** Your account is still on Twilio **Trial** until upgraded. Outbound SMS to signup mobiles requires a **paid/upgraded** account — Verified Caller IDs are not part of app config (remove any personal test numbers from that page if you are going live).

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

## Security go-live checklist

1. **Rotate secrets** if ever pasted in chat or committed: `TWILIO_AUTH_TOKEN`, `CRON_SECRET`, `GATEWAY_TOKEN`, `SESSION_SECRET` (Vercel → Environment Variables → Production, then redeploy).
2. **Upstash Redis** — set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` so login/signup/SMS rate limits apply globally (not per serverless instance).
3. **Neon migration** — `npm run db:apply-pending` or `psql "$DATABASE_URL" -f db/migrations/020_users_mobile_sms_opt_in.sql` before SMS signup.
4. **Twilio webhook** — `npm run twilio:configure-webhook` with `NEXT_PUBLIC_APP_URL=https://www.00-00.online`.
5. **Session restore** — production requires `restore_proof` (HMAC from `SESSION_SECRET`); issued on profile create / login / signup. Users who only have old `userId` in localStorage must complete profile again once after deploy.
