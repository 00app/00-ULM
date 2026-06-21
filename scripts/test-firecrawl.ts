import {
  scrapeFirecrawlZoneResearchStructured,
  scrapeWithFirecrawlUrl,
} from '../lib/agents/researchAgent'

import { loadEnvLocal } from './load-env-local'

loadEnvLocal({ preferLocal: true })

async function main() {
  const zoneSchema = process.argv.includes('--zone-schema')
  const capUrl = 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap'

  const fcKey =
    process.env.FIRE_CRAWL_KEY_2?.trim()
  if (!fcKey) {
    console.error(
      '❌ Set FIRE_CRAWL_KEY_2 in .env.local (same resolution as lib/sentinel/api-config.ts).'
    )
    process.exit(1)
  }

  if (zoneSchema) {
    console.log('Testing Firecrawl extract with Zone research v2 schema…')
    console.log(`Target: ${capUrl}`)
    try {
      const structured = await scrapeFirecrawlZoneResearchStructured(capUrl)
      if (structured?.extract && typeof structured.extract === 'object') {
        console.log('\n✅ Extract returned JSON (truncated):\n')
        console.log(JSON.stringify(structured.extract, null, 2).slice(0, 4000))
        if (JSON.stringify(structured.extract).length > 4000) console.log('\n… (truncated)')
      } else {
        const mdLen = structured?.markdown?.trim().length ?? 0
        console.log(
          '\n⚠️ No structured extract (Ofgem often blocks or omits extract).',
          `Inline markdown: ${mdLen > 0 ? `${mdLen} chars` : 'none'}.`
        )
        if (mdLen > 0) {
          console.log('--- Markdown preview ---')
          console.log(structured!.markdown!.trim().slice(0, 500))
          console.log('------------------------')
        } else {
          console.log('→ Trying markdown-only scrape (production JIT path)…')
          const fallback = await scrapeWithFirecrawlUrl(capUrl)
          const fbLen = fallback?.markdown?.trim().length ?? 0
          if (fbLen > 0) {
            console.log(`✅ Markdown-only OK (${fbLen} chars). Title: ${fallback?.title ?? 'N/A'}`)
            console.log(fallback!.markdown!.trim().slice(0, 500))
          } else {
            console.log('⚠️ Markdown-only also empty — use mechanical/repair fallbacks; earned JIT uses category seeds, not this URL alone.')
          }
        }
      }
    } catch (error) {
      console.error('\n❌ Zone schema extract error:', error)
    }
    return
  }

  console.log('Testing Firecrawl Vision...')
  console.log('Target: Energy Saving Trust (https://energysavingtrust.org.uk/energy-at-home/)')
  try {
    const result = await scrapeWithFirecrawlUrl('https://energysavingtrust.org.uk/energy-at-home/')

    if (result && result.markdown) {
      console.log('\n✅ Firecrawl is online. Zai can see!\n')
      console.log('--- Sneak Peek of what Zai sees ---')
      console.log(result.markdown.substring(0, 500) + '...\n')
      console.log('-----------------------------------')
      console.log(`Page Title: ${result.title || 'N/A'}`)
    } else {
      console.log('\n⚠️ Firecrawl returned null. Check your API key or network.')
    }
  } catch (error) {
    console.error('\n❌ Error connecting to Firecrawl:', error)
  }
}

main()
