/**
 * Tier A — parallel free-protocol hydration (no Gemini / Firecrawl).
 * Persists anchors on `users.user_genome.open_data_anchor` and
 * `users.user_genome.property_intelligence` when userId is known.
 */

import pool from '@/lib/db'
import { getLocalData } from '@/lib/local/getLocalData'
import { fetchOpendataEpcProfile, type OpenEpcProfile } from '@/lib/intelligence/openEpcClient'
import { fetchNesoGridIntensity, type NesoGridSnapshot } from '@/lib/intelligence/nesoGridClient'
import { fetchPvgisSolarEstimate, type PvgisSolarSnapshot } from '@/lib/intelligence/pvgisClient'
import { resolveDefraWasteHint, type DefraWasteHint } from '@/lib/intelligence/defraWasteClient'
import { fetchLandRegistryByPostcode } from '@/lib/intelligence/landRegistryClient'
import { fetchDeprivationByPostcode } from '@/lib/intelligence/deprivationClient'
import { fetchFloodRiskByPostcode } from '@/lib/intelligence/floodRiskClient'
import { fetchSolarIrradianceByPostcode } from '@/lib/intelligence/solarIrradianceClient'
import { fetchDnoByPostcode } from '@/lib/intelligence/dnoClient'
import { fetchPostcodeGeo } from '@/lib/intelligence/postcodeGeoClient'
import type {
  PropertyIntelligence,
  PropertyIntelligenceConfidence,
} from '@/lib/intelligence/propertyIntelligenceTypes'

export type FreeStructuralHydrationOptions = {
  houseNumber?: string | null
}

export type FreeStructuralAnchor = {
  postcode: string
  houseNumber?: string | null
  hydratedAt: string
  epc: OpenEpcProfile
  grid: NesoGridSnapshot | null
  solar: PvgisSolarSnapshot
  waste: DefraWasteHint
  propertyIntelligence?: PropertyIntelligence
}

function resolvePropertyConfidence(params: {
  houseNumber?: string | null
  epc: OpenEpcProfile
  sourcesFound: number
  sourcesAttempted: number
}): PropertyIntelligenceConfidence {
  if (params.houseNumber?.trim() && params.epc.addressMatched === true) {
    return 'ADDRESS_MATCHED'
  }
  if (!params.houseNumber?.trim()) return 'POSTCODE_ONLY'
  if (params.sourcesFound > 0 && params.sourcesFound < params.sourcesAttempted) {
    return 'PARTIAL'
  }
  return params.sourcesFound > 0 ? 'POSTCODE_ONLY' : 'PARTIAL'
}

export async function hydratePropertyIntelligence(
  postcode: string,
  options?: FreeStructuralHydrationOptions
): Promise<PropertyIntelligence | null> {
  const compact = postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (compact.length < 4) return null

  const houseNumber = (options?.houseNumber ?? '').replace(/\s+/g, ' ').trim() || null

  const [geo, epc, landRegistry, deprivation, flood, solar, dno] = await Promise.all([
    fetchPostcodeGeo(compact),
    fetchOpendataEpcProfile(compact, { houseNumber }),
    fetchLandRegistryByPostcode(compact, { houseNumber }),
    fetchDeprivationByPostcode(compact),
    fetchFloodRiskByPostcode(compact),
    fetchSolarIrradianceByPostcode(compact),
    fetchDnoByPostcode(compact),
  ])

  const sourceFlags = [
    epc.found,
    landRegistry.found,
    deprivation.found,
    flood.found,
    solar.found,
    dno.found,
  ]
  const sourcesFound = sourceFlags.filter(Boolean).length
  const sourcesAttempted = sourceFlags.length

  const confidence = resolvePropertyConfidence({
    houseNumber,
    epc,
    sourcesFound,
    sourcesAttempted,
  })

  return {
    epc,
    landRegistry,
    deprivation,
    flood,
    solar,
    dno,
    geo: geo.found
      ? {
          lsoaCode: geo.lsoaCode,
          msoaCode: geo.msoaCode,
          lat: geo.lat,
          lon: geo.lon,
        }
      : undefined,
    enrichedAt: new Date().toISOString(),
    confidence,
  }
}

export async function hydrateFreeStructuralContext(
  postcode: string,
  options?: FreeStructuralHydrationOptions
): Promise<FreeStructuralAnchor | null> {
  const compact = postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (compact.length < 4) return null

  const houseNumber = (options?.houseNumber ?? '').replace(/\s+/g, ' ').trim() || null

  const local = await getLocalData(compact).catch(() => null)
  const [propertyIntelligence, grid] = await Promise.all([
    hydratePropertyIntelligence(compact, { houseNumber }),
    fetchNesoGridIntensity(compact),
  ])
  const epc = propertyIntelligence?.epc ?? (await fetchOpendataEpcProfile(compact, { houseNumber }))
  const solarIrr = propertyIntelligence?.solar
  const solar =
    solarIrr?.found && solarIrr.annualIrradianceKwhM2
      ? {
          found: true,
          annualKwhEstimate: Math.round(solarIrr.annualIrradianceKwhM2 * 4 * 0.86),
          yieldFactor: solarIrr.yieldFactor,
        }
      : await fetchPvgisSolarEstimate({
          postcode: compact,
          lat: propertyIntelligence?.geo?.lat,
          lon: propertyIntelligence?.geo?.lon,
        })
  const waste = resolveDefraWasteHint(local?.council ?? null)

  return {
    postcode: compact,
    houseNumber,
    hydratedAt: new Date().toISOString(),
    epc,
    grid,
    solar,
    waste,
    propertyIntelligence: propertyIntelligence ?? undefined,
  }
}

export async function persistOpenDataAnchors(
  userId: string,
  anchor: FreeStructuralAnchor
): Promise<void> {
  const uid = userId?.trim()
  if (!uid) return
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_genome JSONB DEFAULT '{}'::jsonb`)
    await pool.query(
      `UPDATE users
       SET user_genome = jsonb_set(
         COALESCE(user_genome, '{}'::jsonb),
         '{open_data_anchor}',
         $2::jsonb,
         true
       )
       WHERE id = $1::uuid`,
      [uid, JSON.stringify(anchor)]
    )
    if (anchor.propertyIntelligence) {
      await persistPropertyIntelligence(uid, anchor.propertyIntelligence)
    }
    if (anchor.epc.found && anchor.epc.mainFuel) {
      await pool.query(
        `UPDATE users SET home_type = COALESCE(home_type, $2) WHERE id = $1::uuid`,
        [uid, anchor.epc.propertyType?.slice(0, 64) ?? null]
      ).catch(() => {})
    }
  } catch {
    /* non-blocking */
  }
}

export async function persistPropertyIntelligence(
  userId: string,
  propertyIntelligence: PropertyIntelligence
): Promise<void> {
  const uid = userId?.trim()
  if (!uid) return
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_genome JSONB DEFAULT '{}'::jsonb`)
    await pool.query(
      `UPDATE users
       SET user_genome = jsonb_set(
         COALESCE(user_genome, '{}'::jsonb),
         '{property_intelligence}',
         $2::jsonb,
         true
       )
       WHERE id = $1::uuid`,
      [uid, JSON.stringify(propertyIntelligence)]
    )
  } catch {
    /* non-blocking */
  }
}
