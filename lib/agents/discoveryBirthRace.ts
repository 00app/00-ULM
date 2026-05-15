/**
 * Race structured discovery, ZeroHunter, and optional Action Vault rebirth (Solo Focus).
 * First pipeline to produce `new_card_data` wins; outer `timeoutMs` resolves `null` if none.
 */

import type { ZoneTipCard } from '@/lib/logic/zone'

export interface DiscoveryBirthPayload {
  recommendation_copy: string
  source_url: string
  new_card_data: ZoneTipCard
}

/**
 * Run both pipelines concurrently; the first to produce `new_card_data` wins.
 * Outer `timeoutMs` resolves `null` if neither produces in time.
 */
export async function raceDiscoveryBirth(params: {
  structured: () => Promise<DiscoveryBirthPayload | null>
  zeroHunter: () => Promise<DiscoveryBirthPayload | null>
  rebirthVault?: () => Promise<DiscoveryBirthPayload | null>
  timeoutMs?: number
}): Promise<DiscoveryBirthPayload | null> {
  const timeoutMs = params.timeoutMs ?? 7200
  return new Promise((resolve) => {
    let settled = false
    const win = (p: DiscoveryBirthPayload | null) => {
      if (settled || !p?.new_card_data) return
      settled = true
      resolve(p)
    }
    Promise.resolve()
      .then(() => params.structured())
      .then(win)
      .catch(() => {})
    Promise.resolve()
      .then(() => params.zeroHunter())
      .then(win)
      .catch(() => {})
    if (params.rebirthVault) {
      Promise.resolve()
        .then(() => params.rebirthVault!())
        .then(win)
        .catch(() => {})
    }
    setTimeout(() => {
      if (!settled) {
        settled = true
        resolve(null)
      }
    }, timeoutMs)
  })
}
