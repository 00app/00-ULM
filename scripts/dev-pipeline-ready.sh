#!/usr/bin/env bash
# Local dev: verify env keys, probe health, optionally seed all 13 categories.
#
# Usage:
#   bash scripts/dev-pipeline-ready.sh
#   bash scripts/dev-pipeline-ready.sh --seed SW1A1AA
#   bash scripts/dev-pipeline-ready.sh --seed SW1A1AA --host http://127.0.0.1:3000
#
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SEED_POSTCODE=""
HOST="http://127.0.0.1:3000"
ENV_FILE=".env.local"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed)
      SEED_POSTCODE="${2:-}"
      shift 2
      ;;
    --host)
      HOST="${2:-http://127.0.0.1:3000}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-.env.local}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 00-ULM — dev pipeline ready"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ""
  echo "Missing ${ENV_FILE}. Run:"
  echo "  vercel link --repo --yes --project 00-ulm"
  echo "  vercel pull --yes --environment=production"
  echo "  cp .vercel/.env.production.local .env.local"
  echo "  npm run env:merge   # optional merge helper"
  exit 1
fi

echo ""
echo "== Typecheck + lint =="
npm run verify

echo ""
echo "== Env + health =="
bash scripts/verify-env-and-health.sh

echo ""
echo "== Dev server probe (${HOST}) =="
code="$(curl -sS -o /dev/null -w '%{http_code}' "${HOST%/}/api/health" 2>/dev/null || echo 000)"
if [[ "$code" == "200" ]]; then
  echo "  /api/health: OK (${code})"
elif [[ "$code" == "503" ]]; then
  echo "  /api/health: 503 — DATABASE_URL missing or Neon unreachable; fix .env.local and restart dev."
else
  echo "  /api/health: ${code} — start dev: npm run dev:3000"
fi

if [[ -n "$SEED_POSTCODE" ]]; then
  echo ""
  echo "== Seeding 13 categories (Firecrawl + Gemini via scrape-sync) =="
  bash scripts/seed-zone-research-all.sh --env-file "$ENV_FILE" "$HOST" "$SEED_POSTCODE"
fi

echo ""
echo "== Next steps =="
echo "  1. npm run dev:3000"
echo "  2. Complete /profile with your postcode (never hardcode in app code)."
echo "  3. Open /zone — localhost auto-bootstraps unsettled categories (see NEXT_PUBLIC_ZONE_DEV_BOOTSTRAP)."
echo "  4. Or: bash scripts/dev-pipeline-ready.sh --seed YOURPOSTCODE"
echo "  5. Hermes smoke: npm run hermes:pulse"
echo ""
