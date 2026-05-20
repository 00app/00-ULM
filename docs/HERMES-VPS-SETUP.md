# Hermes VPS setup (Oracle `zerozero-auditor`)

Reference for `ubuntu@140.238.100.237` — Hermes only **HTTP-triggers** Vercel; it does not run Gemini/Firecrawl locally.

**Production target:** `https://00-ulm.vercel.app/api/cron/zone-research`

**Operator brief (read first):** [`HERMES-ULM-JIT-BRIEF.md`](./HERMES-ULM-JIT-BRIEF.md) — Ulm JIT, weekly schedule, why `limit=12` timed out, correct curl/Mac commands.

---

## Ulm JIT (May 2026) — what Hermes triggers now

| Job | Schedule | Command |
|-----|----------|---------|
| **Weekly pulse** | Monday 05:00 UTC `0 5 * * 1` | `hermes-pulse.sh --weekly` → `?limit=3` (max 3 full user scrapes) |
| **Repair backfill** | Manual / optional | `hermes-pulse.sh --repair-only` → `?repair=1&limit=12` (headline/£/prose only) |
| **Auth smoke** | Anytime | `hermes-pulse.sh --auth-only` (~2s) |

Day-to-day research is **not** bulk-croned. Users earn a **surgical scrape** after answering one Solo Focus Tip +1 question in the app (`gemini-1.5-flash`, topic-locked by `journey_key`).

**Do not** run `limit=12` without `repair=1` on production — Vercel will **FUNCTION_INVOCATION_TIMEOUT**.

---

## What your terminal showed

| Observation | Meaning |
|---------------|---------|
| `tail /var/log/hermes-cron.log` → no file | Cron never ran (or log path was wrong). Use **`~/hermes-pulse.log`**, not `/var/log/…`. |
| `crontab -l` only comments | **`crontab -e` saved with no job line** — Hermes is not scheduled yet. |
| Mac `curl` → 401 | `$CRON_SECRET` empty in shell, or wrong value. Use `npm run hermes:ping` on Mac. |

---

## Fastest path (from Mac, one command)

```bash
cd ~/Documents/00-00
bash scripts/deploy-hermes-to-vps.sh
```

This rsyncs `hermes-pulse.sh`, writes `~/.hermes/cron.secret` from `.env.production.local`, runs `--auth-only`, and leaves your existing crontab line in place.

---

## One-time setup on the VPS (manual)

### 1. SSH in (from Mac)

```bash
ssh -i ~/Downloads/ssh-key-2026-05-08.key ubuntu@140.238.100.237
```

### 2. Get the repo (if missing)

```bash
git clone https://github.com/00app/00-ULM.git ~/00-00
cd ~/00-00
git pull
```

Or sync only the scripts from your Mac:

```bash
ssh -i ~/Downloads/ssh-key-2026-05-08.key ubuntu@140.238.100.237 'mkdir -p ~/00-00/scripts'
rsync -avz -e "ssh -i ~/Downloads/ssh-key-2026-05-08.key" \
  scripts/hermes-pulse.sh scripts/install-hermes-crontab.sh scripts/setup-hermes-vps.sh \
  ubuntu@140.238.100.237:~/00-00/scripts/
```

### 3. Secret file (same as Vercel `CRON_SECRET`)

```bash
mkdir -p ~/.hermes && chmod 700 ~/.hermes
# Paste production secret — use single quotes if it contains !
printf '%s' 'YOUR_VERCEL_CRON_SECRET' > ~/.hermes/cron.secret
chmod 600 ~/.hermes/cron.secret
```

### 4. Run setup + install cron

```bash
cd ~/00-00
bash scripts/setup-hermes-vps.sh --install-cron
```

Or manually:

```bash
bash scripts/hermes-pulse.sh --secret-file ~/.hermes/cron.secret --auth-only
bash scripts/install-hermes-crontab.sh --install
crontab -l   # must show ONE line starting with 0 5 * * 1 (weekly)
```

### 5. Verify crontab (non-empty)

```bash
crontab -l | grep hermes-pulse
```

Expected (either form is fine):

```cron
# 00-00 hermes-pulse
0 5 * * 1 /usr/bin/bash /home/ubuntu/00-00/scripts/hermes-pulse.sh --secret-file=/home/ubuntu/.hermes/cron.secret --weekly >> /home/ubuntu/hermes-pulse.log 2>&1
```

Or (what you installed):

```cron
0 5 * * * /usr/bin/bash /home/ubuntu/00-00/scripts/hermes-pulse.sh --secret-file=/home/ubuntu/.hermes/cron.secret >> /home/ubuntu/hermes-pulse.log 2>&1
```

Prefer **`/usr/bin/bash`** in cron so the job does not depend on the script’s execute bit alone.

### 6. Test on VPS (do **not** use `npm` on the server)

`npm run hermes:ping` only works on your **Mac** inside the git repo. On the VPS there is no `package.json` in `~` — use **bash** directly:

```bash
/usr/bin/bash /home/ubuntu/00-00/scripts/hermes-pulse.sh \
  --secret-file=/home/ubuntu/.hermes/cron.secret --auth-only
```

Full smoke (~2–5 min):

```bash
/usr/bin/bash /home/ubuntu/00-00/scripts/hermes-pulse.sh \
  --secret-file=/home/ubuntu/.hermes/cron.secret --smoke
tail -30 ~/hermes-pulse.log
```

If `No such file` for `hermes-pulse.sh`, clone or rsync the repo first (§2).

---

## crontab -e tips

- Add **one line** at the bottom (do not paste into zsh on Mac).
- Save and exit (`nano`: Ctrl+O, Enter, Ctrl+X).
- `crontab -l` must show the `0 5 * * *` line — not only `#` comments.

---

## Mac vs VPS

| | Mac (dev) | Oracle VPS (Hermes) |
|--|-----------|---------------------|
| Schedule | Optional `install-hermes-crontab.sh --install` | **Required** for weekly pulse (`0 5 * * 1`) |
| Secret | `~/.hermes/cron.secret` | Same path under `/home/ubuntu/` |
| Log | `~/hermes-pulse.log` | `/home/ubuntu/hermes-pulse.log` |
| Quick test | `npm run hermes:ping` (in repo on Mac) | `bash …/hermes-pulse.sh --secret-file … --auth-only` (**no npm**) |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| HTTP 401 | Secret ≠ Vercel Production `CRON_SECRET`; redeploy after rotating on Vercel. |
| `zsh: event not found` | Secret contains `!` — use **single quotes** or `set +H` before export. |
| Empty `crontab -l` | Re-run `bash scripts/install-hermes-crontab.sh --install`. |
| No log file | Cron not run yet; run manual `--smoke` once or wait until 05:00 UTC. |

See also: `HANDBOOK.md` · `docs/FULL-APP-SPEC.md` §11 · `scripts/hermes-pulse.sh`
