#!/usr/bin/env npx tsx
/**
 * Smoke test for the free scraping path (no Firecrawl required).
 * Usage: npx tsx scripts/test-free-scrape.ts
 */
import { fetchMarkdownForUrlsFreeFirst } from '../lib/agents/freeScraper'

const TEST_URLS = [
  'https://www.ofgem.gov.uk/information-consumers/energy-advice-households/energy-price-cap-and-standing-charges-explained',
  'https://www.gov.uk/energy-grants-calculator',
  'https://www.gov.uk/improve-energy-efficiency',
]

async function main() {
  console.log('--- Free scrape smoke test (no Firecrawl) ---\n')
  let passed = 0
  let failed = 0

  const results = await fetchMarkdownForUrlsFreeFirst(TEST_URLS, { minChars: 200 })

  for (const { url, markdown, title } of results) {
    const short = url.replace('https://', '').split('/')[0]
    if (markdown.length >= 200) {
      console.log(`✅ ${short} — ${markdown.length} chars${title ? ` | "${title}"` : ''}`)
      passed++
    } else {
      console.log(`❌ ${short} — only ${markdown.length} chars`)
      failed++
    }
  }

  // Check which URLs got no result at all
  const returnedUrls = new Set(results.map(r => r.url))
  for (const url of TEST_URLS) {
    if (!returnedUrls.has(url)) {
      const short = url.replace('https://', '').split('/')[0]
      console.log(`❌ ${short} — no result returned`)
      failed++
    }
  }

  console.log(`\n${passed}/${passed + failed} URLs scraped successfully`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
