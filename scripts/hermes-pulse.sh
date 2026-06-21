#!/usr/bin/env bash
# Hermes → Vercel bridge: weekly zone-research pulse (Oracle VPS or Mac smoke test).
# Ulm JIT: day-to-day scrapes are earned in-app (Tip +1); Hermes only does a small weekly batch or repair backfill.
#
# Usage:
#   bash scripts/hermes-pulse.sh --weekly             # limit=3 (Monday cron default)
#   bash scripts/hermes-pulse.sh --repair-only      # ?repair=1&limit=12 — no full Firecrawl loop
#   bash scripts/hermes-pulse.sh --smoke            # limit=1 (~2–5 min; proves full pipeline)
#   bash scripts/hermes-pulse.sh --auth-only        # fast: liveness + diagnostics only (~2s)
#   bash scripts/hermes-pulse.sh --mode=lifestyle_shift --postcode BN17 --category travel \
#     --answer-value "RAIL_NOT_FLIGHT" [--user-id UUID] [--parent-answer-id UUID]
#   bash scripts/hermes-pulse.sh --env-file .env.production.local
#   CRON_SECRET_FILE=~/.hermes/cron.secret bash scripts/hermes-pulse.sh
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
HOST="${NEXT_PUBLIC_APP_URL:-https://www.00-00.online}"
LIMIT=3
REPAIR_ONLY=0
WEEKLY=0
MODE=""
POSTCODE=""
CATEGORY="home"
QUESTION_ID="lifestyle_shift_pattern"
ANSWER_VALUE=""
USER_ID=""
PARENT_ANSWER_ID=""

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
    --mode|--mode=*)
      if [[ "$1" == --mode=* ]]; then
        MODE="${1#--mode=}"
        shift
      else
        MODE="${2:-}"
        shift 2
      fi
      ;;
    --postcode)
      POSTCODE="${2:-}"
      shift 2
      ;;
    --category)
      CATEGORY="${2:-}"
      shift 2
      ;;
    --question-id)
      QUESTION_ID="${2:-}"
      shift 2
      ;;
    --answer-value)
      ANSWER_VALUE="${2:-}"
      shift 2
      ;;
    --user-id)
      USER_ID="${2:-}"
      shift 2
      ;;
    --parent-answer-id)
      PARENT_ANSWER_ID="${2:-}"
      shift 2
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
    --repair-only)
      REPAIR_ONLY=1
      LIMIT=6
      shift
      ;;
    --weekly)
      WEEKLY=1
      LIMIT=3
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
      echo "Usage: bash scripts/hermes-pulse.sh [--weekly|--repair-only|--smoke|--auth-only] [--env-file PATH] [--secret-file PATH]" >&2
      echo "  npm: run scripts without inline comments (npm passes # to bash)." >&2
      exit 1
      ;;
  esac
done

if [[ "$MODE" == "lifestyle_shift" ]]; then
  LS_ARGS=(--host "$HOST")
  [[ -n "$SECRET_FILE" ]] && LS_ARGS+=(--secret-file "$SECRET_FILE")
  [[ -n "$ENV_FILE" ]] && LS_ARGS+=(--env-file "$ENV_FILE")
  [[ -n "$POSTCODE" ]] && LS_ARGS+=(--postcode "$POSTCODE")
  [[ -n "$CATEGORY" ]] && LS_ARGS+=(--category "$CATEGORY")
  [[ -n "$QUESTION_ID" ]] && LS_ARGS+=(--question-id "$QUESTION_ID")
  [[ -n "$ANSWER_VALUE" ]] && LS_ARGS+=(--answer-value "$ANSWER_VALUE")
  [[ -n "$USER_ID" ]] && LS_ARGS+=(--user-id "$USER_ID")
  [[ -n "$PARENT_ANSWER_ID" ]] && LS_ARGS+=(--parent-answer-id "$PARENT_ANSWER_ID")
  exec bash "${ROOT}/scripts/hermes-lifestyle-shift.sh" "${LS_ARGS[@]}"
fi

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

CRON_PATH="/api/cron/zone-research"
CRON_QUERY="limit=${LIMIT}"
CRON_MAX_TIME=600
if [[ "$REPAIR_ONLY" -eq 1 ]]; then
  CRON_PATH="/api/cron/repair-mechanical"
  CRON_QUERY="limit=${LIMIT}"
  CRON_MAX_TIME=90
  echo ""
  echo "  → GET ${CRON_PATH}?${CRON_QUERY} (max ${CRON_MAX_TIME}s)"
  echo "  (mechanical only — BUS + Ofgem; no Gemini. Requires deploy of repair-mechanical route.)"
else
  echo ""
  echo "  → GET ${CRON_PATH}?${CRON_QUERY}"
  echo "  (Ulm weekly: max ${LIMIT} full user scrapes — JIT handles the rest in-app)"
fi
CRON_TMP="$(mktemp)"
CRON_CODE="$(curl -sS --max-time "${CRON_MAX_TIME}" -o "$CRON_TMP" -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  "${HOST}${CRON_PATH}?${CRON_QUERY}" || printf '000')"
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
  if [[ "$REPAIR_ONLY" -eq 1 && "$CRON_CODE" == "404" ]]; then
    echo "  ✗ repair-mechanical not on production yet — deploy 00-ulm, then retry." >&2
    echo "  Local backfill now: npm run db:repair-mechanical" >&2
  elif [[ "$REPAIR_ONLY" -eq 1 && "$CRON_CODE" == "504" ]]; then
    echo "  ✗ Timed out — production still on old zone-research?repair=1 (Gemini). Deploy repair-mechanical route." >&2
    echo "  Local backfill now: npm run db:repair-mechanical" >&2
  fi
  echo "✗ Cron failed (HTTP ${CRON_CODE})." >&2
  exit 1
fi

if [[ "$REPAIR_ONLY" -eq 1 ]]; then
  echo "✓ Hermes repair pulse complete (repair-mechanical limit=${LIMIT})."
else
  echo "✓ Hermes pulse complete (zone-research limit=${LIMIT}${WEEKLY:+, weekly mode})."
fi
