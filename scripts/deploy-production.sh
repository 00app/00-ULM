#!/usr/bin/env bash
# Production deploy — verify locally, remote build on Vercel (never stale prebuilt), auto-promote.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .vercel/project.json ]]; then
  echo "❌ Not linked. Run: vercel link  (project: 00-ulm)" >&2
  exit 1
fi

FORCE=()
if [[ "${1:-}" == "--force" ]]; then
  FORCE=(--force)
  echo "→ --force: skipping Vercel build cache (CLI) — also set VERCEL_FORCE_NO_BUILD_CACHE=1 in Project Settings if checks stay red."
  export VERCEL_FORCE_NO_BUILD_CACHE=1
fi

SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "→ Commit ${SHA}: $(git log -1 --format='%s' 2>/dev/null || true)"

if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  echo "❌ Working tree has uncommitted changes — commit before deploy (verify only runs on committed code)." >&2
  git status --short >&2
  exit 1
fi

echo "→ Guard: native Vercel lint/typecheck script names must stay disabled…"
npm run fix:vercel-checks

echo "→ Local verify (typecheck + lint — also runs at start of vercel.json buildCommand)…"
npm run verify

# Never upload stale .vercel/output — remote build runs install + verify + next build.
rm -rf .vercel/output

LOG="${ROOT}/vercel-deploy.log"
echo "→ Remote production build on Vercel (no --prebuilt)…"
set +e
if [[ ${#FORCE[@]} -gt 0 ]]; then
  vercel deploy --prod --yes "${FORCE[@]}" "$ROOT" 2>&1 | tee "$LOG"
else
  vercel deploy --prod --yes "$ROOT" 2>&1 | tee "$LOG"
fi
code=${PIPESTATUS[0]}
set -e

DEPLOY_URL="$(grep -oE 'https://00-[a-z0-9]+-gary-lomi-lomicos-projects\.vercel\.app' "$LOG" | tail -1 || true)"
if [[ -z "$DEPLOY_URL" ]]; then
  DEPLOY_URL="$(grep -oE 'Production: https://[^ ]+' "$LOG" | tail -1 | sed 's/^Production: //' || true)"
fi

if [[ "$code" -ne 0 ]] && ! grep -qE 'Deployment completed|Aliased:|Production: https://00-' "$LOG" 2>/dev/null; then
  echo "❌ Deploy failed (exit ${code}). See ${LOG}" >&2
  exit "$code"
fi

if [[ -n "$DEPLOY_URL" ]]; then
  echo "→ Waiting for ${DEPLOY_URL} to be Ready…"
  for _ in $(seq 1 36); do
    if vercel inspect "$DEPLOY_URL" 2>/dev/null | grep -qiE 'status\s+●\s+Ready|status\s+Ready'; then
      break
    fi
    sleep 5
  done
fi

bash "${ROOT}/scripts/vercel-promote-latest.sh" "${DEPLOY_URL:-}"

echo "→ Health https://www.00-00.online/api/health"
if curl -sf --max-time 20 "https://www.00-00.online/api/health"; then
  echo ""
else
  echo "⚠️  Health check failed — deployment may still be aliasing." >&2
fi

echo "✓ Production target: https://www.00-00.online (commit ${SHA})"
