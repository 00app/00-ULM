/**
 * Trusted source attribution for Zone cards
 * Human-readable source labels for credibility
 */

import { JourneyId } from '@/lib/journeys'

export interface SourceLabel {
  url: string
  label: string
  trusted: boolean
}

/**
 * Source labels per journey
 * Rotates like images to avoid repetition
 */
export const JOURNEY_SOURCES: Record<JourneyId, SourceLabel[]> = {
  home: [
    { url: 'https://www.gov.uk/guidance/smart-meters-how-they-work', label: 'uk government', trusted: true },
    { url: 'https://www.energysavingtrust.org.uk', label: 'energy saving trust', trusted: true },
    { url: 'https://www.ofgem.gov.uk', label: 'ofgem', trusted: true },
  ],
  travel: [
    { url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', label: 'department for transport', trusted: true },
    { url: 'https://tfl.gov.uk', label: 'transport for london', trusted: true },
    { url: 'https://www.sustrans.org.uk', label: 'sustrans', trusted: true },
  ],
  food: [
    { url: 'https://wrap.org.uk/taking-action/food-drink', label: 'wrap', trusted: true },
    { url: 'https://www.soilassociation.org', label: 'soil association', trusted: true },
    { url: 'https://www.gov.uk/government/publications/food-waste-reduction-roadmap', label: 'uk government', trusted: true },
  ],
  shopping: [
    { url: 'https://www.which.co.uk', label: 'which?', trusted: true },
    { url: 'https://www.citizensadvice.org.uk', label: 'citizens advice', trusted: true },
    { url: 'https://wrap.org.uk', label: 'wrap', trusted: true },
  ],
  money: [
    { url: 'https://www.moneyhelper.org.uk', label: 'moneyhelper', trusted: true },
    { url: 'https://www.ofgem.gov.uk', label: 'ofgem', trusted: true },
    { url: 'https://www.citizensadvice.org.uk/money', label: 'citizens advice', trusted: true },
  ],
  carbon: [
    { url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', label: 'beis', trusted: true },
    { url: 'https://www.ipcc.ch', label: 'ipcc', trusted: true },
    { url: 'https://www.carbonfootprint.com', label: 'carbon footprint', trusted: true },
  ],
  tech: [
    { url: 'https://www.energysavingtrust.org.uk', label: 'energy saving trust', trusted: true },
    { url: 'https://www.which.co.uk', label: 'which?', trusted: true },
    { url: 'https://www.ifixit.com', label: 'ifixit', trusted: true },
  ],
  waste: [
    { url: 'https://wrap.org.uk', label: 'wrap', trusted: true },
    { url: 'https://www.gov.uk/recycling-collections', label: 'local council', trusted: true },
    { url: 'https://www.recycledevon.org', label: 'recycle devon', trusted: true },
  ],
  holidays: [
    { url: 'https://www.nationalrail.co.uk', label: 'national rail', trusted: true },
    { url: 'https://www.visitbritain.com', label: 'visit britain', trusted: true },
    { url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', label: 'uk government', trusted: true },
  ],
}

/**
 * Get source for a journey and card index
 * @param journey - Journey key
 * @param index - Card index (0-based) for rotation
 * @returns Source label with URL and human-readable text
 */
export function getJourneySource(journey: JourneyId, index: number = 0): SourceLabel {
  const sources = JOURNEY_SOURCES[journey]
  if (!sources || sources.length === 0) {
    return {
      url: 'https://www.gov.uk',
      label: 'uk government',
      trusted: true,
    }
  }

  // Rotate through sources like images
  return sources[index % sources.length] || sources[0]
}

/**
 * Format source label for display
 * Format: "SOURCE. {label}"
 */
export function formatSourceLabel(source: SourceLabel): string {
  return `SOURCE. ${source.label}`
}
