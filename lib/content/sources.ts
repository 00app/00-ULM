import type { JourneyId } from '@/lib/journeys'

export interface JourneySource {
  url: string
  label: string
}

const SOURCES: Record<JourneyId, JourneySource[]> = {
  home: [
    { url: 'https://www.energysavingtrust.org.uk', label: 'energy saving trust' },
    { url: 'https://www.gov.uk/improve-energy-efficiency', label: 'gov.uk home efficiency' },
  ],
  utilities: [
    { url: 'https://www.moneysavingexpert.com/utilities/', label: 'mse utilities' },
    { url: 'https://www.ofgem.gov.uk/energy-advice-households/energy-price-cap', label: 'ofgem price cap' },
  ],
  grants: [{ url: 'https://www.gov.uk/apply-boiler-upgrade-scheme', label: 'gov.uk grants' }],
  solar: [{ url: 'https://mcscertified.com', label: 'mcs solar uk' }],
  travel: [
    { url: 'https://www.nationalrail.co.uk/tickets-railcards-and-offers/railcards/', label: 'national rail railcards' },
    { url: 'https://www.gov.uk/guidance/greenhouse-gas-reporting-conversion-factors', label: 'defra transport factors' },
  ],
  food: [{ url: 'https://wrap.org.uk', label: 'wrap uk' }],
  shopping: [{ url: 'https://wrap.org.uk', label: 'wrap uk' }],
  money: [{ url: 'https://www.ons.gov.uk', label: 'uk household spending' }],
  carbon: [{ url: 'https://www.carbontrust.com', label: 'carbon trust uk' }],
  tech: [{ url: 'https://www.gov.uk', label: 'uk tech emissions' }],
  water: [{ url: 'https://www.waterwise.org.uk', label: 'waterwise uk' }],
  waste: [{ url: 'https://wrap.org.uk', label: 'wrap uk' }],
  holidays: [{ url: 'https://www.gov.uk/guidance/greenhouse-gas-reporting-conversion-factors', label: 'defra aviation factors' }],
}

export function getJourneySource(journeyKey: JourneyId, index: number): JourneySource {
  const arr = SOURCES[journeyKey] ?? [{ url: 'https://www.gov.uk', label: 'uk government data' }]
  return arr[Math.min(index, arr.length - 1)] ?? arr[0]
}

export function formatSourceLabel(source: JourneySource): string {
  return `source. ${source.label}`
}
