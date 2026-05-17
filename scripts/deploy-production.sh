#!/usr/bin/env bash
# Production deploy — single repo root, explicit `vercel deploy` (avoids "Can't deploy more than one path").
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

LOG="${ROOT}/vercel-deploy.log"
set +e
if ((${#FORCE[@]})); then
  vercel deploy --prod --yes "${FORCE[@]}" "$ROOT" 2>&1 | tee "$LOG"
else
  vercel deploy --prod --yes "$ROOT" 2>&1 | tee "$LOG"
fi
code=${PIPESTATUS[0]}
set -e

if [[ "$code" -eq 0 ]]; then
  exit 0
fi

if grep -q 'Deployment completed' "$LOG" 2>/dev/null; then
  echo "" >&2
  echo "⚠️  Vercel CLI exited $code after build finished (often ETIMEDOUT on Completing…)." >&2
  echo "   Open the deployment URL in the log above — build likely succeeded." >&2
  echo "   If dashboard shows Checks Failed, point Deployment Checks at GET /api/health?live=1 (not scrape-sync)." >&2
  exit 0
fi

exit "$code"
