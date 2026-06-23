#!/usr/bin/env bash
# Pull Production env from Vercel into .env.local (gitignored). Never prints secret values.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PULL_FILE="${PULL_FILE:-.env.vercel.pull}"
ENV_TARGET="${ENV_TARGET:-production}"

echo "→ vercel env pull ${PULL_FILE} (--environment=${ENV_TARGET})"
vercel env pull "${PULL_FILE}" --environment="${ENV_TARGET}" --yes

echo "→ merge into .env.local"
node scripts/merge-vercel-pull-into-local.mjs "${PULL_FILE}"

echo ""
echo "✓ Local dev env synced. Restart: npm run dev"
echo ""
echo "If Turnstile/Twilio keys show as empty in pull, paste them into .env.local manually"
echo "(Vercel CLI does not return secret values). Production runtime still uses dashboard values."
