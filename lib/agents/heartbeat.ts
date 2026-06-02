/**
 * Discovery Pulse — on Zone entry, compare economy fingerprint and refresh injection display data.
 * Server returns authoritative figures; optional Gemini one-liner (never used for £ amounts).
 */

export interface DiscoveryPulseResult {
  fingerprint: string
  patches: Record<string, { money: string; carbon: string }>
  geminiPulseNote: string | null
}

import {
  isAiRouteBlockedClient,
  markAiRouteBlockedFromStatus,
} from '@/lib/intelligence/aiRouteClientGuard'

export async function runDiscoveryPulse(injectionIds: string[]): Promise<DiscoveryPulseResult | null> {
  if (typeof window === 'undefined') return null
  if (isAiRouteBlockedClient()) return null
  try {
    const res = await fetch('/api/discovery/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ injectionIds }),
      credentials: 'include',
    })
    if (markAiRouteBlockedFromStatus(res.status)) return null
    if (!res.ok) return null
    const data = (await res.json()) as DiscoveryPulseResult
    if (!data?.fingerprint || typeof data.patches !== 'object') return null
    return data
  } catch {
    return null
  }
}

const FP_KEY = 'zz_discovery_economy_fp'

export function readStoredEconomyFingerprint(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(FP_KEY)
  } catch {
    return null
  }
}

export function writeStoredEconomyFingerprint(fp: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(FP_KEY, fp)
  } catch {
    // ignore
  }
}
