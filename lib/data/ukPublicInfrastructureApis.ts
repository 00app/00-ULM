/**
 * UK public infrastructure APIs — no keys, no registration (server-side only).
 * NESO Carbon Intensity + Environment Agency flood/water monitoring.
 */

const JSON_HEADERS = { Accept: 'application/json' } as const
const FETCH_TIMEOUT_MS = 8000

export type LiveCarbonIntensitySlot = {
  from: string
  to: string
  index: string
  actualGPerKwh: number | null
  forecastGPerKwh: number | null
}

export type GenerationMixEntry = {
  fuel: string
  perc: number
}

export type WaterReadingItem = {
  measure: string
  dateTime: string
  value: number
}

export type DefraRegionalAqi = {
  regionId: string
  name: string
  aqi: number | string
  pollutant: string | null
  /** `defra-legacy-json` (retired) or `open-meteo` postcode anchor. */
  source: 'defra-legacy-json' | 'open-meteo'
}

export type UkInfrastructureFeed = {
  carbon: LiveCarbonIntensitySlot | null
  generationMix: GenerationMixEntry[]
  waterSample: WaterReadingItem[]
  /** Regional AQI — carbon / travel context only (not bill £). */
  defraAirQuality: DefraRegionalAqi[]
  fetchedAt: string
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: JSON_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const text = await res.text()
    const trimmed = text.trim()
    if (!trimmed || trimmed.startsWith('<')) return null
    return JSON.parse(trimmed) as T
  } catch {
    return null
  }
}

async function fetchPostcodeLatLon(
  postcode: string
): Promise<{ lat: number; lon: number; region?: string } | null> {
  const clean = postcode.replace(/\s+/g, '').toUpperCase()
  if (clean.length < 4) return null
  const json = await fetchJson<{
    result?: { latitude?: number; longitude?: number; region?: string }
  }>(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`)
  const r = json?.result
  if (typeof r?.latitude !== 'number' || typeof r?.longitude !== 'number') return null
  return { lat: r.latitude, lon: r.longitude, region: r.region }
}

/** Legacy Defra regional JSON — endpoint often 404 (retired asset). */
async function fetchDefraLegacyRegionalAqi(): Promise<DefraRegionalAqi[]> {
  const json = await fetchJson<
    Record<string, { name?: string; aqi?: number | string; pollutant?: string }>
  >('https://uk-air.defra.gov.uk/assets/json/current-aqi-regional.json')
  if (!json || typeof json !== 'object') return []
  const out: DefraRegionalAqi[] = []
  for (const regionId of Object.keys(json)) {
    const data = json[regionId]
    if (!data || typeof data !== 'object') continue
    out.push({
      regionId,
      name: String(data.name ?? regionId).trim(),
      aqi: data.aqi ?? '—',
      pollutant: data.pollutant != null ? String(data.pollutant) : null,
      source: 'defra-legacy-json',
    })
  }
  return out
}

/** Open-Meteo European AQI at postcode (free fallback when Defra JSON is gone). */
async function fetchOpenMeteoEuropeanAqi(
  lat: number,
  lon: number,
  regionLabel?: string
): Promise<DefraRegionalAqi | null> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi&timezone=Europe%2FLondon`
  const json = await fetchJson<{
    current?: { european_aqi?: number }
  }>(url)
  const aqi = json?.current?.european_aqi
  if (typeof aqi !== 'number' || !Number.isFinite(aqi)) return null
  return {
    regionId: 'open-meteo',
    name: regionLabel?.trim() || 'Postcode anchor',
    aqi,
    pollutant: 'european_aqi',
    source: 'open-meteo',
  }
}

/** National live + forecast grid carbon (NESO Carbon Intensity API). */
export async function getLiveCarbonIntensity(): Promise<LiveCarbonIntensitySlot | null> {
  const json = await fetchJson<{
    data?: Array<{
      from?: string
      to?: string
      intensity?: { index?: string; actual?: number; forecast?: number }
    }>
  }>('https://api.carbonintensity.org.uk/intensity')
  const row = json?.data?.[0]
  if (!row?.intensity) return null
  const actual = row.intensity.actual
  const forecast = row.intensity.forecast
  return {
    from: row.from ?? '',
    to: row.to ?? '',
    index: row.intensity.index ?? '',
    actualGPerKwh: typeof actual === 'number' && Number.isFinite(actual) ? actual : null,
    forecastGPerKwh:
      typeof forecast === 'number' && Number.isFinite(forecast) ? forecast : null,
  }
}

/** National generation mix (% by fuel) — same API family. */
export async function getGenerationMix(): Promise<GenerationMixEntry[]> {
  const json = await fetchJson<{
    data?: { generationmix?: Array<{ fuel?: string; perc?: number }> }
  }>('https://api.carbonintensity.org.uk/generation')
  const mix = json?.data?.generationmix
  if (!Array.isArray(mix)) return []
  return mix
    .map((m) => ({
      fuel: String(m.fuel ?? '').trim(),
      perc: typeof m.perc === 'number' && Number.isFinite(m.perc) ? m.perc : 0,
    }))
    .filter((m) => m.fuel.length > 0)
}

/** Latest Environment Agency readings (England — flows / levels). */
export async function getLatestWaterReadings(limit = 10): Promise<WaterReadingItem[]> {
  const n = Math.min(50, Math.max(1, limit))
  const json = await fetchJson<{
    items?: Array<{ measure?: string; dateTime?: string; value?: number }>
  }>(
    `https://environment.data.gov.uk/flood-monitoring/data/readings?_limit=${n}`
  )
  if (!Array.isArray(json?.items)) return []
  return json.items
    .map((item) => ({
      measure: String(item.measure ?? '').trim(),
      dateTime: String(item.dateTime ?? '').trim(),
      value: typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : 0,
    }))
    .filter((item) => item.measure.length > 0 && item.dateTime.length > 0)
}

/**
 * Air quality index for carbon/travel context.
 * Defra `current-aqi-regional.json` is often 404 — falls back to Open-Meteo EAQI at postcode.
 */
export async function getAirQualityData(opts?: {
  postcode?: string
  latitude?: number
  longitude?: number
  regionLabel?: string
}): Promise<DefraRegionalAqi[]> {
  const legacy = await fetchDefraLegacyRegionalAqi()
  if (legacy.length) return legacy

  let lat = opts?.latitude
  let lon = opts?.longitude
  let regionLabel = opts?.regionLabel
  if (opts?.postcode?.trim()) {
    const pc = await fetchPostcodeLatLon(opts.postcode)
    if (pc) {
      lat = pc.lat
      lon = pc.lon
      regionLabel = regionLabel ?? pc.region
    }
  }
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    lat = 54
    lon = -2
    regionLabel = regionLabel ?? 'UK centroid'
  }
  const row = await fetchOpenMeteoEuropeanAqi(lat, lon, regionLabel)
  return row ? [row] : []
}

/** Parallel fetch for utilities / water / carbon calculators. */
export async function fetchUkInfrastructureFeed(opts?: {
  postcode?: string
}): Promise<UkInfrastructureFeed> {
  const [carbon, generationMix, waterSample, defraAirQuality] = await Promise.all([
    getLiveCarbonIntensity(),
    getGenerationMix(),
    getLatestWaterReadings(10),
    getAirQualityData({ postcode: opts?.postcode }),
  ])
  return {
    carbon,
    generationMix,
    waterSample,
    defraAirQuality,
    fetchedAt: new Date().toISOString(),
  }
}

/** Renewables share (wind + solar + hydro + biomass %) from national mix. */
export function renewablesSharePercent(mix: GenerationMixEntry[]): number | null {
  if (!mix.length) return null
  const renewableFuels = /^(wind|solar|hydro|biomass|other renewables)/i
  const sum = mix
    .filter((m) => renewableFuels.test(m.fuel))
    .reduce((acc, m) => acc + m.perc, 0)
  return Math.round(Math.min(100, Math.max(0, sum)) * 10) / 10
}

export function formatUkInfrastructureFeedBlock(feed: UkInfrastructureFeed): string {
  const lines = ['UK PUBLIC INFRASTRUCTURE FEED (zero-auth APIs):']
  if (feed.carbon) {
    const g = feed.carbon.actualGPerKwh ?? feed.carbon.forecastGPerKwh
    lines.push(
      `national_grid_carbon: ${g != null ? `${g} gCO2/kWh` : 'unavailable'} (index: ${feed.carbon.index}, window: ${feed.carbon.from}–${feed.carbon.to})`
    )
  }
  if (feed.generationMix.length) {
    const top = [...feed.generationMix].sort((a, b) => b.perc - a.perc).slice(0, 6)
    lines.push(
      'generation_mix_pct:',
      ...top.map((m) => `  - ${m.fuel}: ${m.perc}%`)
    )
    const renew = renewablesSharePercent(feed.generationMix)
    if (renew != null) lines.push(`renewables_share_approx_pct: ${renew}`)
  }
  if (feed.waterSample.length) {
    lines.push(`ea_water_readings_sample: ${feed.waterSample.length} stations (England)`)
    const first = feed.waterSample[0]
    lines.push(`  latest_sample: ${first.value} @ ${first.dateTime}`)
  }
  if (feed.defraAirQuality.length) {
    const match =
      feed.defraAirQuality.find((r) => /london|south east|south east/i.test(r.name)) ??
      feed.defraAirQuality[0]
    lines.push(
      `air_quality_sample (${match.source}): ${match.name} index ${match.aqi}${match.pollutant ? ` (${match.pollutant})` : ''}`
    )
  }
  return lines.join('\n')
}
