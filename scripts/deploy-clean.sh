#!/usr/bin/env bash
# Clean push + deploy: guard → commit check → push → prune stale failures → deploy → promote → smoke.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROD="${PROD_URL:-https://www.00-00.online}"

if [[ ! -f .vercel/project.json ]]; then
  echo "❌ Not linked. Run: vercel link  (project: 00-ulm)" >&2
  exit 1
fi

bash "${ROOT}/scripts/pre-deploy-guard.sh"

if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  echo "❌ Uncommitted changes — commit before deploy:clean." >&2
  git status --short >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if git rev-parse "@{u}" >/dev/null 2>&1; then
  AHEAD="$(git rev-list --count "@{u}..HEAD" 2>/dev/null || echo 0)"
  if [[ "${AHEAD}" -gt 0 ]]; then
    echo "→ Pushing ${AHEAD} commit(s) to origin/${BRANCH}…"
    git push origin "${BRANCH}"
  else
    echo "→ origin/${BRANCH} already up to date"
  fi
else
  echo "⚠ No upstream — pushing ${BRANCH} with -u…"
  git push -u origin "${BRANCH}"
fi

echo "→ Prune failed/stale Vercel deployments…"
bash "${ROOT}/scripts/vercel-prune-failed-deployments.sh" || true

# deploy-production runs remote build + promote (--skip-domain bypasses Staged checks).
bash "${ROOT}/scripts/deploy-production.sh" "$@"

echo "→ Production smoke…"
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
check "homepage" "${PROD}/" "200"
check "zone" "${PROD}/zone" "200"

if [[ "$fail" -ne 0 ]]; then
  echo "❌ Production smoke failed." >&2
  exit 1
fi

echo "✓ Clean deploy complete — ${PROD}"
