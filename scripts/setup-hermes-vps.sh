#!/usr/bin/env bash
# One-time Hermes setup on Oracle VPS (ubuntu@zerozero-auditor).
# Run ON the server after the repo exists (git clone or rsync).
#
# From your Mac (sync scripts only):
#   rsync -avz -e "ssh -i ~/Downloads/ssh-key-2026-05-08.key" \
#     scripts/hermes-pulse.sh scripts/install-hermes-crontab.sh \
#     ubuntu@140.238.100.237:~/00-00/scripts/
#
# On VPS:
#   cd ~/00-00 && bash scripts/setup-hermes-vps.sh
#   bash scripts/setup-hermes-vps.sh --install-cron
set -euo pipefail

INSTALL_CRON=0
REPO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-cron) INSTALL_CRON=1; shift ;;
    --repo) REPO="${2:-}"; shift 2 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$REPO" ]]; then
  for d in "${HOME}/00-00" "${HOME}/00-ULM" "${HOME}/Documents/00-00"; do
    if [[ -f "${d}/scripts/hermes-pulse.sh" ]]; then
      REPO="$d"
      break
    fi
  done
fi

if [[ -z "$REPO" || ! -f "${REPO}/scripts/hermes-pulse.sh" ]]; then
  echo "✗ Repo not found. Clone on VPS first:" >&2
  echo "  git clone https://github.com/00app/00-ULM.git ~/00-00" >&2
  echo "  cd ~/00-00 && bash scripts/setup-hermes-vps.sh --install-cron" >&2
  exit 1
fi

SECRET="${HOME}/.hermes/cron.secret"
LOG="${HOME}/hermes-pulse.log"

echo "→ Hermes VPS setup"
echo "  repo: ${REPO}"
echo "  secret: ${SECRET}"
echo "  log: ${LOG}"
echo ""

mkdir -p "${HOME}/.hermes"
chmod 700 "${HOME}/.hermes"

if [[ ! -f "$SECRET" ]]; then
  echo "Create ${SECRET} with the SAME value as Vercel Production CRON_SECRET."
  echo "Paste secret (input hidden), then Enter:"
  read -r -s -p "> " _secret
  echo ""
  if [[ ${#_secret} -lt 16 ]]; then
    echo "✗ Secret must be at least 16 characters." >&2
    exit 1
  fi
  printf '%s' "$_secret" > "$SECRET"
  chmod 600 "$SECRET"
  unset _secret
  echo "✓ Wrote ${SECRET}"
else
  echo "✓ Secret file already exists (${SECRET})"
fi

chmod +x "${REPO}/scripts/hermes-pulse.sh" "${REPO}/scripts/install-hermes-crontab.sh" 2>/dev/null || true

echo ""
echo "→ Test bridge (auth only, ~2s)"
bash "${REPO}/scripts/hermes-pulse.sh" --secret-file "$SECRET" --auth-only

if [[ "$INSTALL_CRON" -eq 1 ]]; then
  echo ""
  echo "→ Install user crontab (05:00 UTC daily)"
  bash "${REPO}/scripts/install-hermes-crontab.sh" --install
  echo ""
  echo "Active crontab:"
  crontab -l | grep -v '^#' | grep -v '^$' || echo "  (no non-comment lines — check crontab -l)"
fi

echo ""
echo "Done. After first cron run, tail log:"
echo "  tail -f ${LOG}"
