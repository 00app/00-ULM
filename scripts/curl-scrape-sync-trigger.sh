#!/usr/bin/env bash
# Trigger POST /api/scrape-sync (force + postcode) without zsh mangling Bearer tokens containing `!`.
#
# Usage:
#   bash scripts/curl-scrape-sync-trigger.sh [https://YOUR.vercel.app] [POSTCODE]
#   bash scripts/curl-scrape-sync-trigger.sh --env-file .env.production.local https://www.00-00.online BN17
#
# Auth: Authorization: Bearer must match Vercel Production SCRAPER_SECRET or CRON_SECRET (≥16 chars).
# Firecrawl is separate (FIRE_CRAWL_KEY_2 / FIRECRAWL_API_KEY).
set -euo pipefail

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
  # Vercel env pull can append a literal backslash-n (two chars) — server stores secret without it.
  if [[ "${raw: -2}" == $'\\n' ]]; then raw="${raw:0:${#raw}-2}"; fi
  if [[ "${raw: -2}" == $'\\r' ]]; then raw="${raw:0:${#raw}-2}"; fi
  printf '%s' "$raw"
}

ENV_FILE=""
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

HOST="${POSITIONAL[0]:-${NEXT_PUBLIC_APP_URL:-https://www.00-00.online}}"
POSTCODE="${POSITIONAL[1]:-M11AG}"
CATEGORY="${POSITIONAL[2]:-home}"

# Load secrets from env file first (avoids stale shell exports overriding a fresh `vercel env pull`).
CRON_FROM_FILE=""
SCRAPER_FROM_FILE=""
for f in "${ENV_FILE}" .env.production.local .env.local; do
  [[ -n "$f" && -f "$f" ]] || continue
  [[ -z "$CRON_FROM_FILE" ]] && CRON_FROM_FILE="$(zz_read_env_var "$f" CRON_SECRET || true)"
  [[ -z "$SCRAPER_FROM_FILE" ]] && SCRAPER_FROM_FILE="$(zz_read_env_var "$f" SCRAPER_SECRET || true)"
  [[ -n "$CRON_FROM_FILE" || -n "$SCRAPER_FROM_FILE" ]] && break
done

# Build candidate list: file secrets first, then shell (dedupe by value).
declare -a AUTH_KEYS=()
declare -a AUTH_VALS=()
zz_add_auth_candidate() {
  local key="$1" val="$2"
  [[ -n "$val" ]] || return 0
  [[ ${#val} -ge 16 ]] || return 0
  local existing
  for existing in "${AUTH_VALS[@]:-}"; do
    [[ "$existing" == "$val" ]] && return 0
  done
  AUTH_KEYS+=("$key")
  AUTH_VALS+=("$val")
}
zz_add_auth_candidate "CRON_SECRET(file)" "$CRON_FROM_FILE"
zz_add_auth_candidate "SCRAPER_SECRET(file)" "$SCRAPER_FROM_FILE"
if [[ -z "${ENV_FILE}" ]]; then
  zz_add_auth_candidate "CRON_SECRET(shell)" "${CRON_SECRET:-}"
  zz_add_auth_candidate "SCRAPER_SECRET(shell)" "${SCRAPER_SECRET:-}"
fi

if [[ ${#AUTH_VALS[@]} -eq 0 ]]; then
  echo "Missing SCRAPER_SECRET or CRON_SECRET (≥16 chars; must match Vercel Production)." >&2
  echo "Usage: bash scripts/curl-scrape-sync-trigger.sh [--env-file .env.production.local] [HOST] [POSTCODE]" >&2
  exit 1
fi

echo "→ POST ${HOST%/}/api/scrape-sync?postcode=${POSTCODE}&force=true (category=${CATEGORY})" >&2
echo "  Auth candidates: ${#AUTH_VALS[@]} (from ${ENV_FILE:-.env.production.local,.env.local} + shell)" >&2
echo "  Expect 2–4 minutes — do not Ctrl+C unless you mean to cancel." >&2

RESP="$(mktemp)"
BODY="$(printf '{"trigger":true,"postcode":"%s","category":"%s"}' "$POSTCODE" "$CATEGORY")"
HTTP_CODE="000"
USED_KEY=""
for i in "${!AUTH_VALS[@]}"; do
  TOKEN="${AUTH_VALS[$i]}"
  USED_KEY="${AUTH_KEYS[$i]}"
  HTTP_CODE="$(curl -sS -o "$RESP" -w '%{http_code}' --max-time 600 -X POST "${HOST%/}/api/scrape-sync?postcode=${POSTCODE}&force=true" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$BODY")"
  if [[ "$HTTP_CODE" != "401" ]]; then
    break
  fi
  echo "  ✗ ${USED_KEY} (${#TOKEN} chars) → HTTP 401" >&2
done
cat "$RESP"
echo ""
echo "HTTP ${HTTP_CODE} (auth: ${USED_KEY}, ${#TOKEN} chars)" >&2
rm -f "$RESP"

if [[ "$HTTP_CODE" == "401" ]]; then
  echo "" >&2
  echo "401 Unauthorized — none of your local secrets match Vercel Production." >&2
  echo "  1. vercel link && vercel env pull .env.production.local --environment=production" >&2
  echo "  2. Vercel → 00-ulm → Settings → Environment Variables → Production → CRON_SECRET" >&2
  echo "  3. Redeploy Production after changing the secret (uncheck build cache once)." >&2
  echo "  4. unset CRON_SECRET SCRAPER_SECRET  # drop stale shell exports" >&2
  echo "  5. Retry: bash scripts/curl-scrape-sync-trigger.sh --env-file .env.production.local https://www.00-00.online BN17" >&2
  exit 1
fi

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" && "$HTTP_CODE" != "202" ]]; then
  exit 1
fi
