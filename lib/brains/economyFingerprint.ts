/**
 * Fingerprint for Discovery Pulse — bumps when March 2026 economy constants change (deploy).
 */

import { MARCH_2026_ECONOMY, PRICE_CAP_APRIL_2026, PRICE_CAP_MARCH_2026, PRICE_CAP_SAVING_APRIL_1 } from '@/lib/brains/constants'

export function getEconomyFingerprint(): string {
  const payload = {
    m: MARCH_2026_ECONOMY,
    capM: PRICE_CAP_MARCH_2026,
    capA: PRICE_CAP_APRIL_2026,
    save: PRICE_CAP_SAVING_APRIL_1,
  }
  return `zz-eco-${hashString(JSON.stringify(payload))}`
}

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}
