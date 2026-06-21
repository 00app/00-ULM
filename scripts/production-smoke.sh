#!/usr/bin/env bash
# Production / preview smoke — critical pages + APIs (no secrets printed).
# Usage: bash scripts/production-smoke.sh [BASE_URL]
set -euo pipefail
BASE="${1:-https://www.00-00.online}"
POSTCODE="${SMOKE_POSTCODE:-BN177DW}"

fail=0
check() {
  local expect="$1" path="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "${BASE}${path}" 2>/dev/null || echo 000)"
  if [[ "$code" != "$expect" ]]; then
    echo "✗ $code (expected $expect)  $path"
    fail=1
  else
    echo "✓ $code  $path"
  fi
}

echo "━━━ Production smoke → $BASE ━━━"
check 200 "/"
check 200 "/zone"
check 200 "/profile"
check 200 "/api/health?live=1"
check 200 "/api/session-state"
check 200 "/api/user"
check 200 "/api/scrape-sync"
check 200 "/api/summary"
check 200 "/api/local-intelligence?postcode=${POSTCODE}"
check 200 "/api/pulse/living?postcode=${POSTCODE}"
check 200 "/assets/Marvin%20Visions%20Bold.ttf"

# Expected client-error when params missing (must not be 500)
check 400 "/api/pulse/living"
check 400 "/api/local-intelligence"

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "✓ Production smoke passed"
else
  echo "✗ Production smoke failed — fix before promoting"
  exit 1
fi
