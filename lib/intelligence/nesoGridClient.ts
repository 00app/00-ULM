/**
 * UK grid carbon intensity (NESO / Carbon Intensity API) — zero-token public feed.
 * Same regional endpoint used by `getLocalData` and `lib/logic/pulse.ts`.
 */

import { getLocalData, type LocalIntelligence } from '@/lib/local/getLocalData'
import {
  REG_GB_BASE_G_PER_KWH,
  REG_HI_RURAL_G_PER_KWH,
  REG_URBAN_LEZ_G_PER_KWH,
} from '@/lib/brains/constants'

function deriveGridTier(postcode: string, local: LocalIntelligence | null): 'REG_HI_RURAL' | 'REG_URBAN_LEZ' | 'REG_GB_BASE' {
  const compact = postcode.replace(/\s+/g, '').toUpperCase()
  if (/^(KW|IV|HS|ZE|PH)/.test(compact)) return 'REG_HI_RURAL'
  const region = String(local?.region ?? '').toLowerCase()
  const council = String(local?.council ?? '').toLowerCase()
  if (region.includes('london') || council.includes('manchester') || council.includes('birmingham')) {
    return 'REG_URBAN_LEZ'
  }
  return 'REG_GB_BASE'
}

function gridTierFallbackGPerKwh(tier: ReturnType<typeof deriveGridTier>): number {
  if (tier === 'REG_HI_RURAL') return REG_HI_RURAL_G_PER_KWH
  if (tier === 'REG_URBAN_LEZ') return REG_URBAN_LEZ_G_PER_KWH
  return REG_GB_BASE_G_PER_KWH
}

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
      : gridTierFallbackGPerKwh(tier)

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
