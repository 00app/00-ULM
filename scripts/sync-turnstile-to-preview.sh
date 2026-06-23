#!/usr/bin/env bash
# Ensure Turnstile keys exist on Preview (Vercel CLI cannot read secret values back — use dashboard or paste).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ Checking Preview env for Turnstile keys"
LIST="$(vercel env list preview 2>&1 || true)"
has_site=0
has_secret=0
echo "$LIST" | grep -q 'NEXT_PUBLIC_TURNSTILE_SITE_KEY' && has_site=1 || true
echo "$LIST" | grep -q 'TURNSTILE_SECRET_KEY' && has_secret=1 || true

if [[ "$has_site" == 1 && "$has_secret" == 1 ]]; then
  echo "✓ Turnstile keys already listed on Preview."
  exit 0
fi

echo ""
echo "Preview is missing Turnstile keys. Vercel does not export secret values via CLI."
echo "Do one of the following:"
echo ""
echo "  A) Vercel Dashboard (fastest)"
echo "     Project → Settings → Environment Variables"
echo "     For NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY (Production):"
echo "     ⋯ menu → Add to Preview → Save → Redeploy preview"
echo ""
echo "  B) CLI paste (same values as Production / Cloudflare)"
echo "     printf '%s' 'YOUR_SITE_KEY' | vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY preview --force"
echo "     printf '%s' 'YOUR_SECRET'   | vercel env add TURNSTILE_SECRET_KEY preview --force"
echo ""
exit 1
