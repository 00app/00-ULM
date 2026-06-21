#!/usr/bin/env bash
# Remove Error/Canceled production deployments so the dashboard isn't cluttered with stale failures.
# Keeps the newest Ready deployment and any in-progress build.
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "⚠️  vercel CLI not found — skip prune"
  exit 0
fi

if [[ ! -f .vercel/project.json ]]; then
  echo "⚠️  Not linked to Vercel — skip prune"
  exit 0
fi

echo "→ Listing recent production deployments…"
list="$(vercel ls 00-ulm --prod 2>/dev/null || vercel ls --prod 2>/dev/null || true)"
if [[ -z "$list" ]]; then
  echo "  (no deployments listed)"
  exit 0
fi

removed=0
while IFS= read -r url; do
  [[ -z "$url" ]] && continue
  state="$(vercel inspect "$url" --json 2>/dev/null | node -e "
    let s=''; process.stdin.on('data',d=>s+=d);
    process.stdin.on('end',()=>{ try {
      const j=JSON.parse(s.replace(/^[^\\{]*/,''));
      process.stdout.write(String(j.readyState||j.state||''));
    } catch { process.stdout.write(''); } });
  " 2>/dev/null || true)"
  case "$state" in
    READY|BUILDING|QUEUED|INITIALIZING) continue ;;
  esac
  echo "  removing $url ($state)"
  if vercel remove "$url" --yes 2>/dev/null; then
    removed=$((removed + 1))
  fi
done < <(echo "$list" | grep -oE 'https://00-[^[:space:]]+' | head -20)

echo "→ Pruned ${removed} failed/stale deployment(s)"
