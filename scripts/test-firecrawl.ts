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
        console.log('\n⚠️ No extract payload (API may omit extract for this URL or format). Markdown:', Boolean(structured?.markdown))
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
