#!/usr/bin/env bash
# Postcode stress test: long place names for profile/summary rhythmic outro + Solo Focus copy width.
# Usage: ./scripts/postcode-stress-session.sh [base_url]
# Example: ./scripts/postcode-stress-session.sh http://localhost:3080

set -euo pipefail
BASE="${1:-http://localhost:3000}"

echo "--- STARTING POSTCODE STRESS TEST ---"
echo "POST ${BASE}/api/session-state"

# Body matches app/api/session-state POST: { profile: { postcode } }
curl -sS -X POST "${BASE}/api/session-state" \
  -H "Content-Type: application/json" \
  -d '{"profile":{"postcode":"HU1 1AA"}}' \
  | head -c 200 || true
echo ""

curl -sS -X POST "${BASE}/api/session-state" \
  -H "Content-Type: application/json" \
  -d '{"profile":{"postcode":"NE1 1AD"}}' \
  | head -c 200 || true
echo ""

echo "--- Done. Open /profile/summary in the browser to verify word-at-a-time outro rhythm. ---"
