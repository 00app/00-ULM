#!/usr/bin/env bash
# Promote newest Ready production deployment to www.00-00.online (bypass Staged + failed checks).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

URL="${1:-}"
if [[ -n "$URL" ]]; then
  echo "→ Waiting for ${URL} to reach Ready…"
  for _ in $(seq 1 72); do
    state="$(vercel inspect "$URL" --json 2>/dev/null | node -e "
      let s=''; process.stdin.on('data',d=>s+=d);
      process.stdin.on('end',()=>{ try {
        const j=JSON.parse(s.replace(/^[^\\{]*/,''));
        process.stdout.write(String(j.readyState||''));
      } catch { process.stdout.write(''); } });
    " 2>/dev/null || true)"
    if [[ "$state" == "READY" ]]; then
      break
    fi
    sleep 5
  done
fi
if [[ -z "$URL" ]]; then
  URL="$(vercel ls 00-ulm 2>/dev/null | awk '/Production/ && /Ready/ {print $2; exit}')"
fi
if [[ -z "$URL" ]]; then
  URL="$(vercel ls 00-ulm 2>/dev/null | grep -oE 'https://00-[a-z0-9]+-gary-lomi-lomicos-projects\.vercel\.app' | head -1)"
fi
if [[ -z "$URL" ]]; then
  echo "❌ No Ready production deployment found." >&2
  exit 1
fi

echo "→ Promote ${URL} to production…"
set +e
promote_out="$(vercel promote "$URL" --yes 2>&1)"
promote_code=$?
set -e
if [[ "$promote_code" -ne 0 ]]; then
  if echo "$promote_out" | grep -qiE 'already the current production|409'; then
    echo "✓ Already on production (promote skipped)."
  else
    echo "$promote_out" >&2
    exit "$promote_code"
  fi
fi

echo "→ Health"
curl -sf --max-time 25 "https://www.00-00.online/api/health?live=1" && echo ""
curl -sf --max-time 25 "https://www.00-00.online/api/health" && echo ""
