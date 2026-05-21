/**
 * Tier A — parallel free-protocol hydration (no Gemini / Firecrawl).
 * Persists anchors on `users.user_genome.open_data_anchor` when userId is known.
 */

import pool from '@/lib/db'
import { getLocalData } from '@/lib/local/getLocalData'
import { fetchOpendataEpcProfile, type OpenEpcProfile } from '@/lib/intelligence/openEpcClient'
import { fetchNesoGridIntensity, type NesoGridSnapshot } from '@/lib/intelligence/nesoGridClient'
import { fetchPvgisSolarEstimate, type PvgisSolarSnapshot } from '@/lib/intelligence/pvgisClient'
import { resolveDefraWasteHint, type DefraWasteHint } from '@/lib/intelligence/defraWasteClient'

export type FreeStructuralAnchor = {
  postcode: string
  hydratedAt: string
  epc: OpenEpcProfile
  grid: NesoGridSnapshot | null
  solar: PvgisSolarSnapshot
  waste: DefraWasteHint
}

export async function hydrateFreeStructuralContext(
  postcode: string
): Promise<FreeStructuralAnchor | null> {
  const compact = postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (compact.length < 4) return null

  const local = await getLocalData(compact).catch(() => null)
  const [epc, grid] = await Promise.all([
    fetchOpendataEpcProfile(compact),
    fetchNesoGridIntensity(compact),
  ])
  const solar = await fetchPvgisSolarEstimate({
    postcode: compact,
    lat: undefined,
    lon: undefined,
  })
  const waste = resolveDefraWasteHint(local?.council ?? null)

  return {
    postcode: compact,
    hydratedAt: new Date().toISOString(),
    epc,
    grid,
    solar,
    waste,
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
