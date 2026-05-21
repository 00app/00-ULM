/**
 * UK grid carbon intensity (NESO / Carbon Intensity API) — zero-token public feed.
 * Same regional endpoint used by `getLocalData` and `lib/logic/pulse.ts`.
 */

import { getLocalData, type LocalIntelligence } from '@/lib/local/getLocalData'
import { deriveGridTier, getCarbonIntensity } from '@/lib/logic/engine'

export type NesoGridSnapshot = {
  postcode: string
  outcode: string
  /** Live or tier reference gCO₂/kWh */
  intensityG: number
  tier: ReturnType<typeof deriveGridTier>
  source: 'carbonintensity.org.uk' | 'tier_fallback'
  /** Optional generation mix (when regional API returns fuel breakdown). */
  generationMix?: {
    solarPercentage?: number
    windPercentage?: number
  }
}

export async function fetchNesoGridIntensity(postcode: string): Promise<NesoGridSnapshot | null> {
  const compact = postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (compact.length < 4) return null

  const local: LocalIntelligence | null = await getLocalData(compact).catch(() => null)
  const outcode = (local?.outcode ?? compact.slice(0, 4)).toUpperCase()
  const tier = deriveGridTier(compact, local)
  const live = local?.localCarbonG
  const intensityG =
    typeof live === 'number' && Number.isFinite(live) && live > 0
      ? live
      : getCarbonIntensity(compact, local)

  let generationMix: NesoGridSnapshot['generationMix']
  try {
    const genRes = await fetch(
      `https://api.carbonintensity.org.uk/regional/intensity/${encodeURIComponent(outcode)}/fw24h`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (genRes.ok) {
      const genJson = (await genRes.json()) as {
        data?: { generationmix?: { fuel: string; perc: number }[] }[]
      }
      const mix = genJson?.data?.[0]?.generationmix
      if (Array.isArray(mix)) {
        const solar = mix.find((m) => /solar/i.test(m.fuel))?.perc
        const wind = mix.find((m) => /wind/i.test(m.fuel))?.perc
        generationMix = {
          solarPercentage: typeof solar === 'number' ? solar / 100 : undefined,
          windPercentage: typeof wind === 'number' ? wind / 100 : undefined,
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  return {
    postcode: compact,
    outcode,
    intensityG,
    tier,
    source: typeof live === 'number' && live > 0 ? 'carbonintensity.org.uk' : 'tier_fallback',
    generationMix,
  }
}
