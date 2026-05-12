import type { JourneyId } from '@/lib/journeys'

export interface JourneySource {
  url: string
  label: string
}

const SOURCES: Record<JourneyId, JourneySource[]> = {
  home: [
    { url: 'https://www.gov.uk', label: 'uk government data' },
    { url: 'https://www.energysavingtrust.org.uk', label: 'energy saving trust' },
  ],
  travel: [
    { url: 'https://www.gov.uk', label: 'uk government data' },
    { url: 'https://www.gov.uk/guidance/greenhouse-gas-reporting-conversion-factors', label: 'defra transport factors' },
  ],
  food: [{ url: 'https://wrap.org.uk', label: 'wrap uk' }],
  shopping: [{ url: 'https://www.gov.uk', label: 'uk retail emissions' }],
  money: [{ url: 'https://www.ons.gov.uk', label: 'uk household spending' }],
  carbon: [{ url: 'https://www.carbontrust.com', label: 'carbon trust uk' }],
  tech: [{ url: 'https://www.gov.uk', label: 'uk tech emissions' }],
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
