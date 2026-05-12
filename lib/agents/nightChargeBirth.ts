/**
 * When live grid intensity is very low, birth a “shift load tonight” Discovery tip.
 */

import { validateInjectionCard } from '@/lib/zone/injections'
import type { ZoneTipCard } from '@/lib/logic/zone'

const NIGHT_INTENSITY_THRESHOLD_G = 50

export function shouldBirthNightChargeCard(intensityGPerKwh: number | null): boolean {
  return intensityGPerKwh != null && intensityGPerKwh < NIGHT_INTENSITY_THRESHOLD_G
}

export function buildNightChargeDiscoveryCard(): ZoneTipCard | null {
  return validateInjectionCard({
    id: `inject-night-charge__${Date.now()}`,
    title: 'NIGHT CHARGE',
    journey_key: 'home',
    category: 'home',
    data: {
      money: '£0',
      carbon: '4 kg CO₂',
    },
    source: 'https://api.carbonintensity.org.uk/',
    sourceLabel: 'National Grid ESO',
    explanation: [
      'grid is super green right now. shift your load to save an extra 4kg tonight.',
    ],
    actions: {
      actionType: 'learn',
      learnUrl: 'https://www.nationalgrid.co.uk/',
    },
    cta: { label: 'Live grid', url: 'https://carbonintensity.org.uk/' },
  })
}
