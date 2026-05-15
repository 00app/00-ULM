#!/usr/bin/env bash
# Trigger POST /api/scrape-sync (force + postcode) without zsh mangling Bearer tokens containing `!`.
# Run under bash explicitly: SCRAPER_SECRET='your>=16-char-secret' bash scripts/curl-scrape-sync-trigger.sh
#
# Auth matches Vercel env SCRAPER_SECRET or CRON_SECRET (see app/api/scrape-sync/route.ts).
# Firecrawl is separate (FIRE_CRAWL_KEY_2 or FIRECRAWL_API_KEY) — only checked after auth passes.
set -euo pipefail
HOST="${1:-${NEXT_PUBLIC_APP_URL:-https://00-ulm.vercel.app}}"
POSTCODE="${2:-M11AG}"
TOKEN="${SCRAPER_SECRET:-}"
if [[ -z "${TOKEN}" && -n "${CRON_SECRET:-}" ]]; then TOKEN="${CRON_SECRET}"; fi
if [[ -z "${TOKEN}" ]]; then
  echo "Missing SCRAPER_SECRET or CRON_SECRET (same value Bearer uses; minimum 16 characters on Vercel)." >&2
  echo "Usage: SCRAPER_SECRET='…' bash scripts/curl-scrape-sync-trigger.sh [https://YOUR.vercel.app] [POSTCODE]" >&2
  exit 1
fi
curl -sS -i -X POST "${HOST%/}/api/scrape-sync?postcode=${POSTCODE}&force=true" \
  -H "Authorization: Bearer ${TOKEN}"
