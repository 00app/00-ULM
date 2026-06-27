#!/usr/bin/env bash
# Blocks deploy when native Vercel check script names exist or verify fails.
# Same gate as vercel-build-gate.mjs — run before every push/deploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Pre-deploy guard (native check names + verify)…"
npm run fix:vercel-checks
npm run verify
echo "✓ Pre-deploy guard passed"
