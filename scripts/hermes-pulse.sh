#!/usr/bin/env bash
# Hermes → Vercel bridge: daily zone-research cron (Oracle VPS or local smoke test).
#
# Usage:
#   bash scripts/hermes-pulse.sh                    # production URL, limit=20
#   bash scripts/hermes-pulse.sh --smoke            # limit=1 (~2–5 min; proves full pipeline)
#   bash scripts/hermes-pulse.sh --auth-only        # fast: liveness + diagnostics only (~2s)
#   bash scripts/hermes-pulse.sh --env-file .env.production.local
#   CRON_SECRET_FILE=~/.hermes/cron.secret bash scripts/hermes-pulse.sh
#   bash scripts/hermes-pulse.sh --secret-file ~/.hermes/cron.secret
#
# Crontab: use `crontab -e` — do NOT paste cron lines into zsh (see scripts/install-hermes-crontab.sh).
#
# Auth: Authorization: Bearer must match Vercel Production CRON_SECRET (≥16 chars).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

zz_read_env_var() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  local line raw
  line="$(grep "^${key}=" "$file" 2>/dev/null | head -1)" || return 1
  [[ -z "$line" ]] && return 1
  raw="${line#${key}=}"
  raw="${raw%$'\r'}"
  if [[ ${#raw} -ge 2 && "${raw:0:1}" == '"' && "${raw: -1}" == '"' ]]; then raw="${raw:1:${#raw}-2}"; fi
  if [[ ${#raw} -ge 2 && "${raw:0:1}" == "'" && "${raw: -1}" == "'" ]]; then raw="${raw:1:${#raw}-2}"; fi
  raw="${raw//$'\n'/}"
  raw="${raw//$'\r'/}"
  if [[ "${raw: -2}" == $'\\n' ]]; then raw="${raw:0:${#raw}-2}"; fi
  if [[ "${raw: -2}" == $'\\r' ]]; then raw="${raw:0:${#raw}-2}"; fi
  printf '%s' "$raw"
}

ENV_FILE=""
SECRET_FILE=""
SMOKE=0
AUTH_ONLY=0
HOST="${NEXT_PUBLIC_APP_URL:-https://00-ulm.vercel.app}"
LIMIT=20

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --secret-file|--secret-file=*)
      if [[ "$1" == --secret-file=* ]]; then
        SECRET_FILE="${1#--secret-file=}"
      else
        SECRET_FILE="${2:-}"
        shift
      fi
      shift
      ;;
    --smoke)
      SMOKE=1
      LIMIT=1
      shift
      ;;
    --auth-only)
      AUTH_ONLY=1
      shift
      ;;
    --limit)
      LIMIT="${2:-20}"
      shift 2
      ;;
    http://*|https://*)
      HOST="$1"
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      echo "Usage: bash scripts/hermes-pulse.sh [--smoke|--auth-only] [--secret-file PATH] [--env-file PATH] [--limit N] [HOST]" >&2
      exit 1
      ;;
  esac
done

if [[ -n "$SECRET_FILE" ]]; then
  export CRON_SECRET_FILE="$SECRET_FILE"
fi

TOKEN=""
TOKEN_SRC=""

if [[ -n "${CRON_SECRET_FILE:-}" && -f "${CRON_SECRET_FILE}" ]]; then
  TOKEN="$(tr -d '\n\r' < "${CRON_SECRET_FILE}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  TOKEN_SRC="CRON_SECRET_FILE (${CRON_SECRET_FILE})"
fi

for f in "${ENV_FILE}" .env.production.local .env.local; do
  [[ -n "$TOKEN" ]] && break
  [[ -n "$f" && -f "$f" ]] || continue
  v="$(zz_read_env_var "$f" CRON_SECRET || true)"
  if [[ -n "$v" ]]; then
    TOKEN="$v"
    TOKEN_SRC="${f}"
    break
  fi
done

if [[ -z "$TOKEN" && -n "${CRON_SECRET:-}" ]]; then
  TOKEN="${CRON_SECRET}"
  TOKEN_SRC="CRON_SECRET(shell)"
fi

if [[ -z "$TOKEN" || ${#TOKEN} -lt 16 ]]; then
  echo "Missing CRON_SECRET (≥16 chars). Options:" >&2
  echo "  • export CRON_SECRET='…'  (same value as Vercel Production)" >&2
  echo "  • CRON_SECRET_FILE=/path/to/secret bash scripts/hermes-pulse.sh" >&2
  echo "  • vercel env pull .env.production.local --environment=production" >&2
  echo "  • bash scripts/hermes-pulse.sh --env-file .env.production.local" >&2
  exit 1
fi

HOST="${HOST%/}"
echo "→ Hermes pulse → ${HOST}"
echo "  auth: ${TOKEN_SRC} (${#TOKEN} chars, not printed)"

echo ""
echo "  → GET /api/health?live=1"
LIVE_CODE="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' "${HOST}/api/health?live=1" || printf '000')"
echo "  HTTP ${LIVE_CODE}"
if [[ "$LIVE_CODE" != "200" ]]; then
  echo "  ✗ App not reachable — fix deployment before cron." >&2
  exit 1
fi

echo ""
echo "  → GET /api/health/diagnostics (Bearer CRON_SECRET)"
DIAG_TMP="$(mktemp)"
DIAG_CODE="$(curl -sS --max-time 30 -o "$DIAG_TMP" -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  "${HOST}/api/health/diagnostics" || printf '000')"
echo "  HTTP ${DIAG_CODE}"
if command -v jq >/dev/null 2>&1 && [[ -s "$DIAG_TMP" ]]; then
  jq '{neon,dbLatencyMs,gemini,firecrawl,error}' "$DIAG_TMP" 2>/dev/null || head -c 400 "$DIAG_TMP"
else
  head -c 400 "$DIAG_TMP" 2>/dev/null || true
fi
echo ""
rm -f "$DIAG_TMP"

if [[ "$DIAG_CODE" == "401" ]]; then
  echo "✗ 401 — local secret does not match Vercel Production CRON_SECRET." >&2
  echo "  vercel env pull .env.production.local --environment=production" >&2
  echo "  Redeploy after changing the secret on Vercel." >&2
  exit 1
fi

if [[ "$AUTH_ONLY" -eq 1 ]]; then
  echo "✓ Hermes bridge auth OK (liveness + diagnostics). Full cron skipped (--auth-only)."
  exit 0
fi

echo ""
echo "  → GET /api/cron/zone-research?limit=${LIMIT}"
echo "  (Firecrawl + Gemini per user — may take several minutes; do not interrupt)"
CRON_TMP="$(mktemp)"
CRON_CODE="$(curl -sS --max-time 600 -o "$CRON_TMP" -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  "${HOST}/api/cron/zone-research?limit=${LIMIT}" || printf '000')"
echo "  HTTP ${CRON_CODE}"
if [[ -s "$CRON_TMP" ]]; then
  if command -v jq >/dev/null 2>&1; then
    jq . "$CRON_TMP" 2>/dev/null || cat "$CRON_TMP"
  else
    cat "$CRON_TMP"
  fi
fi
echo ""
rm -f "$CRON_TMP"

if [[ "$CRON_CODE" != "200" ]]; then
  echo "✗ Cron failed (HTTP ${CRON_CODE})." >&2
  exit 1
fi

echo "✓ Hermes pulse complete (zone-research limit=${LIMIT})."
