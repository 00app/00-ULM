#!/usr/bin/env bash
# Smoke-test all 00-00 API routes — status + one-line purpose (no secrets printed).
# Usage: bash scripts/api-smoke-all.sh [BASE_URL]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE="${1:-http://127.0.0.1:3000}"
POSTCODE="${SMOKE_POSTCODE:-HD45XD}"
CRON_SECRET="$(grep '^CRON_SECRET=' .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)"
CRON_SECRET="${CRON_SECRET//$'\r'/}"

jq_or_cat() {
  if command -v jq >/dev/null 2>&1; then jq -c "$@" 2>/dev/null || cat; else head -c 200; fi
}

probe() {
  local method="$1" path="$2" body="${3:-}" auth="${4:-0}"
  local tmp code
  tmp="$(mktemp)"
  local curl_args=(-sS -o "$tmp" -w '%{http_code}' --max-time "${SMOKE_TIMEOUT:-45}")
  if [[ "$auth" == "1" && -n "$CRON_SECRET" ]]; then
    curl_args+=(-H "Authorization: Bearer ${CRON_SECRET}")
  fi
  if [[ "$method" == "GET" ]]; then
    code="$(curl "${curl_args[@]}" "${BASE}${path}" 2>/dev/null || echo 000)"
  else
    code="$(curl "${curl_args[@]}" -X "$method" -H 'Content-Type: application/json' -d "$body" "${BASE}${path}" 2>/dev/null || echo 000)"
  fi
  local hint
  hint="$(jq_or_cat '{status,error,source,database,probe,answers:(.answers|keys?),coverage:(.research_category_coverage|keys?)}' <"$tmp" 2>/dev/null || head -c 80 <"$tmp")"
  printf '%-6s %-42s %s  %s\n' "$code" "$method $path" "$hint"
  rm -f "$tmp"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 00-00 API smoke — BASE_URL=$BASE  postcode=$POSTCODE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf '%-6s %-42s %s\n' "HTTP" "ROUTE" "SNAPSHOT"
echo "────────────────────────────────────────────────────────────"

# --- Health & infra ---
probe GET "/api/health?live=1"
probe GET "/api/health"
probe GET "/api/health/diagnostics" "" 1

# --- Session / profile ---
probe GET "/api/session-state"
probe POST "/api/session-state" '{"profile":{"postcode":"'"$POSTCODE"'","name":"Smoke"},"journey_answers":{},"completed_journeys":[]}'
probe GET "/api/user"
probe POST "/api/user" '{"postcode":"'"$POSTCODE"'","name":"Smoke"}'
probe GET "/api/summary?type=profile"
probe GET "/api/summary?type=zone"

# --- Zone intelligence loop ---
probe GET "/api/scrape-sync?postcode=${POSTCODE}"
probe GET "/api/local-intelligence?postcode=${POSTCODE}"
probe GET "/api/geocode/postcode?postcode=${POSTCODE}"
probe GET "/api/pulse/living?postcode=${POSTCODE}"
probe GET "/api/zone/injections"
probe GET "/api/likes"
probe GET "/api/answers"
probe GET "/api/cards"
probe GET "/api/brain"
probe GET "/api/actioned"

# --- Zone mutations (light bodies) ---
probe POST "/api/zone/visit" '{"card_id":"journey-home","journey_key":"home","title":"Smoke"}'
probe POST "/api/discovery/pulse" '{"card_ids":["inject-smoke-1"]}'
probe POST "/api/sentinel" '{"postcode":"'"$POSTCODE"'","journeyAnswers":{}}'
probe POST "/api/likes/track" '{"card_id":"journey-home","title":"Home","money_gbp":0}'

# --- Auth (expect 400/401 without real creds) ---
probe POST "/api/auth/login" '{"email":"smoke@test.local","password":"smoke"}'
probe GET "/api/auth/me"
probe POST "/api/auth/logout" "{}"

# --- Cron / admin (Bearer) ---
probe GET "/api/cron/zone-research?limit=0" "" 1
probe GET "/api/cron/repair-mechanical?limit=1" "" 1
probe GET "/api/admin/pulse" "" 1

# --- Heavy / optional (skip by default) ---
if [[ "${SMOKE_HEAVY:-0}" == "1" ]]; then
  echo "── heavy (GEMINI / Firecrawl) ──"
  probe POST "/api/zone/content-architect" '{"cards":[]}'
  probe POST "/api/zone/tips-refresh" "{}"
  SMOKE_TIMEOUT=120 probe POST "/api/scrape-sync?postcode=${POSTCODE}&force=true" "{}"
fi

echo "────────────────────────────────────────────────────────────"
echo "Done. Set SMOKE_HEAVY=1 to include content-architect / tips-refresh / POST scrape-sync."
echo "401 on /api/answers = no session cookie (expected in curl)."
