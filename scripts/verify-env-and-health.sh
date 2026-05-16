#!/usr/bin/env bash
# Verify .env.local key presence (values never printed) + probe /api/health + diagnostics.
# The Neon "password authentication failed" fix is always: paste a fresh pooled DATABASE_URL in Vercel → redeploy.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Auth for GET /api/health/diagnostics (Bearer). Never print secrets. ---
# If you literally exported CRON_SECRET=paste-here-in-your-terminal-only, that will 401 — we unset and read .env.local.
PLACEHOLDER='paste-here-in-your-terminal-only'
[[ "${CRON_SECRET:-}" == "$PLACEHOLDER" ]] && unset CRON_SECRET
[[ "${GATEWAY_TOKEN:-}" == "$PLACEHOLDER" ]] && unset GATEWAY_TOKEN

zz_env_file_val() {
  local k="$1"
  [[ -f .env.local ]] || return 1
  local line raw
  line="$(grep "^${k}=" .env.local 2>/dev/null | head -1)" || return 1
  [[ -z "$line" ]] && return 1
  raw="${line#${k}=}"
  raw="${raw%$'\r'}"
  if [[ ${#raw} -ge 2 && "${raw:0:1}" == '"' && "${raw: -1}" == '"' ]]; then raw="${raw:1:${#raw}-2}"; fi
  if [[ ${#raw} -ge 2 && "${raw:0:1}" == "'" && "${raw: -1}" == "'" ]]; then raw="${raw:1:${#raw}-2}"; fi
  printf '%s' "$raw"
}

if [[ -z "${CRON_SECRET:-}" ]]; then
  v="$(zz_env_file_val CRON_SECRET)" && export CRON_SECRET="$v" || true
fi
if [[ -z "${GATEWAY_TOKEN:-}" ]]; then
  v="$(zz_env_file_val GATEWAY_TOKEN)" && export GATEWAY_TOKEN="$v" || true
fi

TMP_HEALTH="${TMPDIR:-/tmp}/zz-health-$$.json"
cleanup() { rm -f "$TMP_HEALTH" 2>/dev/null || true; }
trap cleanup EXIT

jq_bin() {
  if command -v jq >/dev/null 2>&1; then jq "$@"; else cat; fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 00-00 — env presence + health (no secrets printed)"
if [[ -n "${CRON_SECRET:-}" ]]; then
  echo " (diagnostics auth: CRON_SECRET loaded — not printed)"
elif [[ -n "${GATEWAY_TOKEN:-}" ]]; then
  echo " (diagnostics auth: GATEWAY_TOKEN loaded — not printed)"
else
  echo " (diagnostics auth: none — /api/health/diagnostics will return 401 unless you set CRON_SECRET or GATEWAY_TOKEN)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "== Local .env.local (presence + value length only) =="
if [[ -f .env.local ]]; then
  for key in DATABASE_URL GEMINI_API_KEY FIRE_CRAWL_KEY_2 CRON_SECRET; do
    line="$(grep "^${key}=" .env.local 2>/dev/null | head -1 || true)"
    if [[ -z "$line" ]]; then
      echo "  ${key}: MISSING"
      continue
    fi
    val="${line#*=}"
    val="${val//$'\r'/}"
    if [[ -z "${val// }" ]]; then
      echo "  ${key}: EMPTY"
    else
      echo "  ${key}: set (${#val} chars)"
    fi
  done
else
  echo "  (no .env.local) — run: cp .env.example .env.local"
fi

echo ""
echo "== Optional: pull Production env from Vercel (interactive) =="
echo "  vercel link"
echo "  vercel env pull .env.vercel.pull --environment=production"
echo "  # Merge DATABASE_URL / keys into .env.local manually — never commit secrets."

echo ""
echo "== Fix Neon password / red Intelligence Loop (required for DB-backed rows) =="
echo "  1) https://console.neon.tech → project → Connect → copy pooled URI (-pooler....neon.tech)."
echo "  2) https://vercel.com → 00-ulm → Settings → Environment Variables → DATABASE_URL (Production) → paste → Save."
echo "  3) Redeploy: npm run deploy   OR   vercel --prod --yes"
echo ""
echo "  CLI (paste URI when prompted):"
echo "  vercel env rm DATABASE_URL production --yes 2>/dev/null || true"
echo "  vercel env add DATABASE_URL production"

echo ""
echo "== HTTP probes (BASE_URL default http://127.0.0.1:3000 — start dev first for local) =="
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
echo "  BASE_URL=$BASE_URL"
echo ""

echo "  → GET /api/health?live=1 (no database)"
curl -sS --max-time 20 "${BASE_URL}/api/health?live=1" | jq_bin . || echo '{"note":"curl failed — is the server running?"}'
echo ""

echo "  → GET /api/health (Neon SELECT 1)"
code="$(curl -sS --max-time 20 -o "$TMP_HEALTH" -w '%{http_code}' "${BASE_URL}/api/health" || printf '000')"
echo "  HTTP ${code}"
if [[ -s "$TMP_HEALTH" ]]; then cat "$TMP_HEALTH" | jq_bin .; else echo "  (empty body)"; fi
echo ""

echo "  → GET /api/health/diagnostics (Bearer: CRON_SECRET or GATEWAY_TOKEN — auto-read from .env.local if unset)"
AUTH_ARGS=()
if [[ -n "${CRON_SECRET:-}" ]]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${CRON_SECRET}")
elif [[ -n "${GATEWAY_TOKEN:-}" ]]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${GATEWAY_TOKEN}")
fi
diag_tmp="${TMPDIR:-/tmp}/zz-diag-$$.json"
diag_code="$(curl -sS --max-time 25 -o "$diag_tmp" -w '%{http_code}' "${AUTH_ARGS[@]}" "${BASE_URL}/api/health/diagnostics" || printf '000')"
echo "  HTTP ${diag_code}"
if [[ -s "$diag_tmp" ]]; then
  cat "$diag_tmp" | jq_bin '{neon,dbLatencyMs,gemini,firecrawl,error}' 2>/dev/null || cat "$diag_tmp"
else
  echo "  (empty)"
fi
rm -f "$diag_tmp" 2>/dev/null || true
echo ""
if [[ "$diag_code" == "401" ]]; then
  echo "  Still 401? Production CRON_SECRET must match Vercel (not the value in .env.local if they differ)."
  echo "  Export the real secret in this shell only:  export CRON_SECRET='…from Vercel dashboard…'"
fi

echo "== Production one-liner =="
echo "  BASE_URL=https://00-ulm.vercel.app bash scripts/verify-env-and-health.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
