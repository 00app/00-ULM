#!/usr/bin/env bash
# Promote newest Ready production deployment to www.00-00.online (bypass Staged + failed checks).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Vercel CLI does not always pick up VERCEL_TOKEN from env (e.g. in CI) — pass it explicitly when set.
# A personal account token defaults to the user's own scope, not the project's team, so pass
# --scope too or `vercel promote` fails with "Deployment belongs to a different team".
TOKEN_ARGS=()
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  TOKEN_ARGS+=(--token "$VERCEL_TOKEN")
fi
if [[ -n "${VERCEL_ORG_ID:-}" ]]; then
  TOKEN_ARGS+=(--scope "$VERCEL_ORG_ID")
fi
vercel() { command vercel "${TOKEN_ARGS[@]+"${TOKEN_ARGS[@]}"}" "$@"; }

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
  ls_out="$(vercel ls 00-ulm 2>&1)" || { echo "❌ vercel ls failed:" >&2; echo "$ls_out" >&2; exit 1; }
  URL="$(echo "$ls_out" | awk '/Production/ && /Ready/ {print $2; exit}')"
fi
if [[ -z "$URL" ]]; then
  URL="$(echo "${ls_out:-}" | grep -oE 'https://00-[a-z0-9]+-gary-lomi-lomicos-projects\.vercel\.app' | head -1)"
fi
if [[ -z "$URL" ]]; then
  echo "❌ No Ready production deployment found. Last \`vercel ls\` output:" >&2
  echo "${ls_out:-<empty>}" >&2
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
