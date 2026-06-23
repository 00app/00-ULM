#!/usr/bin/env bash
# Print (or install) a crontab line for Hermes → Vercel zone-research.
# Do NOT paste cron syntax into zsh — cron only runs via `crontab -e` or this script.
#
# Usage:
#   bash scripts/install-hermes-crontab.sh              # print line for your machine
#   bash scripts/install-hermes-crontab.sh --install    # append to user crontab (Mac or Linux)
#   bash scripts/install-hermes-crontab.sh --install --schedule "0 5 * * 1"  # weekly (default)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PULSE="${ROOT}/scripts/hermes-pulse.sh"
INSTALL=0
SCHEDULE="0 5 * * 1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install) INSTALL=1; shift ;;
    --schedule) SCHEDULE="${2:-0 5 * * *}"; shift 2 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

# Default secret file (create with: mkdir -p ~/.hermes && chmod 700 ~/.hermes)
SECRET="${HOME}/.hermes/cron.secret"
LOG="${HOME}/hermes-pulse.log"

# Expand to absolute paths
PULSE="$(cd "$(dirname "$PULSE")" && pwd)/$(basename "$PULSE")"

LINE="${SCHEDULE} /usr/bin/bash ${PULSE} --secret-file=${SECRET} --repair-only >> ${LOG} 2>&1"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Hermes crontab (one line)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Secret file (create once, chmod 600):"
echo "    ${SECRET}"
echo ""
echo "  Log file:"
echo "    ${LOG}"
echo ""
echo "  Crontab entry:"
echo "    ${LINE}"
echo ""
echo "  Test pulse now (no cron):"
echo "    bash scripts/hermes-pulse.sh --secret-file ${SECRET} --auth-only"
echo ""
echo "  Manual install:"
echo "    crontab -e"
echo "    # paste the line above"
echo ""

if [[ ! -f "$SECRET" ]]; then
  echo "  ⚠ Secret file missing. Create it (same value as Vercel CRON_SECRET):" >&2
  echo "    mkdir -p ~/.hermes && chmod 700 ~/.hermes" >&2
  echo "    printf '%s' 'YOUR_SECRET' > ${SECRET} && chmod 600 ${SECRET}" >&2
  echo "" >&2
fi

if [[ "$INSTALL" -eq 0 ]]; then
  exit 0
fi

if [[ ! -x "$PULSE" ]]; then
  chmod +x "$PULSE"
fi

MARKER="# 00-00 hermes-pulse"
TMP="$(mktemp)"
( crontab -l 2>/dev/null \
  | grep -v "$MARKER" \
  | grep -v "hermes-pulse.sh" \
  | grep -v "00-ulm.vercel.app" \
  || true
  echo "$MARKER"
  echo "$LINE"
) > "$TMP"
crontab "$TMP"
rm -f "$TMP"
echo "✓ Installed in user crontab. Verify: crontab -l"
echo "  Log will append to: ${LOG}"
