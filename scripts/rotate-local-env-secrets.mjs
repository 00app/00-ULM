#!/usr/bin/env node
/**
 * Rebuild `.env.local` with fresh rotation secrets; keep Neon/API keys from a source file.
 *
 * Usage:
 *   node scripts/rotate-local-env-secrets.mjs
 *   node scripts/rotate-local-env-secrets.mjs --source .env.production.local
 *
 * Never commit output. Does not print secret values.
 */
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const ROOT = path.join(import.meta.dirname, '..')
const OUT = path.join(ROOT, '.env.local')

const ROTATE_KEYS = new Set(['SESSION_SECRET', 'CRON_SECRET', 'GATEWAY_TOKEN', 'SCRAPER_SECRET'])

const KEEP_PREFIXES = [
  'DATABASE_',
  'GEMINI_',
  'GROQ_',
  'MISTRAL_',
  'OPENROUTER_',
  'FIRE_',
  'FIRECRAWL_',
  'AI_GATEWAY',
  'VERCEL_AI_',
  'MODEL_',
  'MAX_ITERATIONS',
  'BUCKET_',
  'SKIP_',
  'ALLOW_',
  'GEMINI_FREE',
  'NEXT_PUBLIC_',
  'ADMIN_',
  'RESEARCH_',
  'DATABASE_USE_',
  'WS_NO_',
  'GEOAPIFY_',
]

function parseEnvFile(filePath) {
  const map = new Map()
  if (!filePath || !fs.existsSync(filePath)) return map
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
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
      val = val.slice(1, -1)
    }
    val = val.replace(/\\n/g, '').trim()
    if (val) map.set(key, val)
  }
  return map
}

function shouldKeep(key) {
  if (ROTATE_KEYS.has(key)) return false
  return KEEP_PREFIXES.some((p) => key.startsWith(p) || key === p.replace(/_$/, ''))
}

function randB64(bytes) {
  return crypto.randomBytes(bytes).toString('base64')
}

function formatLine(key, val) {
  const needsQuote = /[\s#"'\\]/.test(val)
  return needsQuote ? `${key}="${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : `${key}=${val}`
}

const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.slice(8)
const sources = [
  sourceArg,
  path.join(ROOT, '.env.production.local'),
  path.join(ROOT, '.vercel', '.env.production.local'),
  path.join(ROOT, '.env.local'),
].filter(Boolean)

const merged = new Map()
for (const src of sources) {
  const m = parseEnvFile(src)
  for (const [k, v] of m) {
    if (shouldKeep(k)) merged.set(k, v)
  }
}

for (const key of ROTATE_KEYS) {
  const len = key === 'SESSION_SECRET' ? 32 : 24
  merged.set(key, randB64(len))
}

if (!merged.get('DATABASE_URL')) {
  console.error('❌ No DATABASE_URL in source files. Pull from Vercel/Neon first:')
  console.error('   vercel env pull .env.production.local --environment=production --yes')
  process.exit(1)
}

const order = [
  'DATABASE_URL',
  'MODEL_STRATEGY',
  'MAX_ITERATIONS',
  'GEMINI_FREE_TIER',
  'BUCKET_SKIP_GEMINI',
  'SKIP_FIRECRAWL',
  'GEMINI_API_KEY',
  'GEMINI_ZONE_MODEL',
  'GEMINI_ARTICLE_MODEL',
  'GEMINI_CHAT_MODEL',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'MISTRAL_API_KEY',
  'OPENROUTER_API_KEY',
  'FIRE_CRAWL_KEY_2',
  'SESSION_SECRET',
  'CRON_SECRET',
  'GATEWAY_TOKEN',
  'SCRAPER_SECRET',
  'AI_GATEWAY_API_KEY',
  'VERCEL_AI_GATEWAY_API_KEY',
  'ADMIN_PASSWORD',
  'NEXT_PUBLIC_APP_URL',
]

const written = new Set()
const lines = [
  '# Rotated by scripts/rotate-local-env-secrets.mjs — do not commit',
  '# SESSION_SECRET / CRON_SECRET / GATEWAY_TOKEN / SCRAPER_SECRET are new',
  '',
]

for (const key of order) {
  if (!merged.has(key)) continue
  lines.push(formatLine(key, merged.get(key)))
  written.add(key)
}

const rest = [...merged.keys()].filter((k) => !written.has(k)).sort()
for (const key of rest) {
  lines.push(formatLine(key, merged.get(key)))
}

if (fs.existsSync(OUT)) {
  fs.renameSync(OUT, `${OUT}.bak.${Date.now()}`)
}

fs.writeFileSync(OUT, `${lines.join('\n')}\n`, { mode: 0o600 })
console.log('✅ Wrote .env.local (mode 600)')
console.log(`   Kept ${merged.size - ROTATE_KEYS.size} keys from source; rotated: ${[...ROTATE_KEYS].join(', ')}`)
console.log('   Old file saved as .env.local.bak.* if it existed')
console.log('   Restart: npm run dev')
