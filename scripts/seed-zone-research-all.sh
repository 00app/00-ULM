#!/usr/bin/env bash
# Seed all 13 journey categories for a postcode via POST /api/scrape-sync (Bearer auth).
# Mirrors lib/journeys.ts JOURNEY_ORDER (home … carbon).
#
# Usage:
#   bash scripts/seed-zone-research-all.sh --env-file .env.local http://127.0.0.1:3000 SW1A1AA
#   bash scripts/seed-zone-research-all.sh SW1A1AA   # uses NEXT_PUBLIC_APP_URL or 00-ulm default
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRIGGER="${SCRIPT_DIR}/curl-scrape-sync-trigger.sh"

ENV_ARGS=()
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_ARGS=(--env-file "$2")
      shift 2
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

# Host + postcode: if first arg looks like a postcode (no scheme), treat as postcode only.
HOST="${NEXT_PUBLIC_APP_URL:-https://www.00-00.online}"
POSTCODE="M11AG"
if [[ ${#POSITIONAL[@]} -ge 1 ]]; then
  if [[ "${POSITIONAL[0]}" == http* ]]; then
    HOST="${POSITIONAL[0]}"
    POSTCODE="${POSITIONAL[1]:-M11AG}"
  else
    POSTCODE="${POSITIONAL[0]}"
    [[ ${#POSITIONAL[@]} -ge 2 ]] && HOST="${POSITIONAL[1]}"
  fi
fi

POSTCODE_UPPER="$(printf '%s' "$POSTCODE" | tr '[:lower:]' '[:upper:]' | tr -d '[:space:]')"
BLOCKED_POSTCODES=(YOURPOSTCODE YOUR_POSTCODE POSTCODE EXAMPLEPOSTCODE)
for blocked in "${BLOCKED_POSTCODES[@]}"; do
  if [[ "$POSTCODE_UPPER" == "$blocked" ]]; then
    echo "Refusing placeholder postcode: ${POSTCODE}" >&2
    echo "Use a real UK postcode, e.g. npm run scrape:fresh -- M11AG" >&2
    exit 1
  fi
done
if [[ ${#POSTCODE_UPPER} -lt 5 || ${#POSTCODE_UPPER} -gt 8 ]]; then
  echo "Refusing invalid postcode length: ${POSTCODE}" >&2
  exit 1
fi
if [[ ! "$POSTCODE_UPPER" =~ ^[A-Z0-9]+$ ]]; then
  echo "Refusing invalid postcode characters: ${POSTCODE}" >&2
  exit 1
fi

CATEGORIES=(
  home utilities grants solar travel holidays food shopping money tech water waste carbon
)

echo "Seeding ${#CATEGORIES[@]} categories for ${POSTCODE} on ${HOST}" >&2
for cat in "${CATEGORIES[@]}"; do
  echo "--- category: ${cat} ---" >&2
  bash "${TRIGGER}" ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} "${HOST}" "${POSTCODE}" "${cat}" || exit 1
  sleep 3
done

echo "Done. Verify coverage:" >&2
echo "  curl -sS \"${HOST%/}/api/scrape-sync?postcode=${POSTCODE}\" | jq '.research_category_coverage | keys'" >&2
