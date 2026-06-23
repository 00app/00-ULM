#!/usr/bin/env bash
# Post-ship checklist — production health, deploy hint, env presence (no secrets printed).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROD="${PROD_URL:-https://www.00-00.online}"
PASS=0
WARN=0

ok() { echo "  ✓ $*"; PASS=$((PASS + 1)); }
warn() { echo "  ⚠ $*"; WARN=$((WARN + 1)); }
fail() { echo "  ✗ $*"; exit 1; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Ship readiness — ${PROD}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "== Production health =="
code="$(curl -sS --max-time 25 -o /tmp/zz-ship-health.json -w '%{http_code}' "${PROD}/api/health" || printf '000')"
if [[ "$code" == "200" ]]; then
  ok "GET /api/health → 200"
  if command -v jq >/dev/null 2>&1; then
    db="$(jq -r '.database // empty' /tmp/zz-ship-health.json)"
    [[ "$db" == "connected" ]] && ok "Neon connected" || warn "database: ${db:-unknown}"
  fi
else
  fail "GET /api/health → HTTP ${code}"
fi

echo ""
echo "== Git =="
branch="$(git rev-parse --abbrev-ref HEAD)"
sha="$(git rev-parse --short HEAD)"
echo "  branch: ${branch} @ ${sha}"
if git fetch origin main --quiet 2>/dev/null; then
  behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
  ahead="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
  [[ "$behind" == "0" ]] && ok "in sync with origin/main" || warn "${behind} commit(s) behind origin/main — pull or push"
  [[ "$ahead" == "0" ]] || warn "${ahead} commit(s) ahead of origin/main — push pending"
fi

echo ""
echo "== Local .env.local (presence only) =="
check_key() {
  local k="$1"
  if [[ -f .env.local ]] && grep -q "^${k}=" .env.local 2>/dev/null; then
    local line val
    line="$(grep "^${k}=" .env.local | head -1)"
    val="${line#*=}"
    val="${val%$'\r'}"
    val="${val#\"}"; val="${val%\"}"
    [[ -n "${val// }" ]] && ok "${k}" || warn "${k} empty — paste from Vercel/Cloudflare (CLI pull redacts secrets)"
  else
    warn "${k} missing locally (npm run env:sync, then paste Turnstile/Twilio if empty)"
  fi
}
check_key NEXT_PUBLIC_TURNSTILE_SITE_KEY
check_key TURNSTILE_SECRET_KEY
check_key UPSTASH_REDIS_REST_URL
check_key UPSTASH_REDIS_REST_TOKEN
check_key TWILIO_ACCOUNT_SID

echo ""
echo "== Vercel deploy (if CLI linked) =="
if command -v vercel >/dev/null 2>&1; then
  if vercel inspect "${PROD}" --json >/tmp/zz-ship-vercel.json 2>/dev/null; then
    if command -v jq >/dev/null 2>&1; then
      state="$(jq -r '.readyState // .status // empty' /tmp/zz-ship-vercel.json 2>/dev/null)"
      dep_sha="$(jq -r '.meta.githubCommitSha // .gitSource.sha // empty' /tmp/zz-ship-vercel.json 2>/dev/null | head -c 7)"
      [[ -n "$state" ]] && echo "  production state: ${state}"
      [[ -n "$dep_sha" ]] && echo "  deploy commit: ${dep_sha}"
      [[ "$state" == "READY" ]] && ok "production deployment READY" || warn "deployment not READY (${state:-unknown})"
    fi
  else
    warn "vercel inspect failed — check dashboard manually"
  fi
else
  warn "vercel CLI not installed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ${PASS} passed, ${WARN} warnings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
rm -f /tmp/zz-ship-health.json /tmp/zz-ship-vercel.json 2>/dev/null || true
