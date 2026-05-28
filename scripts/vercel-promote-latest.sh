#!/usr/bin/env bash
# Promote newest Ready production deployment to 00-ulm.vercel.app (bypass Staged + failed checks).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

URL="${1:-}"
if [[ -z "$URL" ]]; then
  URL="$(vercel ls 00-ulm --prod 2>/dev/null | awk '/Ready/ {print $2; exit}')"
fi
if [[ -z "$URL" ]]; then
  echo "❌ No Ready production deployment found." >&2
  exit 1
fi

echo "→ Promote ${URL} to production…"
vercel promote "$URL" --yes

echo "→ Health"
curl -sf --max-time 25 "https://00-ulm.vercel.app/api/health?live=1" && echo ""
curl -sf --max-time 25 "https://00-ulm.vercel.app/api/health" && echo ""
