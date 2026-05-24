/**
 * Merge env vars from the current process into `.env.local` (gitignored).
 * Usage (paste values in shell only — never commit secrets):
 *   export DATABASE_URL='…' GEMINI_API_KEY='…' …
 *   node scripts/merge-env-local.mjs
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.join(import.meta.dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')

const MERGE_KEYS = [
  'DATABASE_URL',
  'GEMINI_API_KEY',
  'AI_GATEWAY_API_KEY',
  'VERCEL_AI_GATEWAY_API_KEY',
  'AI_GATEWAY',
  'VERCEL_OIDC_TOKEN',
  'FIRE_CRAWL_KEY_2',
  'FIRECRAWL_API_KEY',
  'CRON_SECRET',
  'SESSION_SECRET',
  'SCRAPER_SECRET',
  'GATEWAY_TOKEN',
  'ADMIN_PASSWORD',
  'ADMIN_BASIC_AUTH',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_DATA_VERSION',
]

function parseLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const eq = trimmed.indexOf('=')
  if (eq <= 0) return null
  const key = trimmed.slice(0, eq).trim()
  let val = trimmed.slice(eq + 1).trim()
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1)
  }
  return { key, val }
}

function loadMap() {
  const map = new Map()
  if (!fs.existsSync(ENV_PATH)) return map
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const parsed = parseLine(line)
    if (parsed) map.set(parsed.key, parsed.val)
  }
  return map
}

const map = loadMap()
let merged = 0
for (const key of MERGE_KEYS) {
  const val = process.env[key]?.trim()
  if (val) {
    map.set(key, val)
    merged++
  }
}

if (merged === 0) {
  console.error('❌ No env vars set. Export DATABASE_URL, GEMINI_API_KEY, etc., then re-run.')
  process.exit(1)
}

const lines = []
for (const [key, val] of map.entries()) {
  const needsQuote = /[\s#"'\\]/.test(val)
  lines.push(needsQuote ? `${key}="${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : `${key}=${val}`)
}

fs.writeFileSync(ENV_PATH, `${lines.join('\n')}\n`, 'utf8')
console.log(`✅ Updated .env.local (${merged} keys merged, ${map.size} total)`)
