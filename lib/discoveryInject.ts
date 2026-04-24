/**
 * Client bridge: optimistic discovery card → Zone grid (Framer spring).
 * Safe to import from client components only (guards `window`).
 */

import { validateInjectionCard } from '@/lib/zone/injections'

export const DISCOVERY_INJECT_EVENT = 'zero-zero-discovery-inject'

/** Push a validated Zone tip card into the Zone page listener (SPRING_BLOOM pop-in). */
export function injectNewDiscoveryCard(newCardData: unknown): void {
  if (typeof window === 'undefined') return
  const card = validateInjectionCard(newCardData)
  if (!card) return
  window.dispatchEvent(new CustomEvent(DISCOVERY_INJECT_EVENT, { detail: card }))
}
