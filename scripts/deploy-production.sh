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

exec vercel deploy --prod --yes "${FORCE[@]}" "$ROOT"
