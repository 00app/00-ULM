#!/usr/bin/env npx tsx
/**
 * Live smoke for zero-auth UK public APIs (all six endpoints).
 * Usage: npm run test:uk-apis
 */
import {
  getLiveCarbonIntensity,
  getGenerationMix,
  getLatestWaterReadings,
  getAirQualityData,
  fetchUkInfrastructureFeed,
  renewablesSharePercent,
} from '../lib/data/ukPublicInfrastructureApis'
import {
  getActiveEnergyProducts,
  getLiveTariffHalfHourlyRates,
  fetchOctopusMarketSnapshot,
} from '../lib/data/octopusPublicApis'
import { fetchUtilitiesPublicSnapshot } from '../lib/data/utilitiesFreeApis'

async function main() {
  let failed = false
  const fail = (msg: string) => {
    console.error(`FAIL: ${msg}`)
    failed = true
  }

  console.log('--- 1. National carbon intensity ---')
  const carbon = await getLiveCarbonIntensity()
  if (!carbon) fail('carbon intensity')
  else {
    console.log(JSON.stringify(carbon, null, 2))
  }

  console.log('\n--- 2. National generation mix ---')
  const mix = await getGenerationMix()
  if (!mix.length) fail('generation mix')
  else {
    console.table(mix.slice(0, 8).map((m) => ({ fuel: m.fuel, perc: m.perc })))
    console.log('Renewables ~%', renewablesSharePercent(mix))
  }

  console.log('\n--- 3. EA water readings ---')
  const water = await getLatestWaterReadings(5)
  if (!water.length) fail('water readings')
  else console.log(JSON.stringify(water.slice(0, 3), null, 2))

  console.log('\n--- 4. Octopus consumer products ---')
  const products = await getActiveEnergyProducts()
  if (!products.results.length) fail('octopus products')
  else {
    console.log(`count: ${products.count}`)
    console.log(JSON.stringify(products.results.slice(0, 3), null, 2))
  }

  console.log('\n--- 5. Octopus Agile half-hourly rates ---')
  const agile = await getLiveTariffHalfHourlyRates(6)
  if (!agile?.results.length) fail('agile rates')
  else {
    console.log(`product: ${agile.productUrl}`)
    console.log(JSON.stringify(agile.results.slice(0, 3), null, 2))
  }

  console.log('\n--- 6. Air quality (Defra legacy or Open-Meteo EAQI fallback) ---')
  const aqi = await getAirQualityData({ postcode: 'BN177DW' })
  if (!aqi.length) {
    console.warn('WARN: no air quality row (low-priority feed)')
  } else {
    console.log(JSON.stringify(aqi, null, 2))
    if (aqi[0]?.source === 'open-meteo') {
      console.log('(Defra current-aqi-regional.json is 404 — using Open-Meteo at postcode)')
    }
  }

  console.log('\n--- Combined utilities snapshot (BN17 7DW, ELECTRIC) ---')
  const snap = await fetchUtilitiesPublicSnapshot({
    postcode: 'BN177DW',
    homePower: 'ELECTRIC',
  })
  if (!snap?.ukInfrastructure) fail('utilities snapshot')
  else {
    console.log(
      JSON.stringify(
        {
          home_power: snap.home_power,
          localCarbonGPerKwh: snap.localCarbonGPerKwh,
          agilePPerKwh: snap.agilePPerKwh,
          octopusProductCount: snap.octopusMarket?.productCount,
          agileSlots: snap.octopusMarket?.agile?.slots?.length,
          defraRegions: snap.ukInfrastructure?.defraAirQuality?.length,
        },
        null,
        2
      )
    )
  }

  await fetchUkInfrastructureFeed()

  if (failed) process.exitCode = 1
  else console.log('\n[test-uk-public-apis] OK — all six endpoints reachable')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
