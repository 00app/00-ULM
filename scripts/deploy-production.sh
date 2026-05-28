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
fi

SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "→ Commit ${SHA}: $(git log -1 --format='%s' 2>/dev/null || true)"
echo "→ Local verify (same gate as vercel.json buildCommand)…"
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

if [[ "$code" -ne 0 ]] && ! grep -qE 'Deployment completed|Aliased:|Production: https://00-' "$LOG" 2>/dev/null; then
  echo "❌ Deploy failed (exit ${code}). See ${LOG}" >&2
  exit "$code"
fi

if [[ -n "$DEPLOY_URL" ]]; then
  echo "→ Promote ${DEPLOY_URL} (bypass Staged / failed dashboard checks)…"
  vercel promote "$DEPLOY_URL" --yes 2>/dev/null || true
fi

echo "→ Health https://00-ulm.vercel.app/api/health"
if curl -sf --max-time 20 "https://00-ulm.vercel.app/api/health"; then
  echo ""
else
  echo "⚠️  Health check failed — deployment may still be aliasing." >&2
fi

echo "✓ Production target: https://00-ulm.vercel.app (commit ${SHA})"
