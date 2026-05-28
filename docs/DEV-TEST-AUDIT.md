# Dev, test, audit, and clean build

Quick runbook for local work on Zero Zero (00-00) after ULM / hybrid pipeline changes.

---

## Do you need new SQL?

| Change | SQL required? |
|--------|----------------|
| Hybrid pipeline (`open_data_anchor` in `users.user_genome`) | **No** — JSONB key inside existing `user_genome` column |
| `MAX_DISCOVERY_INJECTIONS_PER_JOURNEY = 3` | **No** — app-level cap only |
| 24-card ceiling, Rock 6→12 | **No** — client + `ulmLimits.ts` |
| Legacy table cleanup (`card_views`, `micro_answers`, `zai_messages`) | **Optional** — run `db/migrations/20260521_drop_legacy_unused_tables.sql` in Neon SQL Editor **only after** `npm run db:audit` shows 0 rows |

**Fresh branch / empty Neon:** run once:

```bash
npm run init-db
npm run db:evolve-12-domains
```

**Existing production:** no mandatory migration for ULM. Refresh `DATABASE_URL` in Vercel if auth fails.

---

## Do you need to update Hermes?

**No** for ULM, Zai read-only, or hybrid spawn.

Hermes only HTTP-triggers Vercel (`scripts/hermes-pulse.sh` + `CRON_SECRET`). Keep:

- VPS: `bash scripts/install-hermes-crontab.sh --install` (weekly **repair-only** or `--weekly`)
- Mac smoke: `npm run hermes:ping` · `npm run hermes:repair-pulse`

See [HERMES-ULM-JIT-BRIEF.md](HERMES-ULM-JIT-BRIEF.md) and [HERMES-VPS-SETUP.md](HERMES-VPS-SETUP.md).

User-facing research is **in-app** (answer loop / Deep Dive), not Hermes cron.

---

## Prerequisites

1. `cp .env.example .env.local` and fill at minimum:
   - `DATABASE_URL` (Neon **pooler** URI — refresh from console if `28P01` auth fails)
   - `GEMINI_API_KEY`
   - `FIRE_CRAWL_KEY_2` (optional locally; needed for full scrape paths)
   - `CRON_SECRET` (matches VPS `~/.hermes/cron.secret` if testing cron)
2. `npm install`
3. For hybrid Solo Focus spawn locally:

```env
MODEL_STRATEGY=bucket_failover
# or
HYBRID_DATA_PIPELINE=1
```

---

## Clean build (zero TS/lint errors)

```bash
# 0) Optional — drop stale .next / Turbopack caches
npm run purge:disk

# 1) Static gate (must pass; fix any eslint *errors* before ship)
npm run verify

# 2) Production build (verify is included in `npm run build`)
npm run build

# Or wipe .next first:
npm run build:clean
```

**Launch smoke after build:** see **Launch verification** in [HANDBOOK.md](HANDBOOK.md) (Summary atomic ticker → Zone ripple → one loop → pink; Rock = no loop).

**Full prep (Neon + journey_questions + clean build):**

```bash
npm run prep:live
```

Expected: `verify` exit 0, Next build “Compiled successfully”, no TypeScript errors.

---

## Dev server

```bash
# First time or after weird HMR:
npm run dev:clean

# Normal:
npm run dev
# → http://127.0.0.1:3000
```

After deploy or data-version bumps (`DATA_VERSION` default `2026-05-24-profile-baseline`), returning users auto-reset via `SessionStateRehydrate` then rehydrate from `/api/session-state`. Manual: DevTools → Application → clear site data, or complete profile again.

### Final test reset (local)

```bash
npm run purge:disk
npm run verify
npm run build:clean
npm run dev:clean
```

**Browser (127.0.0.1:3000):** Settings → **RESET DATA**, or DevTools → Application → **Clear site data**.

**Partial journey/loop cache only** (keep profile): paste the snippet from `npm run clear:learning`.

| Settings edit | Behaviour |
|---------------|-----------|
| Profile row (pencil) | `/profile?q={id}&returnTo=/settings` — one question, then back to Settings |
| Loop row (pencil) | In-place loop beat overlay — answer updates `zz_loop_answers_log` + `journey_*_answers`, returns to Settings |
| Journey card (pencil) | `SoloFocusOverlay` question mode — journey MC answers, then back to Settings |

### Neon `Connection terminated due to connection timeout` (prep / migrations)

| Cause | Fix |
|-------|-----|
| Compute suspended (cold start) | Run `npm run db:test` first (HTTP wake), then `npm run db:apply-pending` or `npm run prep:live`. Scripts retry automatically via `scripts/neon-wake.ts`. |
| Forced TCP `pg` | Do **not** set `DATABASE_USE_NEON_SERVERLESS=0` for local CLI unless you need raw `pg`. |
| SSL mode warning in terminal | Informational for `pg` v9; optional: add `sslmode=verify-full` to `DATABASE_URL` in Neon console. |

### Vercel CLI `ETIMEDOUT` after “Deployment completed”

Harmless — build and deploy finished; CLI lost the polling connection. Confirm in [Vercel dashboard](https://vercel.com) or `curl https://00-ulm.vercel.app/api/health?live=1`.

### `Cannot find the middleware module` (Next 16 + Webpack)

| Cause | Fix |
|-------|-----|
| Stale `.next` after purge / crash | `npm run dev:clean` (purge + manifests + dev). Do not run bare `next dev` — use `npm run dev` or `dev:clean`. |
| Port 3000 still held by an old `node` process | `lsof -ti :3000 \| xargs kill` then `npm run dev:clean`. |
| Proxy not compiled yet (first request) | Wait for terminal `Compiled` / `proxy.ts` timing line, hard-refresh. |
| `next start` without a build | Run `npm run build:clean` first; `start` no longer stubs middleware manifests. |

Boundary file: root **`proxy.ts`** (`export function proxy`). Next 16 renamed `middleware.ts` → `proxy.ts`; the dev bundle still emits `.next/dev/server/middleware.js`.

### Hydration + console noise (dev)

| Symptom | Fix / expectation |
|---------|-------------------|
| React **hydration mismatch** on `/` | `useHydrationSafeReducedMotion` on intro/logo/word cycle; **`suppressHydrationWarning`** on `<html>` / `<body>` (Grammarly injects `data-gr-ext-installed`). |
| **`name` vs `postcode` on `/profile`** | `ProfilePageClient` waits for `profileHydrated` after `useLayoutEffect` reads `localStorage` / `sessionStorage` — no SSR step label drift. |
| **AUDIT over bento on Zone handoff** | Summary → Zone uses **`.zone-handoff-overlay`** (fixed, 40px inset); wall hidden until `architecturalPulsePhase === 'done'`. |
| **Marvin / Roboto look like system fonts** | Marvin is local: `public/assets/Marvin Visions Bold.ttf` (`@font-face` in `globals.css`, **`font-weight: 700 900`** — must match `.intro-text-large` at 900). If missing from disk, run `git checkout -- "public/assets/Marvin Visions Bold.ttf"`. Roboto is `next/font/google` on `<html className={roboto.variable}>` + `<body className={roboto.className}>`. Summary waits on `preloadAppFonts()` (2s cap) before the ticker. Hard-refresh after restore. |
| **Unused font preload** warning | Single Marvin preload in `app/layout.tsx` (`/assets/Marvin%20Visions%20Bold.ttf`); `@font-face` in `globals.css`. |
| `runtime.lastError` / extension port | Browser extension — ignore unless reproducing in incognito without extensions. |
| **`[403] Lightning dunning … gemini`** | Google Cloud billing / quota on the Gemini project — not an app bug. Bucket failover uses Groq/Mistral; expect **`[429]`** if profile triggers many `scrape-sync` calls in one session. |

**Profile autofill smoke:** set `profile_postcode` in Application → Local Storage, reload `/profile?q=postcode` — field prefilled. Name step: browser `given-name` autofill should persist **first token only** (`lib/profile/firstNameFromInput.ts`).

---

## Database audit

```bash
npm run db:test              # ping + table list
npm run db:verify-discovery  # Zai + inject tables
npm run db:audit             # row counts + legacy cleanup hints
npm run db:log-research      # latest research_results row
```

If `db:test` passes but pool scripts fail: save `.env.local`, remove stale `export DATABASE_URL=...` from your shell, or set `DATABASE_USE_NEON_SERVERLESS=0` for CLI scripts.

---

## App + API smoke

```bash
npm run verify
npm run stack:verify          # env + db:test + hermes:ping
npm run dev:pipeline-ready    # optional: -- --seed YOURPOSTCODE

npm run verify:env
# BASE_URL=https://00-ulm.vercel.app npm run verify:env

npm run hermes:ping
npm run deploy                # verify + remote build + auto-promote
# npm run promote             # if Vercel shows Staged but build green
```

**Manual checklist**

| Step | URL / action |
|------|----------------|
| Profile 8 steps | `/profile` — name `given-name` (first name only), postcode from `profile_postcode` + `/api/local-intelligence` |
| Zone grid | `/zone` — 13 journeys (`JOURNEY_ORDER`), visited pink/yellow; localhost one-shot bootstrap (`devResearchBootstrap.ts`). After pulse, cards should stagger in without flash/stall (no post-bootstrap `refreshKey` polls). |
| Solo Focus answer | one question → one discovery card; hybrid if bucket_failover |
| Zai | `/zai` — stream, no scrape; pills under last Zai bubble |
| Deep Dive | unvisited card → **Search deeper** only (scrape) |

**E2E (optional):**

```bash
npm run test:e2e
```

---

## zsh pitfalls (from real terminal sessions)

**Do not put `# comments` on the same line as npm scripts** — npm forwards `#` to the shell:

```bash
# BAD — fails with "Unknown arg: #"
npm run hermes:repair-pulse   # optional smoke

# GOOD — one command per line
npm run hermes:repair-pulse
```

**Do not paste multi-line blocks with `#` comment lines into zsh** — you get `command not found: #`.

**`rm` with a comment on the same line** breaks words into separate args:

```bash
# BAD
rm .env.vercel.production   # don't commit

# GOOD
rm .env.vercel.production
```

**Copy-paste one command at a time:**

```bash
npm install
npm run verify
npm run build
```

---

## Vercel `MODEL_STRATEGY`

Production diagnostics already report `bucket_failover.enabled: true` when you curl with `CRON_SECRET` — good.

If `vercel env pull` shows `MODEL_STRATEGY=""`, set it explicitly in Vercel → Project → Environment Variables → Production:

```text
MODEL_STRATEGY=bucket_failover
```

Redeploy, then re-check:

```bash
export CRON_SECRET="$(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '\"')"
curl -sS -H "Authorization: Bearer ${CRON_SECRET}" \
  'https://00-ulm.vercel.app/api/health/diagnostics' | jq '.bucket_failover.enabled'
```

Local hybrid spawn also needs the same in `.env.local` (or `HYBRID_DATA_PIPELINE=1`).

---

## Stop burning Gemini credits (free-tier / failover)

When AI Studio shows spend near the cap (£30 default), add to **`.env.local`** and restart dev:

```bash
MODEL_STRATEGY=bucket_failover
GEMINI_FREE_TIER=1
BUCKET_SKIP_GEMINI=1
GROQ_API_KEY=<your groq key>
GROQ_MODEL=llama-3.1-8b-instant
```

Optional: `MISTRAL_API_KEY`, `OPENROUTER_API_KEY` with `OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free`.

- **Zai + Deep Dive** use the bucket chain (Groq first), not direct Gemini.
- **Discovery answers** use bucket when `MODEL_STRATEGY=bucket_failover`.
- Lower or pause spend in [AI Studio → Spend](https://aistudio.google.com/spend) if you keep `GEMINI_API_KEY` set.
- **Firecrawl** is separate — 402 means no scrape credits; hybrid free APIs (EPC/NESO) still work.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `password authentication failed` | Neon console → reset password → paste new pooler URL into `.env.local` + Vercel |
| `verify` ESLint warning only | Pre-existing `SoloFocusOverlay` hooks — not a build blocker |

### Local dev — stop credit burn

| Symptom | Fix |
|--------|-----|
| `[scraper] Ofgem Firecrawl scrape failed: 402` | Add `SKIP_FIRECRAWL=1` to `.env.local` (no Firecrawl calls) |
| Many `POST /api/zone/content-architect` ~20s | One batch per profile fingerprint; clear `sessionStorage` keys `zz_architect_*` to force refresh |
| `npm run hermes:repair-pulse # comment` → `Unknown arg: #` | Run **one command per line** — npm passes `#` to bash |
| Vercel Lint/Typecheck *internal error* | Build often OK — `npm run promote` or [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) |
| Staged deployment | `npm run promote` (alias latest Ready prod → `00-ulm.vercel.app`) |
| Zone stale cards | Clear localStorage; check `NEXT_PUBLIC_DATA_VERSION` in `.env.local` |
| Hermes 401 | `CRON_SECRET` in `.env.local` must match VPS secret file |
| `Unknown arg: #` after npm | Remove inline `# comments` on npm lines |
| `zsh: parse error near )` | Run commands separately; don't paste commented blocks |

---

## Related docs

- [USER-FLOW-AND-DATA-PIPELINE.md](USER-FLOW-AND-DATA-PIPELINE.md) — flow, category contract, deploy checklist
- [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) — Staged / promote / native checks
- [ULM-APPLICATION-LOOP.md](ULM-APPLICATION-LOOP.md) — product ceilings
- [HYBRID-DATA-PIPELINE.md](HYBRID-DATA-PIPELINE.md) — free vs premium tiers
- [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) — scrape, card copy, Solo Focus, tone
- [SENTINEL.md](SENTINEL.md) — Sentinel hook + API + home deck
- [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md) — Gary mode, pattern shift, rebirth vault
- [ZAI-AND-QUESTIONS-RULES.md](ZAI-AND-QUESTIONS-RULES.md) — Zai + questions
- [HANDBOOK.md](HANDBOOK.md) — full project reference
