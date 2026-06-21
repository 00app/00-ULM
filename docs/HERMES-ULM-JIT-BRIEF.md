# Hermes operator brief — Ulm JIT build (May 2026)

**Audience:** whoever runs the Oracle VPS cron (`ubuntu@140.238.100.237`) and anyone testing from a Mac.  
**App:** `https://www.00-00.online` — Zero Zero intelligence loop.

This is **not** the Python `hermes` chat CLI schedule. VPS cron uses **`bash scripts/hermes-pulse.sh`** (see [HERMES-VPS-SETUP.md](HERMES-VPS-SETUP.md)).

**Product docs:** [ZONE-CONTENT-AND-DATA.md](ZONE-CONTENT-AND-DATA.md) (main scrape/copy) · [SENTINEL.md](SENTINEL.md) (parallel live layer — not Hermes) · [SUPPLEMENTAL-SYSTEMS.md](SUPPLEMENTAL-SYSTEMS.md) (inject paths, Gary mode).

---

## What changed (tell Hermes / the VPS)

| Before | Now (Ulm / “use less, more”) |
|--------|------------------------------|
| Daily broad scrape for many users | **Weekly** pulse — Monday **05:00 UTC** (`0 5 * * 1`) |
| Gemini Pro / 2.5 multi-model | **`gemini-2.5-flash`** everywhere (surgical; not 1.5/2.0/lite on new keys) |
| Pre-scrape whole Zone | **JIT:** Firecrawl/Gemini only after user answers Tip +1 in Solo Focus |
| `limit=12` full cron | **Times out** on Vercel (~300s). Weekly job uses **`limit=3`** full OR **`repair=1`** backfill |

**Hermes does not run Gemini locally.** It only HTTP-triggers Vercel with `CRON_SECRET`.

### UTILITIES lane (13th Zone card — May 2026)

- **Profile** captures `home_power` (GAS / ELECTRIC / MIX / OTHER) — not a Solo Focus MC question.
- **UTILITIES** tile unlocks on the Zone wall only after profile power type is set (`lib/zone/utilitiesZoneUnlock.ts`).
- **JIT scrape** for `category=utilities` uses free server APIs (no keys): Postcodes.io, Carbon Intensity, optional Octopus public Agile feed — see `lib/data/utilitiesFreeApis.ts` + `lib/intelligence/utilitiesLaneRules.ts`.
- **Gemini / Firecrawl** still cite Ofgem price-cap pages for £/yr; lane lock blocks re-asking power type and blocks category drift into `grants`/`home` unless the CTA is scheme-specific.
- **Hermes config:** no VPS change — same `repair-mechanical` weekly line; utilities rows backfill with other journeys when `repair=1`.

---

## Correct weekly cron line (VPS)

```cron
# 00-00 hermes-pulse — weekly surgical pulse (Monday 05:00 UTC)
0 5 * * 1 /usr/bin/bash /home/ubuntu/00-00/scripts/hermes-pulse.sh --secret-file=/home/ubuntu/.hermes/cron.secret --weekly >> /home/ubuntu/hermes-pulse.log 2>&1
```

Install from repo:

```bash
bash scripts/install-hermes-crontab.sh --install
# default schedule is now 0 5 * * 1 (Monday)
```

---

## Mac commands (from git repo)

```bash
npm run hermes:ping
npm run hermes:repair-pulse
```

**Do not** put comments on the same line as `npm run` — npm forwards `#` to the script (`Unknown arg: #`).

```bash
bash scripts/hermes-pulse.sh --smoke --secret-file ~/.hermes/cron.secret
npm run db:log-gary
npm run db:repair-gary
```

---

## Do **not** do this (your terminal showed why)

### 1. `curl` with `limit=12` and no `repair=1` only

```bash
# BAD — FUNCTION_INVOCATION_TIMEOUT (12 × full Firecrawl+Gemini per user)
curl -X POST "https://www.00-00.online/api/cron/zone-research?limit=12" \
  -H "Authorization: Bearer YOUR_SECRET"
```

Use **repair backfill** instead:

```bash
# GOOD — backfill agent_headline / architect_prose / saving_amount_gbp on incomplete rows
curl -sS -X POST "https://www.00-00.online/api/cron/zone-research?repair=1&limit=6" \
  -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '\"')"
```

Or load secret safely (avoids zsh `!` / `(BN17)` glob bugs):

```bash
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
curl -sS -X POST "https://www.00-00.online/api/cron/zone-research?repair=1&limit=6" \
  -H "Authorization: Bearer ${SECRET}"
```

**Never** put `(BN17)` or other parentheses on the same line as `# comment` in zsh — it triggers `unknown file attribute: B`.

### 2. `hermes cron create … --model gemini-1.5-flash`

That is the **Python Hermes assistant** CLI. It does **not** schedule this app’s Vercel cron. Wrong flag: use **`-m gemini-1.5-flash`**, not `--model`.

For **this product**, use `install-hermes-crontab.sh` on the VPS, not `hermes cron create`.

### 3. Expecting `npm run db:repair-research` to fix production row 726 immediately

Local repair uses your **`.env.local`** `GEMINI_*` models. If logs still show `gemini-2.5-flash-lite`, set:

```env
GEMINI_ZONE_MODEL=gemini-1.5-flash
GEMINI_ARTICLE_MODEL=gemini-1.5-flash
GEMINI_CHAT_MODEL=gemini-1.5-flash
```

Row **726** (grants / BUS) can still get a **mechanical** £7,500 triplet without Gemini when repair runs against Neon. Latest row **728** is a junk ingest (null category) — repair skips until category is set; JIT scrapes are **per journey_key** after Tip +1.

---

## What Hermes should expect on Monday pulse

1. `GET /api/health?live=1` → 200  
2. `GET /api/health/diagnostics` + Bearer → neon, gemini, firecrawl booleans  
3. `GET /api/cron/zone-research?limit=3` with `--weekly` (or `repair=1` if you add `--repair-only` flag to script) → at most **3** full user scrapes  

Day-to-day user research is **not** Hermes’s job anymore — it is **earned** in the app when Gary answers one Solo Focus question.

---

## Neon truth check (Gary / BN17)

```bash
npm run db:log-research
```

- Exit **0** = latest row has £ + headline + 3-paragraph prose  
- Exit **2** = incomplete (Zone uses mechanical fallbacks until Tip +1 or repair)

Target for grants row 726 after repair: `saving_amount_gbp` 7500, `agent_headline` set, `architect_prose` three paragraphs.

---

## Vercel env (production)

Ensure Production has:

- `CRON_SECRET` (same as `~/.hermes/cron.secret` on VPS)  
- `GEMINI_API_KEY`  
- `FIRE_CRAWL_KEY_2`  
- Optional: `GEMINI_ZONE_MODEL=gemini-1.5-flash` (defaults in code if unset)

**use less, more.**
