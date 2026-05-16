#!/usr/bin/env bash
# Clear-path prep: verify Neon, sync journey_questions, production build.
# Browser: hard-refresh Zone after deploy — DATA_VERSION 2026-12 clears stale localStorage.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 00-00 — prep (Neon + build)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Browser (before testing Zone):"
echo "  • DevTools → Application → Local Storage → clear site data for 127.0.0.1:3000"
echo "  • Or complete profile again — DATA_VERSION 2026-12 resets journey cache on load"
echo ""

if [[ ! -f .env.local ]]; then
  echo "❌ Missing .env.local — cp .env.example .env.example && fill DATABASE_URL, GEMINI_API_KEY, FIRE_CRAWL_KEY_2, CRON_SECRET"
  exit 1
fi

echo "== Neon + journey_questions =="
npm run db:test
npm run db:evolve-12-domains
echo ""

echo "== Production build =="
npm run build:clean
echo ""
echo "✅ Prep complete. Next: npm run deploy:force"
echo "   (uses: vercel deploy --prod from repo root — not 'vercel --prod', which can mis-parse paths)"
