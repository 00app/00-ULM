#!/usr/bin/env bash
# Clean verify → build → deploy → promote → production smoke (no surprise 401s on public routes).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROD="${PROD_URL:-https://www.00-00.online}"

echo "→ Purge local build artifacts…"
npm run purge:disk >/dev/null 2>&1 || rm -rf .next node_modules/.cache

echo "→ verify (typecheck + lint + mechanical-truth)…"
npm run verify

echo "→ production build gate (same as Vercel buildCommand)…"
node scripts/vercel-build-gate.mjs

if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  echo "❌ Uncommitted changes — commit before deploy." >&2
  git status --short >&2
  exit 1
fi

echo "→ Prune failed/stale production deployments (keep latest Ready)…"
if command -v vercel >/dev/null 2>&1; then
  bash "${ROOT}/scripts/vercel-prune-failed-deployments.sh" || true
fi

echo "→ Deploy to Vercel production…"
bash "${ROOT}/scripts/deploy-production.sh"

echo "→ Production smoke (public routes must not 401)…"
fail=0
check() {
  local label="$1" url="$2" expect="$3"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url" || echo 000)"
  if [[ "$code" != "$expect" ]]; then
    echo "  ✗ $label — HTTP $code (expected $expect)" >&2
    fail=1
  else
    echo "  ✓ $label — HTTP $code"
  fi
}

check "health live" "${PROD}/api/health?live=1" "200"
check "health db" "${PROD}/api/health" "200"
check "health diagnostics (public)" "${PROD}/api/health/diagnostics" "200"
check "homepage" "${PROD}/" "200"
check "zone" "${PROD}/zone" "200"

if [[ "$fail" -ne 0 ]]; then
  echo "❌ Production smoke failed." >&2
  exit 1
fi

echo "✓ Green deploy complete — ${PROD}"
