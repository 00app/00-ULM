#!/usr/bin/env bash
# Trigger POST /api/scrape-sync (force + postcode) without zsh mangling Bearer tokens containing `!`.
#
# Usage:
#   bash scripts/curl-scrape-sync-trigger.sh [https://YOUR.vercel.app] [POSTCODE]
#   bash scripts/curl-scrape-sync-trigger.sh --env-file .env.production.local https://00-ulm.vercel.app BN17
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

HOST="${POSITIONAL[0]:-${NEXT_PUBLIC_APP_URL:-https://00-ulm.vercel.app}}"
POSTCODE="${POSITIONAL[1]:-M11AG}"
CATEGORY="${POSITIONAL[2]:-home}"

TOKEN="${SCRAPER_SECRET:-}"
if [[ -z "${TOKEN}" && -n "${CRON_SECRET:-}" ]]; then TOKEN="${CRON_SECRET}"; fi

if [[ -z "${TOKEN}" ]]; then
  for f in "${ENV_FILE}" .env.production.local .env.local; do
    [[ -n "$f" && -f "$f" ]] || continue
    v="$(zz_read_env_var "$f" SCRAPER_SECRET)" && TOKEN="$v" && break
    v="$(zz_read_env_var "$f" CRON_SECRET)" && TOKEN="$v" && break
  done
fi

if [[ -z "${TOKEN}" ]]; then
  echo "Missing SCRAPER_SECRET or CRON_SECRET (≥16 chars; must match Vercel Production)." >&2
  echo "Usage: bash scripts/curl-scrape-sync-trigger.sh [--env-file .env.production.local] [HOST] [POSTCODE]" >&2
  exit 1
fi

if [[ ${#TOKEN} -lt 16 ]]; then
  echo "Secret is only ${#TOKEN} chars — Vercel requires ≥16. Update CRON_SECRET on Production and redeploy." >&2
  exit 1
fi

RESP="$(mktemp)"
BODY="$(printf '{"trigger":true,"postcode":"%s","category":"%s"}' "$POSTCODE" "$CATEGORY")"
HTTP_CODE="$(curl -sS -o "$RESP" -w '%{http_code}' -X POST "${HOST%/}/api/scrape-sync?postcode=${POSTCODE}&force=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY")"
cat "$RESP"
echo ""
echo "HTTP ${HTTP_CODE}" >&2
rm -f "$RESP"

if [[ "$HTTP_CODE" == "401" ]]; then
  echo "" >&2
  echo "401 Unauthorized — the Bearer token does not match what this deployment has in Production." >&2
  echo "  • Vercel → 00-ulm → Settings → Environment Variables → Production → copy CRON_SECRET (or SCRAPER_SECRET)." >&2
  echo "  • vercel env pull .env.production.local --environment=production && redeploy if you just changed it." >&2
  echo "  • Do not source .env in zsh when the secret contains ! — this script parses the file in bash." >&2
  exit 1
fi

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" && "$HTTP_CODE" != "202" ]]; then
  exit 1
fi
