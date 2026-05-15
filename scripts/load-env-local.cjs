/**
 * Shared with `next.config.js` — keep in sync with `scripts/load-env-local.ts` options.
 * `preferLocal: true` overwrites existing `process.env` keys when present in `.env.local`
 * (fixes stale exported DATABASE_URL masking the file during `next dev`).
 */
'use strict'

const fs = require('fs')
const path = require('path')

/**
 * @param {{ preferLocal?: boolean }} [options]
 */
function loadEnvLocal(options) {
  const preferLocal = options?.preferLocal === true
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).replace(/\\n/g, '\n')
    }
    if (preferLocal || process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

module.exports = { loadEnvLocal }
