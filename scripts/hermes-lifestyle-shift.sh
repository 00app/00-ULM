#!/usr/bin/env bash
# Hermes on-demand: lifestyle_shift pattern research → POST /api/scrape-sync (pink achievement path).
#
# Usage:
#   bash scripts/hermes-lifestyle-shift.sh --postcode BN17 --category travel \
#     --question-id lifestyle_shift_pattern --answer-value "RAIL_NOT_FLIGHT"
#
#   bash scripts/hermes-lifestyle-shift.sh --secret-file ~/.hermes/cron.secret \
#     --postcode BN17 --category travel --user-id <uuid> --parent-answer-id <uuid>
#
# URL shield: retries when Vercel returns url_shield.retry_recommended (generic/dead links).
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
HOST="${NEXT_PUBLIC_APP_URL:-https://00-ulm.vercel.app}"
POSTCODE=""
CATEGORY="home"
QUESTION_ID="lifestyle_shift_pattern"
ANSWER_VALUE=""
USER_ID=""
PARENT_ANSWER_ID=""
MAX_RETRIES="${HERMES_URL_RETRIES:-3}"

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
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --postcode)
      POSTCODE="${2:-}"
      shift 2
      ;;
    --category)
      CATEGORY="${2:-home}"
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
    http://*|https://*)
      HOST="$1"
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
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
  TOKEN_SRC="CRON_SECRET_FILE"
fi
for f in "${ENV_FILE}" .env.production.local .env.local; do
  [[ -n "$TOKEN" ]] && break
  [[ -n "$f" && -f "$f" ]] || continue
  v="$(zz_read_env_var "$f" CRON_SECRET || true)"
  if [[ -n "$v" ]]; then TOKEN="$v"; TOKEN_SRC="$f"; break; fi
done
if [[ -z "$TOKEN" && -n "${CRON_SECRET:-}" ]]; then
  TOKEN="${CRON_SECRET}"
  TOKEN_SRC="shell"
fi

POSTCODE="${POSTCODE// /}"
POSTCODE="$(printf '%s' "$POSTCODE" | tr '[:lower:]' '[:upper:]')"

if [[ -z "$TOKEN" || ${#TOKEN} -lt 16 ]]; then
  echo "Missing CRON_SECRET (≥16 chars)." >&2
  exit 1
fi
if [[ ${#POSTCODE} -lt 4 ]]; then
  echo "--postcode required (≥4 chars)" >&2
  exit 1
fi
if [[ -z "$ANSWER_VALUE" ]]; then
  echo "--answer-value required for lifestyle_shift research" >&2
  exit 1
fi

HOST="${HOST%/}"
echo "→ Hermes lifestyle_shift → ${HOST}/api/scrape-sync"
echo "  postcode=${POSTCODE} category=${CATEGORY} question=${QUESTION_ID}"
echo "  auth: ${TOKEN_SRC} (${#TOKEN} chars)"

build_post_body() {
  local attempt_n="${1:-1}"
  if command -v jq >/dev/null 2>&1; then
    jq -n \
      --arg postcode "$POSTCODE" \
      --arg category "$CATEGORY" \
      --arg qid "$QUESTION_ID" \
      --arg ans "$ANSWER_VALUE" \
      --arg uid "$USER_ID" \
      --arg parent "$PARENT_ANSWER_ID" \
      --argjson attempt "$attempt_n" \
      '{
        trigger: true,
        source: "hermes-lifestyle-shift",
        postcode: $postcode,
        category: $category,
        question_id: $qid,
        answer_value: $ans,
        lifestyle_mode: "shift",
        is_achievement_card: true,
        hermes_attempt: $attempt
      }
      + (if ($uid | length) > 0 then {user_id: $uid} else {} end)
      + (if ($parent | length) > 0 then {parent_answer_id: $parent} else {} end)'
  else
    esc_ans="${ANSWER_VALUE//\\/\\\\}"
    esc_ans="${esc_ans//\"/\\\"}"
    printf '{"trigger":true,"source":"hermes-lifestyle-shift","postcode":"%s","category":"%s","question_id":"%s","answer_value":"%s","lifestyle_mode":"shift","is_achievement_card":true,"hermes_attempt":%s' \
      "$POSTCODE" "$CATEGORY" "$QUESTION_ID" "$esc_ans" "$attempt_n" > "$BODY_TMP"
    if [[ -n "$USER_ID" ]]; then printf ',"user_id":"%s"' "$USER_ID" >> "$BODY_TMP"; fi
    if [[ -n "$PARENT_ANSWER_ID" ]]; then printf ',"parent_answer_id":"%s"' "$PARENT_ANSWER_ID" >> "$BODY_TMP"; fi
    printf '}' >> "$BODY_TMP"
  fi
}

BODY_TMP="$(mktemp)"

attempt=1
HTTP_CODE="000"
while [[ "$attempt" -le "$MAX_RETRIES" ]]; do
  build_post_body "$attempt"
  echo ""
  echo "  → POST scrape-sync (attempt ${attempt}/${MAX_RETRIES}) — expect 2–5 min"
  RESP="$(mktemp)"
  HTTP_CODE="$(curl -sS --max-time 600 -o "$RESP" -w '%{http_code}' \
    -X POST "${HOST}/api/scrape-sync?postcode=${POSTCODE}&force=true" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d @"$BODY_TMP" || printf '000')"

  echo "  HTTP ${HTTP_CODE}"
  if [[ -s "$RESP" ]]; then
    if command -v jq >/dev/null 2>&1; then
      if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" || "$HTTP_CODE" == "202" ]]; then
        jq '{ok,mode,lifestyle_mode,is_achievement_card,url_shield,achievement,achievement_error,achievement_card_summary}' "$RESP" 2>/dev/null || cat "$RESP"
      else
        echo "  Response:" >&2
        jq . "$RESP" 2>/dev/null || cat "$RESP"
      fi
    else
      cat "$RESP"
    fi
  fi
  echo ""

  RETRY=0
  PERSISTED=0
  if command -v jq >/dev/null 2>&1 && [[ -s "$RESP" ]]; then
    if jq -e '.url_shield.retry_recommended == true' "$RESP" >/dev/null 2>&1; then
      RETRY=1
    fi
    if jq -e '.achievement.persisted == true' "$RESP" >/dev/null 2>&1; then
      PERSISTED=1
    fi
  fi

  if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" && "$HTTP_CODE" != "202" ]]; then
    rm -f "$RESP" "$BODY_TMP"
    echo "✗ scrape-sync failed (HTTP ${HTTP_CODE})." >&2
    echo "  If detail mentions a column, run: npm run init-db (migration 019)." >&2
    echo "  If lifestyle_mode is null, deploy latest scrape-sync to Vercel Production." >&2
    exit 1
  fi
  rm -f "$RESP"

  if [[ "$RETRY" -eq 0 ]]; then
    echo "✓ Lifestyle shift research complete (URL shield passed)."
    rm -f "$BODY_TMP"
    exit 0
  fi

  if [[ "$PERSISTED" -eq 1 ]]; then
    echo "✓ Achievement persisted to Neon (URL shield still flagged — card may use National Rail fallback)." >&2
    rm -f "$BODY_TMP"
    exit 0
  fi

  echo "  ⚠ URL shield: generic or dead link — Hermes retry (${attempt}/${MAX_RETRIES})" >&2
  attempt=$((attempt + 1))
  sleep 3
done

rm -f "$BODY_TMP"
echo "✗ URL shield failed after ${MAX_RETRIES} attempts — no pink card with shallow URL." >&2
exit 2
