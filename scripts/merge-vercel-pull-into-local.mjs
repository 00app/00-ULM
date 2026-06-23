/**
 * Merge selected keys from `vercel env pull` output into `.env.local` (never commits secrets).
 *
 *   vercel env pull .env.vercel.pull --environment=production --yes
 *   node scripts/merge-vercel-pull-into-local.mjs
 *   node scripts/merge-vercel-pull-into-local.mjs .env.vercel.pull
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.join(import.meta.dirname, '..')
const LOCAL_PATH = path.join(ROOT, '.env.local')
const PULL_PATH = path.join(ROOT, process.argv[2] || '.env.vercel.pull')

const MERGE_KEYS = [
  'DATABASE_URL',
  'GEMINI_API_KEY',
  'AI_GATEWAY_API_KEY',
  'VERCEL_AI_GATEWAY_API_KEY',
  'CRON_SECRET',
  'SESSION_SECRET',
  'GATEWAY_TOKEN',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'TWILIO_MESSAGING_ENABLED',
  'FIRE_CRAWL_KEY_2',
  'FIRE_CRAWL_KEY_3',
  'FIRECRAWL_API_KEY',
  'GROQ_API_KEY',
  'MISTRAL_API_KEY',
  'OPENROUTER_API_KEY',
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

function loadMap(filePath) {
  const map = new Map()
  if (!fs.existsSync(filePath)) return map
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const parsed = parseLine(line)
    if (parsed) map.set(parsed.key, parsed.val)
  }
  return map
}

if (!fs.existsSync(PULL_PATH)) {
  console.error(`❌ Missing ${path.basename(PULL_PATH)} — run:`)
  console.error('   vercel env pull .env.vercel.pull --environment=production --yes')
  process.exit(1)
}

const pull = loadMap(PULL_PATH)
const local = loadMap(LOCAL_PATH)
let merged = 0
const skippedEmpty = []

for (const key of MERGE_KEYS) {
  if (!pull.has(key)) continue
  const val = pull.get(key)?.trim()
  if (!val) {
    skippedEmpty.push(key)
    continue
  }
  local.set(key, val)
  merged++
}

if (merged === 0 && skippedEmpty.length === 0) {
  console.error('❌ No mergeable keys found in pull file.')
  process.exit(1)
}

const lines = []
for (const [key, val] of local.entries()) {
  const needsQuote = /[\s#"'\\]/.test(val)
  lines.push(needsQuote ? `${key}="${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : `${key}=${val}`)
}

fs.writeFileSync(LOCAL_PATH, `${lines.join('\n')}\n`, 'utf8')
console.log(`✅ Merged ${merged} keys from ${path.basename(PULL_PATH)} → .env.local (${local.size} total)`)
for (const key of MERGE_KEYS) {
  if (pull.has(key) && pull.get(key)?.trim()) {
    console.log(`   · ${key}`)
  }
}
if (skippedEmpty.length > 0) {
  console.log('')
  console.log('⚠ Vercel returned empty values (paste manually in .env.local from dashboard):')
  for (const key of skippedEmpty) {
    console.log(`   · ${key}`)
  }
}
