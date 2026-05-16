#!/usr/bin/env bash
# Hermes / VPS manual pulse — same handshake as curl-scrape-sync-trigger.sh but accepts
# ?full=true&mode=trigger and body { "source": "manual-pulse" } (no scrapedData required).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/curl-scrape-sync-trigger.sh" "$@"
