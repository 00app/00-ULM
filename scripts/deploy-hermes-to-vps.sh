#!/usr/bin/env bash
# Push Hermes pulse scripts + CRON_SECRET to Oracle VPS and verify auth.
#
# Usage (from repo root on Mac):
#   bash scripts/deploy-hermes-to-vps.sh
#   SSH_KEY=~/Downloads/ssh-key-2026-05-08.key bash scripts/deploy-hermes-to-vps.sh
#
# Requires: .env.production.local with CRON_SECRET (or .env.local)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SSH_KEY="${SSH_KEY:-$HOME/Downloads/ssh-key-2026-05-08.key}"
SSH_HOST="${SSH_HOST:-ubuntu@140.238.100.237}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/00-00}"
ENV_FILE="${ENV_FILE:-.env.production.local}"

zz_read_env_var() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  local line raw
  line="$(grep "^${key}=" "$file" 2>/dev/null | head -1)" || return 1
  [[ -z "$line" ]] && return 1
  raw="${line#${key}=}"
  raw="${raw%$'\r'}"
  if [[ ${#raw} -ge 2 && "${raw:0:1}" == '"' && "${raw: -1}" == '"' ]]; then raw="${raw:1:${#raw}-2}"; fi
  if [[ ${#raw} -ge 2 && "${raw:0:1}" == "'" && "${raw: -1}" == "'" ]]; then raw="${raw:1:${#raw}-2}"; fi
  if [[ "${raw: -2}" == $'\\n' ]]; then raw="${raw:0:${#raw}-2}"; fi
  printf '%s' "$raw"
}

if [[ ! -f "$SSH_KEY" ]]; then
  echo "✗ SSH key not found: $SSH_KEY" >&2
  echo "  Set SSH_KEY=... or place key at ~/Downloads/ssh-key-2026-05-08.key" >&2
  exit 1
fi

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)

CRON_SECRET=""
for f in "$ENV_FILE" .env.production.local .env.local; do
  [[ -f "$f" ]] || continue
  CRON_SECRET="$(zz_read_env_var "$f" CRON_SECRET || true)"
  [[ -n "$CRON_SECRET" ]] && break
done

if [[ ${#CRON_SECRET} -lt 16 ]]; then
  echo "✗ CRON_SECRET not found (≥16 chars) in $ENV_FILE / .env.production.local / .env.local" >&2
  exit 1
fi

echo "→ Deploy Hermes to ${SSH_HOST}"
echo "  remote: ${REMOTE_DIR}/scripts/"
echo "  secret: ~/.hermes/cron.secret (from ${ENV_FILE:-env file}, not printed)"
echo ""

ssh "${SSH_OPTS[@]}" "$SSH_HOST" "mkdir -p ${REMOTE_DIR}/scripts ~/.hermes && chmod 700 ~/.hermes"

rsync -avz -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=accept-new" \
  "${ROOT}/scripts/hermes-pulse.sh" \
  "${ROOT}/scripts/hermes-lifestyle-shift.sh" \
  "${ROOT}/scripts/install-hermes-crontab.sh" \
  "${ROOT}/scripts/setup-hermes-vps.sh" \
  "${SSH_HOST}:${REMOTE_DIR}/scripts/"

printf '%s' "$CRON_SECRET" | ssh "${SSH_OPTS[@]}" "$SSH_HOST" \
  'cat > ~/.hermes/cron.secret && chmod 600 ~/.hermes/cron.secret'

ssh "${SSH_OPTS[@]}" "$SSH_HOST" "chmod +x ${REMOTE_DIR}/scripts/hermes-pulse.sh ${REMOTE_DIR}/scripts/hermes-lifestyle-shift.sh ${REMOTE_DIR}/scripts/*.sh"

echo ""
echo "→ Remote auth test"
ssh "${SSH_OPTS[@]}" "$SSH_HOST" \
  "/usr/bin/bash ${REMOTE_DIR}/scripts/hermes-pulse.sh --secret-file=/home/ubuntu/.hermes/cron.secret --auth-only"

echo ""
echo "→ Crontab (dedupe + install canonical line)"
ssh "${SSH_OPTS[@]}" "$SSH_HOST" \
  "REMOTE_DIR='${REMOTE_DIR}' bash ${REMOTE_DIR}/scripts/install-hermes-crontab.sh --install"

echo ""
echo "✓ Deploy complete. On VPS: tail -f ~/hermes-pulse.log after 05:00 UTC or run --smoke manually."
