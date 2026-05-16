#!/usr/bin/env bash
# Sync Production env on Vercel from the current shell (values never echoed).
# Usage:
#   export DATABASE_URL='…' GEMINI_API_KEY='…' FIRE_CRAWL_KEY_2='…' CRON_SECRET='…' ADMIN_AUTH_HEADER='…'
#   bash scripts/vercel-sync-production-env.sh
# Then: vercel --prod --force
set -euo pipefail
cd "$(dirname "$0")/.."

add_or_replace() {
  local name="$1"
  local val="${!name:-}"
  if [[ -z "$val" ]]; then
    echo "  skip $name (unset)"
    return 0
  fi
  printf '%s' "$val" | vercel env add "$name" production --force --sensitive
  echo "  ok $name"
}

echo "== Vercel Production env (00-ulm) =="
add_or_replace DATABASE_URL
add_or_replace GEMINI_API_KEY
add_or_replace AI_GATEWAY_API_KEY
add_or_replace VERCEL_AI_GATEWAY_API_KEY
add_or_replace FIRE_CRAWL_KEY_2
add_or_replace CRON_SECRET
add_or_replace SCRAPER_SECRET
add_or_replace ADMIN_AUTH_HEADER
add_or_replace GATEWAY_TOKEN
echo "Done. Redeploy: vercel --prod --force"
