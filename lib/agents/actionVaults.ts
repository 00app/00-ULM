/**
 * Three Intelligence Vaults — Action Vault URL sets for Firecrawl rebirth (Gov/MSE/Ofgem,
 * peer mobility, circular economy). Mapped by journey category (not geographic hardcoding — locality comes from user postcode in prompts).
 */

import type { JourneyId } from '@/lib/journeys'

export type IntelligenceVaultId = 'A' | 'B' | 'C'

/** Vault A — financial / home energy / water / waste policy & grants. */
export const VAULT_A_URLS = [
  'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap',
  'https://www.gov.uk/improve-energy-efficiency',
  'https://www.gov.uk/find-energy-grants-help-pay-bills',
  'https://www.gov.uk/apply-boiler-upgrade-scheme',
  'https://www.moneysavingexpert.com/cheapenergyclub/',
  'https://www.moneysavingexpert.com/utilities/',
  'https://energysavingtrust.org.uk/',
] as const

/** Vault B — travel, shared mobility, P2P assets (UK-first hosts). */
export const VAULT_B_URLS = [
  'https://www.gov.uk/guidance/vehicle-tax-exemption-for-electric-vehicles',
  'https://www.hiyacar.co.uk/',
  'https://liftshare.com/uk',
  'https://www.karshare.com/',
  'https://turo.com/gb/en',
] as const

/** Vault C — circular food, retail surplus, money ethics. */
export const VAULT_C_URLS = [
  'https://olioex.com/',
  'https://toogoodtogo.com/en-gb',
  'https://www.ethicalconsumer.org/',
  'https://www.freegle.net/',
  'https://www.moneysavingexpert.com/shopping/',
] as const

export function vaultForJourney(journeyId: JourneyId): IntelligenceVaultId {
  switch (journeyId) {
    case 'home':
    case 'carbon':
    case 'waste':
      return 'A'
    case 'travel':
    case 'holidays':
    case 'tech':
      return 'B'
    case 'food':
    case 'shopping':
    case 'money':
    default:
      return 'C'
  }
}

export function urlsForVault(vault: IntelligenceVaultId, max = 5): string[] {
  const u =
    vault === 'A' ? [...VAULT_A_URLS] : vault === 'B' ? [...VAULT_B_URLS] : [...VAULT_C_URLS]
  return u.slice(0, max)
}
