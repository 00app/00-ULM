/**
 * Property intelligence envelope — persisted on `users.user_genome.property_intelligence`.
 */

import type { OpenEpcProfile } from '@/lib/intelligence/openEpcClient'
import type { LandRegistrySnapshot } from '@/lib/intelligence/landRegistryClient'
import type { DeprivationSnapshot } from '@/lib/intelligence/deprivationClient'
import type { FloodRiskSnapshot } from '@/lib/intelligence/floodRiskClient'
import type { SolarIrradianceSnapshot } from '@/lib/intelligence/solarIrradianceClient'
import type { DnoSnapshot } from '@/lib/intelligence/dnoClient'

export type PropertyIntelligenceConfidence = 'ADDRESS_MATCHED' | 'POSTCODE_ONLY' | 'PARTIAL'

export type PropertyIntelligence = {
  epc?: OpenEpcProfile
  landRegistry?: LandRegistrySnapshot
  deprivation?: DeprivationSnapshot
  flood?: FloodRiskSnapshot
  solar?: SolarIrradianceSnapshot
  dno?: DnoSnapshot
  geo?: {
    lsoaCode?: string
    msoaCode?: string
    lat?: number
    lon?: number
  }
  enrichedAt: string
  confidence: PropertyIntelligenceConfidence
}

export type PropertyAnswerSource = 'epc' | 'land_registry' | 'property_data'

export type PropertyAnswerSourcesMap = Partial<
  Record<string, Partial<Record<string, PropertyAnswerSource>>>
>
