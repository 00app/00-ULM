#!/usr/bin/env npx tsx
/**
 * Test ZeroAgent directly — loads all env files like Next.js does.
 * Usage: npx tsx scripts/test-zero-agent.ts [category] [postcode]
 */
import fs from 'fs'
import path from 'path'

// Load all Next.js env files in priority order (lower = overrides higher)
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const p = path.join(process.cwd(), file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (val && !process.env[key]) process.env[key] = val
  }
}

import { runZeroAgent } from '../lib/agents/zeroAgent'

const category = process.argv[2] || 'solar'
const postcode = process.argv[3] || 'BN17'

async function main() {
  console.log('OPENROUTER_API_KEY set:', Boolean(process.env.OPENROUTER_API_KEY?.trim()))
  console.log(`Running ZeroAgent for ${category}@${postcode}...\n`)

  const result = await runZeroAgent({
    postcode,
    category,
    profileBlock: `postcode: ${postcode}\ncurrent_domain: ${category}`,
    localityContext: postcode === 'BN17' ? 'Littlehampton, West Sussex, South East' : null,
  })

  if (!result) {
    console.log('❌ Agent returned null')
    return
  }

  console.log(`✅ Tools used: ${result.toolsUsed.join(' → ')}`)
  console.log(`Citations: ${result.citations.map(c => c.url).join(', ')}`)
  console.log()
  console.log('=== OUTPUT ===')
  console.log(result.markdown)
}

main().catch(console.error)
